"""Lógica del Sorteo Paseo: registro, verificación, recuperación, código de tarjeta y progreso.

Las vistas solo llaman a estas funciones. Los errores esperados salen como `SorteoError`.
"""

import hashlib
import hmac
import re
import secrets
from datetime import timedelta
from decimal import ROUND_FLOOR, Decimal

from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from django.db import IntegrityError, connection, transaction
from django.db.models import F, Q
from django.utils import timezone

from . import canales
from .codigos import (
    hash_codigo_verificacion,
    normalizar_codigo_tarjeta,
    nuevo_codigo_tarjeta,
    nuevo_codigo_verificacion,
)
from .errores import SorteoError
from .models import Campania, CodigoTarjeta, CuentaFidelizacion, DesafioContacto, EventoAuditoria, PaseWallet
from .red import hash_ip
from .texto import correo_canonico

REENVIO_ESPERA_SEGUNDOS = 60
_CELULAR = re.compile(r"^[67]\d{7}$")
_CENT = Decimal("0.01")
MENSAJE_CELULAR = "Revisa tu celular. Si no es de Bolivia, agrega el código de tu país (ej. +54)."
_MENSAJE_AYUDA = "Si necesitas ayuda, pídela en el mostrador."


# --- utilidades -------------------------------------------------------------------------------

def campania_activa() -> Campania | None:
    return Campania.objects.filter(estado=Campania.Estado.ACTIVA).first()


def normalizar_correo(valor: str) -> str | None:
    """Correo en minúsculas, con dominio de internet (sin «localhost» ni direcciones IP entre corchetes)."""
    correo = (valor or "").strip().lower()
    try:
        validate_email(correo)
    except DjangoValidationError:
        return None
    dominio = correo.rpartition("@")[2]
    if "." not in dominio or dominio.startswith("["):
        return None
    return correo


def normalizar_celular(valor: str) -> str | None:
    """Celular en su forma de guardado, o None si no es válido.

    - Bolivia (sin prefijo, o con +591, 591 o 00591): 8 dígitos que empiezan con 6 o 7. Se guarda sin prefijo.
    - Otro país: debe venir con su prefijo (+54…, 0054…). Se guarda como «+» y los dígitos (formato E.164, de 8
      a 15 dígitos). Sin prefijo no se puede saber de qué país es, así que no se acepta.
    """
    limpio = re.sub(r"[\s\-().]", "", valor or "")
    if limpio.startswith("00"):
        limpio = "+" + limpio[2:]
    if limpio.startswith("+"):
        digitos = limpio[1:]
        if not digitos.isascii() or not digitos.isdigit():
            return None
        if digitos.startswith("591"):
            nacional = digitos[3:]
            return nacional if _CELULAR.match(nacional) else None
        return f"+{digitos}" if 8 <= len(digitos) <= 15 and digitos[0] != "0" else None
    if len(limpio) == 11 and limpio.startswith("591"):
        limpio = limpio[3:]
    return limpio if _CELULAR.match(limpio) else None


def mensaje_correo(valor: str) -> str:
    """Qué le falta a un correo que no se aceptó, en pocas palabras."""
    texto = (valor or "").strip()
    if not texto:
        return "Escribe tu correo."
    usuario, arroba, dominio = texto.partition("@")
    if not arroba or not usuario or "." not in dominio or dominio.endswith("."):
        return "Correo incompleto."
    return "Revisa tu correo."


def mensaje_celular(valor: str) -> str:
    """Qué le falta a un celular que no se aceptó, en pocas palabras."""
    limpio = re.sub(r"[\s\-().]", "", valor or "")
    if not limpio:
        return "Escribe tu celular."
    if re.search(r"[^\d+]", limpio) or "+" in limpio[1:]:
        return "El celular solo lleva números."
    con_codigo = limpio.startswith("+") or limpio.startswith("00")
    if len(limpio.lstrip("+")) < 8:
        return "Celular incompleto."
    if not con_codigo and len(limpio) == 8 and limpio[0] not in "67":
        return "El celular empieza con 6 o 7."
    return MENSAJE_CELULAR


def normalizar_contacto(valor: str) -> tuple[str, str] | None:
    """Devuelve (canal, destino) o None si no parece un correo ni un celular válido."""
    texto = (valor or "").strip()
    if "@" in texto:
        correo = normalizar_correo(texto)
        return (DesafioContacto.Canal.CORREO, correo) if correo else None
    celular = normalizar_celular(texto)
    return (DesafioContacto.Canal.CELULAR, celular) if celular else None


def _auditar(cuenta, tipo, actor=None, detalle=""):
    EventoAuditoria.objects.create(cuenta=cuenta, tipo=tipo, actor=actor, detalle=detalle[:300])


def _cuenta_verificada(canal: str, destino: str) -> CuentaFidelizacion | None:
    if canal == DesafioContacto.Canal.CORREO:
        filtro = {"correo": destino, "correo_verificado_en__isnull": False}
    else:
        filtro = {"celular": destino, "celular_verificado_en__isnull": False}
    return CuentaFidelizacion.objects.filter(estado=CuentaFidelizacion.Estado.ACTIVA, **filtro).first()


def _bloquear_contacto(destino: str) -> None:
    """Serializa las operaciones sobre un mismo contacto (dentro de una transacción).

    Sin esto, dos peticiones simultáneas (doble toque, dos pestañas) crean cuentas y códigos repetidos: un
    `select_for_update` sobre cero filas no bloquea nada. En PostgreSQL usa un candado de aviso; SQLite ya
    serializa las escrituras por sí mismo.
    """
    if connection.vendor != "postgresql":
        return
    clave = int.from_bytes(hashlib.sha256(f"sorteo:{destino}".encode()).digest()[:8], "big", signed=True)
    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_advisory_xact_lock(%s)", [clave])


# --- desafíos de verificación ------------------------------------------------------------------

def _crear_desafio(cuenta, canal: str, destino: str, proposito: str, ip: str = "") -> DesafioContacto:
    """Emite un código nuevo. Con `cuenta=None` crea el desafío pero no envía nada (ver `recuperar`).

    Topes (en base de datos, compartidos por todos los workers): una espera entre códigos para el mismo contacto,
    un máximo diario por contacto y uno menor por IP para ese contacto. Así quien pide códigos a nombre de otra
    persona no le agota el cupo: desde una sola IP solo puede gastar una parte.
    """
    ahora = timezone.now()
    ip_h = hash_ip(ip)
    previos = DesafioContacto.objects.filter(destino=destino)
    ultimo = previos.order_by("-creado_en").first()
    if ultimo is not None:
        espera = (ultimo.creado_en + timedelta(seconds=REENVIO_ESPERA_SEGUNDOS) - ahora).total_seconds()
        if espera > 0:
            raise SorteoError("espera_reenvio", f"Espera {int(espera) + 1} segundos para pedir otro código.", 429)
    del_dia = previos.filter(creado_en__gte=ahora - timedelta(hours=24))
    if del_dia.count() >= settings.SORTEO_ENVIOS_DIA or (
        ip_h and del_dia.filter(ip_hash=ip_h).count() >= settings.SORTEO_ENVIOS_DIA_POR_IP
    ):
        raise SorteoError("limite_envios", f"Pediste muchos códigos hoy. Prueba mañana. {_MENSAJE_AYUDA}", 429)

    previos.filter(usado=False).update(usado=True)  # el código anterior deja de servir
    # Sin cuenta no se envía nada: su hash es de un valor que no es de 6 dígitos, imposible de acertar.
    codigo = nuevo_codigo_verificacion() if cuenta is not None else f"sin-cuenta-{secrets.token_hex(16)}"
    desafio = DesafioContacto.objects.create(
        cuenta=cuenta, canal=canal, destino=destino, proposito=proposito, ip_hash=ip_h,
        codigo_hash=hash_codigo_verificacion(codigo),
        expira_en=ahora + timedelta(minutes=settings.CODIGO_VERIFICACION_MINUTOS),
    )
    if cuenta is not None:
        canales.enviar_codigo(canal, destino, cuenta.primer_nombre, codigo, proposito)
    return desafio


def registrar(*, nombres, apellidos, correo, celular, canal, acepta_terminos, ip: str = "") -> DesafioContacto:
    """Crea la cuenta (pendiente) y envía el código al contacto elegido.

    Si ese contacto ya tiene una tarjeta se dice claramente, para que la persona entre a la suya en vez de crear
    otra. (Antes se respondía igual que a un registro nuevo para no revelar quién está registrado; se prefirió la
    claridad para el cliente. Los límites por IP siguen frenando las consultas en masa.)
    """
    canales.exigir_canal(canal)
    es_correo = canal == DesafioContacto.Canal.CORREO
    destino = correo if es_correo else celular
    with transaction.atomic():
        _bloquear_contacto(destino)
        if _cuenta_verificada(canal, destino) is not None:
            raise SorteoError(
                "contacto_registrado",
                f"Ya tienes una tarjeta con ese {'correo' if es_correo else 'celular'}. Entra a tu tarjeta.", 409,
            )

        campo = "correo" if canal == DesafioContacto.Canal.CORREO else "celular"
        cuenta = (
            CuentaFidelizacion.objects.select_for_update()
            .filter(estado=CuentaFidelizacion.Estado.PENDIENTE, **{campo: destino})
            .order_by("-creada_en").first()
        )
        datos = dict(nombres=nombres, apellidos=apellidos, correo=correo, celular=celular,
                     acepto_terminos_en=timezone.now() if acepta_terminos else None)
        if cuenta is None:
            cuenta = CuentaFidelizacion.objects.create(**datos)
        else:
            for k, v in datos.items():
                setattr(cuenta, k, v)
            cuenta.save()
        _auditar(cuenta, EventoAuditoria.Tipo.REGISTRO, detalle=f"canal={canal}")
        return _crear_desafio(cuenta, canal, destino, DesafioContacto.Proposito.REGISTRO, ip)


def recuperar(contacto: str, ip: str = "") -> DesafioContacto:
    """Pide un código para volver a entrar. Sin una tarjeta con ese contacto, responde «… inválido.»"""
    normalizado = normalizar_contacto(contacto)
    if normalizado is None:
        mensaje = mensaje_correo(contacto) if "@" in (contacto or "") else mensaje_celular(contacto)
        raise SorteoError("contacto_invalido", mensaje)
    canal, destino = normalizado
    canales.exigir_canal(canal)
    es_correo = canal == DesafioContacto.Canal.CORREO
    campo = "correo" if es_correo else "celular"
    with transaction.atomic():
        _bloquear_contacto(destino)
        cuenta = _cuenta_verificada(canal, destino)
        if cuenta is None:
            con_ese_dato = CuentaFidelizacion.objects.filter(**{campo: destino})
            if con_ese_dato.filter(estado=CuentaFidelizacion.Estado.BLOQUEADA, **{f"{campo}_verificado_en__isnull": False}).exists():
                raise SorteoError("cuenta_bloqueada", "Tu tarjeta está bloqueada. Pide ayuda en el mostrador.", 403)
            raise SorteoError("sin_tarjeta", f"{campo.capitalize()} inválido.", 404)
        return _crear_desafio(cuenta, canal, destino, DesafioContacto.Proposito.RECUPERAR, ip)


def reenviar(desafio_id, ip: str = "") -> DesafioContacto:
    """Otro código para el mismo contacto, también cuando el anterior se agotó o venció.

    Solo vale desde el último desafío del contacto y mientras no se haya acertado: uno ya verificado no se reutiliza.
    """
    antiguo = DesafioContacto.objects.select_related("cuenta").filter(desafio=desafio_id).first()
    if antiguo is None or antiguo.verificado_en is not None:
        raise SorteoError("desafio_invalido", "El código ya no es válido. Empieza de nuevo.")
    with transaction.atomic():
        _bloquear_contacto(antiguo.destino)
        if DesafioContacto.objects.filter(destino=antiguo.destino, creado_en__gt=antiguo.creado_en).exists():
            raise SorteoError("desafio_invalido", "El código ya no es válido. Empieza de nuevo.")
        return _crear_desafio(antiguo.cuenta, antiguo.canal, antiguo.destino, antiguo.proposito, ip)


def verificar(desafio_id, codigo: str) -> CuentaFidelizacion:
    """Valida el código. Si es correcto confirma el contacto (o la recuperación) y devuelve la cuenta."""
    error = None
    cuenta = None
    with transaction.atomic():
        desafio = DesafioContacto.objects.select_for_update().filter(desafio=desafio_id).first()
        if desafio is None or desafio.verificado_en is not None:
            raise SorteoError("desafio_invalido", "El código ya no es válido. Empieza de nuevo.")
        if desafio.usado:
            # Agotado, vencido o reemplazado por otro más nuevo: se arregla pidiendo un código (ver `reenviar`).
            raise SorteoError("codigo_agotado", "Este código ya no sirve. Pide otro.")
        if desafio.expira_en < timezone.now():
            desafio.usado = True
            desafio.save(update_fields=["usado"])
            error = SorteoError("codigo_vencido", "El código venció. Pide uno nuevo.")
        elif desafio.cuenta_id is None or not hmac.compare_digest(
            desafio.codigo_hash, hash_codigo_verificacion((codigo or "").strip()),
        ):
            desafio.intentos += 1
            agotado = desafio.intentos >= settings.CODIGO_VERIFICACION_INTENTOS
            desafio.usado = agotado
            desafio.save(update_fields=["intentos", "usado"])
            if agotado:
                error = SorteoError("demasiados_intentos", "Demasiados intentos. Pide un código nuevo.")
            else:
                restantes = settings.CODIGO_VERIFICACION_INTENTOS - desafio.intentos
                error = SorteoError("codigo_incorrecto", f"Código incorrecto. Te quedan {restantes} intento(s).")
        else:
            cuenta = _confirmar(desafio)
    if error is not None:  # fuera del atomic: el intento fallido debe quedar guardado
        raise error
    return cuenta


def _confirmar(desafio: DesafioContacto) -> CuentaFidelizacion:
    cuenta = CuentaFidelizacion.objects.select_for_update().get(pk=desafio.cuenta_id)
    if cuenta.estado == CuentaFidelizacion.Estado.BLOQUEADA:
        raise SorteoError("cuenta_bloqueada", "Tu tarjeta está bloqueada. Pide ayuda en el mostrador.", 403)
    ahora = timezone.now()
    desafio.usado = True
    desafio.verificado_en = ahora
    desafio.save(update_fields=["usado", "verificado_en"])
    if desafio.proposito == DesafioContacto.Proposito.REGISTRO:
        campo = "correo_verificado_en" if desafio.canal == DesafioContacto.Canal.CORREO else "celular_verificado_en"
        setattr(cuenta, campo, ahora)
        cuenta.estado = CuentaFidelizacion.Estado.ACTIVA
        try:
            with transaction.atomic():
                cuenta.save(update_fields=[campo, "estado"])
        except IntegrityError:
            raise SorteoError(
                "contacto_en_uso",
                f"Ese contacto ya tiene tarjeta. Usa «Recuperar mi tarjeta». {_MENSAJE_AYUDA}", 409,
            ) from None
        _auditar(cuenta, EventoAuditoria.Tipo.VERIFICACION, detalle=f"canal={desafio.canal}")
    else:
        cuenta.version_sesion += 1  # cierra las sesiones anteriores
        cuenta.save(update_fields=["version_sesion"])
        _auditar(cuenta, EventoAuditoria.Tipo.RECUPERACION, detalle=f"canal={desafio.canal}")
    asegurar_codigo(cuenta)
    return cuenta


def cerrar_sesiones(cuenta: CuentaFidelizacion) -> None:
    """Cierra la sesión del titular en todos sus dispositivos (el token deja de valer en el servidor)."""
    CuentaFidelizacion.objects.filter(pk=cuenta.pk).update(version_sesion=F("version_sesion") + 1)
    _auditar(cuenta, EventoAuditoria.Tipo.SESION_CERRADA)


def registrar_resolucion(cuenta: CuentaFidelizacion, usuario) -> None:
    """Deja rastro de quién consultó una tarjeta en caja."""
    detalle = f"empresa={usuario.empresa_id}" if usuario.empresa_id else "admin"
    _auditar(cuenta, EventoAuditoria.Tipo.RESOLUCION, actor=usuario, detalle=detalle)


def posibles_duplicados(cuenta: CuentaFidelizacion) -> int:
    """Otras cuentas que comparten el celular o el correo (también con alias: a+1@gmail.com, a.b@gmail.com)."""
    return (
        CuentaFidelizacion.objects.exclude(pk=cuenta.pk)
        .filter(Q(correo_canonico=correo_canonico(cuenta.correo)) | Q(celular=cuenta.celular)).count()
    )


def desbloquear_envios(cuenta: CuentaFidelizacion, actor=None) -> int:
    """Borra los códigos pedidos para los contactos de la cuenta: quien quedó bloqueado por el tope diario puede
    volver a pedir uno. Es la salida cuando alguien pidió códigos a nombre de otra persona."""
    borrados, _ = DesafioContacto.objects.filter(destino__in=[cuenta.correo, cuenta.celular]).delete()
    _auditar(cuenta, EventoAuditoria.Tipo.ENVIOS_DESBLOQUEADOS, actor=actor, detalle=f"desafios={borrados}")
    return borrados


def limpiar(dias_desafios: int = 2, dias_pendientes: int = 7, dias_auditoria: int = 180) -> tuple[int, int, int]:
    """Borra códigos de verificación viejos, cuentas que nunca se verificaron y las consultas de caja antiguas.

    Los desafíos de las últimas 24 h no se tocan: con ellos se calcula el tope diario de envíos. La auditoría de
    registro, verificación y revocación se conserva siempre; solo las consultas en caja (las más numerosas) caducan.
    """
    ahora = timezone.now()
    desafios, _ = DesafioContacto.objects.filter(
        creado_en__lt=ahora - timedelta(days=max(dias_desafios, 1)),
    ).delete()
    pendientes = CuentaFidelizacion.objects.filter(
        estado=CuentaFidelizacion.Estado.PENDIENTE, creada_en__lt=ahora - timedelta(days=max(dias_pendientes, 1)),
        correo_verificado_en__isnull=True, celular_verificado_en__isnull=True,
    )
    cuentas = pendientes.count()
    pendientes.delete()
    consultas, _ = EventoAuditoria.objects.filter(
        tipo=EventoAuditoria.Tipo.RESOLUCION, creado_en__lt=ahora - timedelta(days=max(dias_auditoria, 1)),
    ).delete()
    return desafios, cuentas, consultas


# --- código de la tarjeta ---------------------------------------------------------------------

def _crear_codigo(cuenta: CuentaFidelizacion, actor=None) -> CodigoTarjeta:
    for _ in range(10):
        try:
            with transaction.atomic():
                nuevo = CodigoTarjeta.objects.create(cuenta=cuenta, codigo=nuevo_codigo_tarjeta())
            _auditar(cuenta, EventoAuditoria.Tipo.CODIGO_EMITIDO, actor=actor, detalle=nuevo.codigo)
            return nuevo
        except IntegrityError:
            # Otra petición ya le dio su código a esta cuenta: se usa ese en vez de fallar.
            existente = cuenta.codigos.filter(activo=True).first()
            if existente is not None:
                return existente
    raise RuntimeError("No se pudo generar un código de tarjeta único.")


def asegurar_codigo(cuenta: CuentaFidelizacion) -> CodigoTarjeta:
    return cuenta.codigos.filter(activo=True).first() or _crear_codigo(cuenta)


def revocar_codigo(cuenta_id: int, actor, motivo: str) -> CodigoTarjeta:
    """Revoca el código activo y emite uno nuevo. El pase de Wallet conserva su `pase_id`: solo cambia el QR."""
    with transaction.atomic():
        cuenta = CuentaFidelizacion.objects.select_for_update().get(pk=cuenta_id)
        actual = cuenta.codigos.filter(activo=True).first()
        if actual is not None:
            actual.activo = False
            actual.revocado_en = timezone.now()
            actual.revocado_por = actor
            actual.motivo = motivo[:200]
            actual.save(update_fields=["activo", "revocado_en", "revocado_por", "motivo"])
            _auditar(cuenta, EventoAuditoria.Tipo.CODIGO_REVOCADO, actor=actor, detalle=f"{actual.codigo}: {motivo}")
        nuevo = _crear_codigo(cuenta, actor=actor)
        cuenta.pases.filter(estado_sync=PaseWallet.Sync.SINCRONIZADO).update(estado_sync=PaseWallet.Sync.PENDIENTE)
        return nuevo


def resolver_codigo(valor: str) -> CuentaFidelizacion:
    """Cuenta a la que pertenece un código activo. Inexistente, revocado o mal formado: misma respuesta."""
    codigo = normalizar_codigo_tarjeta(valor)
    registro = (
        CodigoTarjeta.objects.select_related("cuenta").filter(codigo=codigo, activo=True).first() if codigo else None
    )
    if registro is None or registro.cuenta.estado != CuentaFidelizacion.Estado.ACTIVA:
        raise SorteoError("qr_invalido", "Esta tarjeta no es válida. Pide al cliente que abra su tarjeta de nuevo.", 404)
    return registro.cuenta


# --- progreso ---------------------------------------------------------------------------------

def total_aprobado(cuenta: CuentaFidelizacion, campania: Campania) -> Decimal:
    """Compras aprobadas netas de devoluciones. Aún no existe el registro de compras (entrega 2): 0."""
    return Decimal("0")


def calcular_progreso(total, bs_por_punto, pendientes: int = 0) -> dict:
    """puntos = floor(total / Bs por punto); el sobrante se conserva. Todo en Decimal."""
    bs = Decimal(bs_por_punto)
    if bs <= 0:
        raise ValueError("Los Bs por punto deben ser mayores que cero.")
    total = max(Decimal(total), Decimal("0"))
    puntos = int((total / bs).to_integral_value(rounding=ROUND_FLOOR))
    sobrante = total - bs * puntos
    return {
        "total_aprobado": str(total.quantize(_CENT)),
        "puntos": puntos,
        "participaciones": puntos,
        "sobrante": str(sobrante.quantize(_CENT)),
        "faltan": str((bs - sobrante).quantize(_CENT)),
        "pendientes": pendientes,
    }


def datos_campania(campania: Campania | None) -> dict:
    """Campaña para mostrar. `estado` dice por qué no hay una activa: PAUSADA, CERRADA o SIN_CAMPANIA."""
    if campania is not None:
        return {
            "activa": True,
            "estado": Campania.Estado.ACTIVA.value,
            "nombre": campania.nombre,
            "bs_por_punto": str(campania.bs_por_punto.quantize(_CENT)),
            "fecha_sorteo": campania.fecha_sorteo.isoformat() if campania.fecha_sorteo else None,
        }
    ultima = Campania.objects.exclude(estado=Campania.Estado.BORRADOR).order_by("-creada_en").first()
    return {
        "activa": False,
        "estado": ultima.estado if ultima else "SIN_CAMPANIA",
        "nombre": ultima.nombre if ultima else None,
        "bs_por_punto": None,
        "fecha_sorteo": ultima.fecha_sorteo.isoformat() if ultima and ultima.fecha_sorteo else None,
    }


def estado_pases(cuenta: CuentaFidelizacion) -> dict:
    google = cuenta.pases.filter(plataforma=PaseWallet.Plataforma.GOOGLE).first()
    return {
        "google": google.estado_sync if google else PaseWallet.Sync.SIN_EMITIR,
        "apple": "NO_DISPONIBLE",  # falta la cuenta de desarrollador y los certificados
    }


def datos_tarjeta(cuenta: CuentaFidelizacion) -> dict:
    campania = campania_activa()
    codigo = asegurar_codigo(cuenta)
    progreso = (
        calcular_progreso(total_aprobado(cuenta, campania), campania.bs_por_punto) if campania else None
    )
    return {
        "codigo": codigo.codigo,
        "primer_nombre": cuenta.primer_nombre,
        "campania": datos_campania(campania),
        "progreso": progreso,
        "pases": estado_pases(cuenta),
    }
