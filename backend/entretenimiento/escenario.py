"""Escenario abierto: la comunidad propone presentaciones (música, podcast, talleres...) en un espacio
del Paseo, el admin las aprueba según la disponibilidad y se publican como eventos con acceso libre
o con cupos que se reservan desde la app (entrada con QR que se valida en la puerta)."""

from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone

from fidelizacion.services import ReglaNegocioError
from usuarios.models import Usuario

from .models import Espacio, Evento, Propuesta, ReservaEvento

ANTICIPACION_MIN = timedelta(hours=24)  # se pide con al menos un día de anticipación
DURACION_MAX = timedelta(hours=6)
MAX_PENDIENTES = 3
MAX_CUPOS_POR_RESERVA = 4

# Tipo de la propuesta → categoría del evento publicado
_CATEGORIA = {
    Propuesta.Tipo.MUSICA: Evento.Categoria.MUSICA,
    Propuesta.Tipo.PODCAST: Evento.Categoria.CULTURA,
    Propuesta.Tipo.ARTE: Evento.Categoria.CULTURA,
    Propuesta.Tipo.TALLER: Evento.Categoria.CULTURA,
    Propuesta.Tipo.OTRO: Evento.Categoria.OTRO,
}


def _avisar(destinatarios, asunto, mensaje):
    destinatarios = [d for d in destinatarios if d]
    if destinatarios:
        send_mail(asunto, mensaje, settings.DEFAULT_FROM_EMAIL, destinatarios, fail_silently=True)


def _nombre(usuario: Usuario) -> str:
    return usuario.get_full_name() or usuario.email


# ---------- Disponibilidad ----------

def eventos_en_conflicto(espacio, inicio, fin, excluir_evento=None):
    """Eventos activos del mismo espacio que se cruzan con [inicio, fin)."""
    qs = Evento.objects.filter(espacio=espacio, activo=True, inicio__lt=fin).filter(
        Q(fin__gt=inicio) | Q(fin__isnull=True, inicio__gte=inicio)
    )
    if excluir_evento:
        qs = qs.exclude(pk=excluir_evento)
    return qs.order_by("inicio")


def propuestas_que_se_cruzan(propuesta: Propuesta):
    """Otras solicitudes pendientes para el mismo espacio y horario (el admin decide cuál aprueba)."""
    return (
        Propuesta.objects.filter(
            espacio=propuesta.espacio, estado=Propuesta.Estado.PENDIENTE,
            inicio__lt=propuesta.fin, fin__gt=propuesta.inicio,
        )
        .exclude(pk=propuesta.pk)
        .order_by("inicio")
    )


def reservados(evento: Evento) -> int:
    return (
        evento.reservas.filter(estado=ReservaEvento.Estado.CONFIRMADA).aggregate(t=Sum("cantidad"))["t"] or 0
    )


def disponibles(evento: Evento):
    """Cupos libres; None si el evento es de acceso libre."""
    if evento.cupos is None:
        return None
    return max(0, evento.cupos - reservados(evento))


# ---------- Propuestas (cliente) ----------

def crear_propuesta(solicitante: Usuario, datos: dict) -> Propuesta:
    espacio = Espacio.objects.filter(pk=datos.get("espacio"), activo=True).first()
    if espacio is None:
        raise ReglaNegocioError("Elige un espacio disponible.")
    inicio, fin = datos["inicio"], datos["fin"]
    if fin <= inicio:
        raise ReglaNegocioError("La hora de fin debe ser posterior a la de inicio.")
    if fin - inicio > DURACION_MAX:
        raise ReglaNegocioError("La presentación puede durar como máximo 6 horas.")
    if inicio - timezone.now() < ANTICIPACION_MIN:
        raise ReglaNegocioError("Pide el espacio con al menos un día de anticipación.")
    if datos["personas"] > espacio.capacidad:
        raise ReglaNegocioError(f"{espacio.nombre} tiene capacidad para {espacio.capacidad} personas.")
    pendientes = Propuesta.objects.filter(solicitante=solicitante, estado=Propuesta.Estado.PENDIENTE).count()
    if pendientes >= MAX_PENDIENTES:
        raise ReglaNegocioError(f"Ya tienes {pendientes} solicitudes en revisión. Espera la respuesta del Paseo.")
    if eventos_en_conflicto(espacio, inicio, fin).exists():
        raise ReglaNegocioError(f"{espacio.nombre} ya está ocupado en ese horario. Prueba otro día u hora.")

    propuesta = Propuesta.objects.create(solicitante=solicitante, espacio=espacio, **{
        k: datos[k] for k in ("artista", "titulo", "tipo", "descripcion", "necesidades", "inicio", "fin",
                              "personas", "acceso") if k in datos
    })
    # La solicitud le llega al admin automáticamente (correo + lista "Pendientes" del panel).
    admins = Usuario.objects.filter(rol=Usuario.Rol.ADMIN, is_active=True).values_list("email", flat=True)
    _avisar(
        list(admins), f"Nueva solicitud de Escenario abierto: {propuesta.titulo}",
        f"{propuesta.artista} ({_nombre(solicitante)}) pide {espacio.nombre} el "
        f"{timezone.localtime(inicio):%d/%m %H:%M}–{timezone.localtime(fin):%H:%M} para {propuesta.personas} "
        f"personas.\n\n{propuesta.descripcion}\n\nNecesita: {propuesta.necesidades or '—'}\n\n"
        f"Revísala en {settings.WEB_PANEL_URL}/escenario",
    )
    return propuesta


@transaction.atomic
def cancelar_propuesta(solicitante: Usuario, propuesta_id) -> Propuesta:
    propuesta = Propuesta.objects.select_for_update().filter(pk=propuesta_id, solicitante=solicitante).first()
    if propuesta is None:
        raise ReglaNegocioError("No encontramos esa solicitud.")
    if propuesta.estado != Propuesta.Estado.PENDIENTE:
        raise ReglaNegocioError("Solo puedes retirar solicitudes que siguen en revisión. Escribe al Paseo.")
    propuesta.estado = Propuesta.Estado.CANCELADA
    propuesta.save(update_fields=["estado"])
    return propuesta


# ---------- Propuestas (admin) ----------

def _pendiente(propuesta_id) -> Propuesta:
    propuesta = (
        Propuesta.objects.select_for_update().select_related("espacio", "solicitante")
        .filter(pk=propuesta_id).first()
    )
    if propuesta is None:
        raise ReglaNegocioError("Esa solicitud no existe.")
    if propuesta.estado != Propuesta.Estado.PENDIENTE:
        raise ReglaNegocioError(f"Esa solicitud ya está {propuesta.get_estado_display().lower()}.")
    return propuesta


@transaction.atomic
def aprobar(propuesta_id, admin: Usuario, acceso=None, cupos=None, destacado=False) -> Propuesta:
    """Aprueba y publica la presentación como evento, si el espacio sigue libre en ese horario."""
    propuesta = _pendiente(propuesta_id)
    if propuesta.inicio <= timezone.now():
        raise ReglaNegocioError("Esa fecha ya pasó: no se puede publicar.")
    # Bloquea el espacio para que dos aprobaciones simultáneas no se superpongan.
    Espacio.objects.select_for_update().filter(pk=propuesta.espacio_id).first()
    choque = eventos_en_conflicto(propuesta.espacio, propuesta.inicio, propuesta.fin).first()
    if choque:
        raise ReglaNegocioError(
            f"{propuesta.espacio.nombre} ya está ocupado por \"{choque.titulo}\" "
            f"({timezone.localtime(choque.inicio):%d/%m %H:%M}). Rechaza o pide otro horario."
        )
    acceso = acceso or propuesta.acceso
    if acceso not in Propuesta.Acceso.values:
        raise ReglaNegocioError("Elige acceso libre o con cupos.")
    if acceso == Propuesta.Acceso.CUPOS:
        cupos = int(cupos or propuesta.personas)
        if not 1 <= cupos <= propuesta.espacio.capacidad:
            raise ReglaNegocioError(f"Los cupos deben ir de 1 a {propuesta.espacio.capacidad} (capacidad del espacio).")
    else:
        cupos = None

    propuesta.evento = Evento.objects.create(
        titulo=propuesta.titulo,
        descripcion=f"{propuesta.artista} · {propuesta.descripcion}",
        categoria=_CATEGORIA.get(propuesta.tipo, Evento.Categoria.OTRO),
        inicio=propuesta.inicio, fin=propuesta.fin,
        lugar=f"{propuesta.espacio.nombre} · {propuesta.espacio.lugar}",
        espacio=propuesta.espacio, cupos=cupos, precio=None, destacado=bool(destacado), activo=True,
    )
    propuesta.acceso = acceso
    propuesta.estado = Propuesta.Estado.APROBADA
    propuesta.revisada_por = admin
    propuesta.revisada_en = timezone.now()
    propuesta.save()
    acceso_texto = f"con {cupos} cupos que el público reserva desde la app" if cupos else "con acceso libre"
    _avisar(
        [propuesta.solicitante.email], f"¡Aprobado! {propuesta.titulo} en Paseo Aranjuez",
        f"Hola, {_nombre(propuesta.solicitante)}:\n\nTu presentación \"{propuesta.titulo}\" fue aprobada para el "
        f"{timezone.localtime(propuesta.inicio):%d/%m a las %H:%M} en {propuesta.espacio.nombre} "
        f"({propuesta.espacio.lugar}), {acceso_texto}.\n\nYa está publicada en la sección Diversión de la app.",
    )
    return propuesta


@transaction.atomic
def rechazar(propuesta_id, admin: Usuario, motivo: str) -> Propuesta:
    motivo = (motivo or "").strip()
    if not motivo:
        raise ReglaNegocioError("Escribe el motivo para que la persona sepa qué cambiar.")
    propuesta = _pendiente(propuesta_id)
    propuesta.estado = Propuesta.Estado.RECHAZADA
    propuesta.motivo_rechazo = motivo[:300]
    propuesta.revisada_por = admin
    propuesta.revisada_en = timezone.now()
    propuesta.save()
    _avisar(
        [propuesta.solicitante.email], f"Tu solicitud \"{propuesta.titulo}\"",
        f"Hola, {_nombre(propuesta.solicitante)}:\n\nEsta vez no pudimos aprobar tu presentación.\n"
        f"Motivo: {propuesta.motivo_rechazo}\n\nPuedes enviar una nueva solicitud desde la app.",
    )
    return propuesta


# ---------- Cupos (cliente) ----------

@transaction.atomic
def reservar(cliente: Usuario, evento_id, cantidad=1) -> ReservaEvento:
    evento = Evento.objects.select_for_update().filter(pk=evento_id, activo=True).first()
    if evento is None:
        raise ReglaNegocioError("Ese evento no existe.")
    if evento.cupos is None:
        raise ReglaNegocioError("Este evento es de acceso libre: no necesitas reservar, ¡solo ven!")
    if evento.inicio <= timezone.now():
        raise ReglaNegocioError("El evento ya empezó: las reservas están cerradas.")
    cantidad = int(cantidad or 1)
    if not 1 <= cantidad <= MAX_CUPOS_POR_RESERVA:
        raise ReglaNegocioError(f"Puedes reservar de 1 a {MAX_CUPOS_POR_RESERVA} cupos.")
    if evento.reservas.filter(cliente=cliente, estado=ReservaEvento.Estado.CONFIRMADA).exists():
        raise ReglaNegocioError("Ya tienes cupo para este evento: tu entrada está en Diversión → Escenario.")
    libres = disponibles(evento)
    if libres < cantidad:
        raise ReglaNegocioError("Ya no quedan cupos." if not libres else f"Solo quedan {libres} cupos.")
    return ReservaEvento.objects.create(evento=evento, cliente=cliente, cantidad=cantidad)


@transaction.atomic
def cancelar_reserva(cliente: Usuario, reserva_id) -> ReservaEvento:
    reserva = (
        ReservaEvento.objects.select_for_update().select_related("evento")
        .filter(pk=reserva_id, cliente=cliente).first()
    )
    if reserva is None:
        raise ReglaNegocioError("No encontramos esa reserva.")
    if reserva.estado != ReservaEvento.Estado.CONFIRMADA:
        raise ReglaNegocioError("Esa reserva ya estaba cancelada.")
    if reserva.ingreso_en:
        raise ReglaNegocioError("Esa entrada ya se usó.")
    reserva.estado = ReservaEvento.Estado.CANCELADA
    reserva.save(update_fields=["estado"])  # el cupo vuelve a quedar libre
    return reserva


# ---------- Puerta (portero o admin) ----------

def _entrada(codigo) -> ReservaEvento:
    reserva = (
        ReservaEvento.objects.select_related("evento", "cliente")
        .filter(codigo=(codigo or "").strip().upper()).first()
    )
    if reserva is None:
        raise ReglaNegocioError("Esa entrada no existe.")
    if reserva.estado != ReservaEvento.Estado.CONFIRMADA:
        raise ReglaNegocioError("Esa entrada fue cancelada.")
    return reserva


@transaction.atomic
def registrar_ingreso(codigo) -> ReservaEvento:
    reserva = _entrada(codigo)
    ReservaEvento.objects.select_for_update().filter(pk=reserva.pk).first()
    reserva.refresh_from_db()
    if reserva.ingreso_en:
        raise ReglaNegocioError(f"Esta entrada ya se usó a las {timezone.localtime(reserva.ingreso_en):%H:%M}.")
    fin = reserva.evento.fin or reserva.evento.inicio + timedelta(hours=4)
    if timezone.now() > fin:
        raise ReglaNegocioError("El evento ya terminó.")
    if reserva.evento.inicio - timezone.now() > timedelta(hours=2):
        raise ReglaNegocioError(
            f"Todavía es temprano: el evento empieza el {timezone.localtime(reserva.evento.inicio):%d/%m a las %H:%M}."
        )
    reserva.ingreso_en = timezone.now()
    reserva.save(update_fields=["ingreso_en"])
    return reserva
