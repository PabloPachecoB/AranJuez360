"""Lógica de las monedas de Paseo: visitas (NFC de la puerta o portería), actividades
escaneadas (juegos, cine…) y compras aprobadas en caja."""

from datetime import timedelta
from decimal import ROUND_DOWN, ROUND_UP, Decimal

from django.conf import settings
from django.core import signing
from django.db import transaction
from django.db.models import F, Q
from django.utils import timezone

from empresas.models import Empresa
from usuarios.models import Usuario

from .models import (
    Canje,
    ConfiguracionPuntos,
    MovimientoPuntos,
    PuntoEscaneo,
    RangoCompra,
    Recompensa,
    SolicitudPuntos,
    Visita,
)

_QR_SALT = "fidelizacion.qr-cliente"


class ReglaNegocioError(Exception):
    """Error de validación de dominio que se devuelve al cliente como 400."""


def empresa_por_codigo(codigo: str) -> Empresa:
    try:
        return Empresa.objects.exclude(tipo=Empresa.Tipo.OFICINA).get(
            codigo_fidelizacion=codigo, activo=True
        )
    except Empresa.DoesNotExist:
        raise ReglaNegocioError("Código no válido o establecimiento inactivo.")


CENTAVO = Decimal("0.01")


def calcular_puntos(monto, config: ConfiguracionPuntos) -> Decimal:
    """Monedas de una compra: según el rango de montos que definió el admin
    o, si no hay rangos, `puntos_por_boliviano` × monto."""
    monto = Decimal(monto)
    rango = (
        RangoCompra.objects.filter(activo=True, monto_minimo__lte=monto)
        .filter(Q(monto_maximo__isnull=True) | Q(monto_maximo__gte=monto))
        .order_by("-monto_minimo")
        .first()
    )
    if rango:
        return rango.monedas
    if RangoCompra.objects.filter(activo=True).exists():
        return Decimal("0")  # hay rangos pero el monto no entra en ninguno
    return (monto * config.puntos_por_boliviano).quantize(CENTAVO, rounding=ROUND_DOWN)


def _acreditar(cliente_id: int, monedas: Decimal):
    Usuario.objects.filter(pk=cliente_id).update(puntos_saldo=F("puntos_saldo") + monedas)


def _formato_espera(hasta) -> str:
    minutos = max(1, int((hasta - timezone.now()).total_seconds() // 60))
    horas, minutos = divmod(minutos, 60)
    return f"{horas} h {minutos} min" if horas else f"{minutos} min"


@transaction.atomic
def crear_solicitud(cliente: Usuario, codigo: str, nit: str, monto) -> SolicitudPuntos:
    empresa = empresa_por_codigo(codigo)
    # Serializa las solicitudes del mismo cliente para que los límites no se salten en paralelo.
    Usuario.objects.select_for_update().filter(pk=cliente.pk).first()
    config = ConfiguracionPuntos.actual()

    if monto <= 0:
        raise ReglaNegocioError("El monto debe ser mayor a 0.")
    if monto > config.monto_maximo_solicitud:
        raise ReglaNegocioError(
            f"El monto supera el máximo permitido (Bs {config.monto_maximo_solicitud})."
        )

    previas = SolicitudPuntos.objects.filter(cliente=cliente, empresa=empresa)
    if previas.filter(estado=SolicitudPuntos.Estado.PENDIENTE).exists():
        raise ReglaNegocioError("Ya tienes una solicitud pendiente en este establecimiento.")
    hoy = timezone.localdate()
    if previas.filter(creado_en__date=hoy).count() >= config.solicitudes_diarias_por_empresa:
        raise ReglaNegocioError("Alcanzaste el límite de solicitudes de hoy en este establecimiento.")

    return SolicitudPuntos.objects.create(cliente=cliente, empresa=empresa, nit=nit, monto=monto)


def _bloquear_pendiente(solicitud_id: int, cajero: Usuario) -> SolicitudPuntos:
    solicitud = (
        SolicitudPuntos.objects.select_for_update()
        .filter(pk=solicitud_id, empresa_id=cajero.empresa_id)
        .first()
    )
    if solicitud is None:
        raise SolicitudPuntos.DoesNotExist
    if solicitud.estado != SolicitudPuntos.Estado.PENDIENTE:
        raise ReglaNegocioError("La solicitud ya fue atendida.")
    return solicitud


@transaction.atomic
def aprobar_solicitud(solicitud_id: int, cajero: Usuario) -> SolicitudPuntos:
    """Caja verificó el ticket: acredita los puntos una sola vez."""
    solicitud = _bloquear_pendiente(solicitud_id, cajero)
    puntos = calcular_puntos(solicitud.monto, ConfiguracionPuntos.actual())

    solicitud.estado = SolicitudPuntos.Estado.APROBADA
    solicitud.puntos = puntos
    solicitud.atendida_por = cajero
    solicitud.atendida_en = timezone.now()
    solicitud.save(update_fields=["estado", "puntos", "atendida_por", "atendida_en"])

    MovimientoPuntos.objects.create(
        cliente_id=solicitud.cliente_id,
        empresa_id=solicitud.empresa_id,
        solicitud=solicitud,
        puntos=puntos,
        tipo=MovimientoPuntos.Tipo.COMPRA,
        descripcion=f"Compra de Bs {solicitud.monto}",
    )
    _acreditar(solicitud.cliente_id, puntos)
    return solicitud


@transaction.atomic
def rechazar_solicitud(solicitud_id: int, cajero: Usuario, motivo: str = "") -> SolicitudPuntos:
    solicitud = _bloquear_pendiente(solicitud_id, cajero)
    solicitud.estado = SolicitudPuntos.Estado.RECHAZADA
    solicitud.atendida_por = cajero
    solicitud.atendida_en = timezone.now()
    solicitud.motivo_rechazo = motivo
    solicitud.save(update_fields=["estado", "atendida_por", "atendida_en", "motivo_rechazo"])
    return solicitud


# --- Visitas (portería) ---------------------------------------------------------

def generar_qr_cliente(cliente: Usuario) -> dict:
    """QR personal dinámico: firmado y con vencimiento corto, para que una captura
    enviada a otra persona no sirva para sumar visitas sin estar en el Paseo."""
    token = signing.TimestampSigner(salt=_QR_SALT).sign(str(cliente.pk))
    return {"token": token, "vigencia_segundos": settings.QR_CLIENTE_VIGENCIA_SEGUNDOS}


def cliente_por_qr(token: str) -> Usuario:
    try:
        pk = signing.TimestampSigner(salt=_QR_SALT).unsign(
            token, max_age=settings.QR_CLIENTE_VIGENCIA_SEGUNDOS
        )
    except signing.SignatureExpired:
        raise ReglaNegocioError("El QR venció. Pide al cliente que lo actualice en su app.")
    except signing.BadSignature:
        raise ReglaNegocioError("QR no válido.")
    cliente = Usuario.objects.filter(pk=pk, rol=Usuario.Rol.CLIENTE, is_active=True).first()
    if cliente is None:
        raise ReglaNegocioError("QR no válido.")
    return cliente


def _ultima_visita_con_monedas(cliente: Usuario, config: ConfiguracionPuntos):
    if not config.horas_entre_visitas:
        return None  # 0 horas = sin límite entre visitas
    desde = timezone.now() - timedelta(hours=config.horas_entre_visitas)
    return (
        Visita.objects.filter(cliente=cliente, puntos__gt=0, creado_en__gte=desde)
        .order_by("-creado_en")
        .first()
    )


def _crear_visita(cliente, config, monedas: Decimal, portero=None, punto=None) -> Visita:
    """Registra el ingreso; da monedas solo si no sumó otra visita en las últimas horas."""
    if _ultima_visita_con_monedas(cliente, config):
        monedas = Decimal("0")
    visita = Visita.objects.create(cliente=cliente, portero=portero, punto=punto, puntos=monedas)
    if monedas:
        MovimientoPuntos.objects.create(
            cliente=cliente, visita=visita, punto=punto, puntos=monedas,
            tipo=MovimientoPuntos.Tipo.VISITA, descripcion="Visita al Paseo",
        )
        _acreditar(cliente.pk, monedas)
    return visita


@transaction.atomic
def registrar_visita(token: str, portero: Usuario) -> Visita:
    """El portero escanea el QR del cliente: se registra el ingreso y, si no sumó
    otra visita en las últimas `horas_entre_visitas`, se acreditan las monedas."""
    cliente = cliente_por_qr(token)
    cliente = Usuario.objects.select_for_update().get(pk=cliente.pk)
    config = ConfiguracionPuntos.actual()
    return _crear_visita(cliente, config, config.puntos_por_visita, portero=portero)


# --- Puntos de escaneo (NFC/QR de la puerta, juegos, cine…) ---------------------

def punto_por_codigo(codigo: str):
    return PuntoEscaneo.objects.filter(codigo=codigo, activo=True).first()


def resolver_codigo(codigo: str) -> dict:
    """Qué es un código escaneado: la caja de una empresa (compra) o un punto de escaneo."""
    punto = punto_por_codigo(codigo)
    if punto:
        return {"tipo": punto.tipo, "punto": punto}
    return {"tipo": "COMPRA", "empresa": empresa_por_codigo(codigo)}


@transaction.atomic
def escanear_punto(cliente: Usuario, codigo: str) -> dict:
    """El cliente escaneó el NFC/QR de la puerta o de una actividad: acredita sus monedas
    si no lo hizo dentro del tiempo de espera."""
    punto = punto_por_codigo(codigo)
    if punto is None:
        raise ReglaNegocioError(
            "Este código no da monedas al escanearlo. Si es una caja, registra tu compra."
        )
    cliente = Usuario.objects.select_for_update().get(pk=cliente.pk)
    config = ConfiguracionPuntos.actual()

    if punto.tipo == PuntoEscaneo.Tipo.ENTRADA:
        previa = _ultima_visita_con_monedas(cliente, config)
        if previa:
            hasta = previa.creado_en + timedelta(hours=config.horas_entre_visitas)
            raise ReglaNegocioError(
                f"Ya registraste tu visita. Podrás volver a ganar en {_formato_espera(hasta)}."
            )
        visita = _crear_visita(cliente, config, punto.monedas, punto=punto)
        monedas = visita.puntos
        mensaje = f"¡Bienvenido al Paseo! Ganaste {monedas} monedas."
        hasta = visita.creado_en + timedelta(hours=config.horas_entre_visitas)
    else:
        desde = timezone.now() - timedelta(hours=punto.horas_espera)
        previo = punto.horas_espera and (
            MovimientoPuntos.objects.filter(cliente=cliente, punto=punto, creado_en__gte=desde).first()
        )
        if previo:
            hasta = previo.creado_en + timedelta(hours=punto.horas_espera)
            raise ReglaNegocioError(f"Ya ganaste aquí. Vuelve en {_formato_espera(hasta)}.")
        mov = MovimientoPuntos.objects.create(
            cliente=cliente, punto=punto, empresa=punto.empresa, puntos=punto.monedas,
            tipo=MovimientoPuntos.Tipo.ACTIVIDAD, descripcion=punto.nombre,
        )
        _acreditar(cliente.pk, punto.monedas)
        monedas = punto.monedas
        mensaje = f"¡Ganaste {monedas} monedas en {punto.nombre}!"
        hasta = mov.creado_en + timedelta(hours=punto.horas_espera)

    saldo = Usuario.objects.values_list("puntos_saldo", flat=True).get(pk=cliente.pk)
    return {
        "tipo": punto.tipo,
        "punto": punto.nombre,
        "monedas": monedas,
        "saldo": saldo,
        "mensaje": mensaje,
        "disponible_de_nuevo": hasta,
    }


# --- Monedero (app) -------------------------------------------------------------

def monedero(cliente: Usuario) -> dict:
    """Saldo, recompensas alcanzables y cuánto falta para la siguiente.

    Solo en monedas: la equivalencia en Bs no se muestra al cliente (mantiene la "mística").
    """
    # Saldo fresco de la base (el objeto del request puede estar desactualizado).
    saldo = Usuario.objects.values_list("puntos_saldo", flat=True).get(pk=cliente.pk)
    activas = Recompensa.objects.filter(activo=True).select_related("empresa")
    siguiente = activas.filter(costo_puntos__gt=saldo).first()
    config = ConfiguracionPuntos.actual()

    data = {
        "saldo": saldo,
        "recompensas_disponibles": activas.filter(costo_puntos__lte=saldo).count(),
        "siguiente": None,
        "puntos_por_visita": config.puntos_por_visita,
    }
    if siguiente:
        faltan = siguiente.costo_puntos - saldo
        anterior = activas.filter(costo_puntos__lte=saldo).order_by("-costo_puntos").first()
        base = anterior.costo_puntos if anterior else 0
        tramo = siguiente.costo_puntos - base
        data["siguiente"] = {
            "id": siguiente.id,
            "nombre": siguiente.nombre,
            "costo_puntos": siguiente.costo_puntos,
            "empresa": siguiente.empresa.nombre if siguiente.empresa else None,
            "faltan_puntos": faltan,
            # Progreso dentro del tramo actual (desde la última recompensa alcanzada).
            "progreso": round(float((saldo - base) / tramo), 3) if tramo else 1,
        }
    return data


# --- Canje de recompensas ---------------------------------------------------------

def cobrar_monedas(cliente_id: int, monedas: Decimal, descripcion: str, empresa=None) -> Decimal:
    """Descuenta monedas del saldo (con el usuario ya bloqueado por select_for_update)."""
    saldo = Usuario.objects.values_list("puntos_saldo", flat=True).get(pk=cliente_id)
    if saldo < monedas:
        raise ReglaNegocioError(f"No te alcanzan las monedas: tienes {saldo:.2f} y necesitas {monedas:.2f}.")
    MovimientoPuntos.objects.create(
        cliente_id=cliente_id, empresa=empresa, puntos=-monedas,
        tipo=MovimientoPuntos.Tipo.CANJE, descripcion=descripcion[:200],
    )
    _acreditar(cliente_id, -monedas)
    return saldo - monedas


def devolver_monedas(cliente_id: int, monedas: Decimal, descripcion: str):
    MovimientoPuntos.objects.create(
        cliente_id=cliente_id, puntos=monedas, tipo=MovimientoPuntos.Tipo.CANJE, descripcion=descripcion[:200],
    )
    _acreditar(cliente_id, monedas)


def recompensa_activa(recompensa_id) -> Recompensa:
    recompensa = Recompensa.objects.filter(pk=recompensa_id, activo=True).select_related("empresa").first()
    if recompensa is None:
        raise ReglaNegocioError("Esa recompensa no existe o ya no está disponible.")
    return recompensa


@transaction.atomic
def canjear_recompensa(cliente: Usuario, recompensa_id) -> Canje:
    recompensa = recompensa_activa(recompensa_id)
    Usuario.objects.select_for_update().filter(pk=cliente.pk).first()
    cobrar_monedas(cliente.pk, recompensa.costo_puntos, f"Canje: {recompensa.nombre}", empresa=recompensa.empresa)
    return Canje.objects.create(cliente=cliente, recompensa=recompensa, monedas=recompensa.costo_puntos)



# --- Recompensas de los negocios y validación de cupones -------------------------------

# Margen sobre el valor real: un producto de tienda cuesta un poco más en monedas que su precio,
# así es aspiracional y el negocio no pierde (el admin y el negocio lo pueden ajustar).
MARGEN_PRODUCTO = Decimal("1.10")


def costo_sugerido(valor_bs, config: ConfiguracionPuntos | None = None) -> Decimal:
    """Monedas que debería costar un premio de `valor_bs` (redondeado a decenas)."""
    config = config or ConfiguracionPuntos.actual()
    if not valor_bs or not config.valor_moneda_bs:
        return Decimal("0")
    monedas = Decimal(valor_bs) / config.valor_moneda_bs * MARGEN_PRODUCTO
    return (monedas / 10).to_integral_value(rounding=ROUND_UP) * 10


def conversion(config: ConfiguracionPuntos | None = None) -> dict:
    """Cómo funciona la escala (para el panel del negocio y del admin; nunca para el cliente)."""
    config = config or ConfiguracionPuntos.actual()
    rangos = list(RangoCompra.objects.filter(activo=True).values("monto_minimo", "monto_maximo", "monedas"))
    return {
        "valor_moneda_bs": config.valor_moneda_bs,
        "monedas_por_bs": (Decimal(1) / config.valor_moneda_bs).quantize(CENTAVO) if config.valor_moneda_bs else None,
        "margen_producto": MARGEN_PRODUCTO,
        "puntos_por_visita": config.puntos_por_visita,
        "rangos_compra": rangos,
    }


def _puede_validar(usuario: Usuario, canje: Canje) -> bool:
    if usuario.rol == Usuario.Rol.ADMIN:
        return True
    empresa_premio = canje.recompensa.empresa_id
    # Los premios de un negocio los valida ese negocio (dueño o cajero); los del Paseo, el admin.
    return bool(empresa_premio) and usuario.rol in (Usuario.Rol.NEGOCIO, Usuario.Rol.CAJERO) \
        and usuario.empresa_id == empresa_premio


def canje_por_codigo(usuario: Usuario, codigo: str) -> Canje:
    canje = (
        Canje.objects.select_related("recompensa__empresa", "cliente")
        .filter(codigo=(codigo or "").strip().upper()).first()
    )
    if canje is None or not _puede_validar(usuario, canje):
        raise ReglaNegocioError("No encontramos ese cupón entre los premios que puedes entregar.")
    return canje


@transaction.atomic
def usar_canje(usuario: Usuario, codigo: str) -> Canje:
    """Marca el cupón como entregado (una sola vez)."""
    canje = canje_por_codigo(usuario, codigo)
    canje = Canje.objects.select_for_update().select_related("recompensa", "cliente").get(pk=canje.pk)
    if canje.estado == Canje.Estado.USADO:
        raise ReglaNegocioError(
            f"Este cupón ya se entregó el {timezone.localtime(canje.usado_en):%d/%m/%Y a las %H:%M}."
        )
    if canje.estado != Canje.Estado.ACTIVO:
        raise ReglaNegocioError("Este cupón fue anulado.")
    canje.estado = Canje.Estado.USADO
    canje.usado_en = timezone.now()
    canje.save(update_fields=["estado", "usado_en"])
    return canje
