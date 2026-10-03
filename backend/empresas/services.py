"""Lógica de dominio de empresas: alta por el admin y código QR/NFC."""

from django.db import transaction

from usuarios import services as cuentas
from usuarios.models import Usuario

from .models import Empresa, _nuevo_codigo_fidelizacion


def rol_responsable(empresa: Empresa) -> str:
    return Usuario.Rol.OFICINA if empresa.tipo == Empresa.Tipo.OFICINA else Usuario.Rol.NEGOCIO


@transaction.atomic
def crear_empresa_con_acceso(**datos_empresa) -> Empresa:
    """Crea la empresa y su usuario responsable, y le envía las credenciales."""
    empresa = Empresa.objects.create(**datos_empresa)
    cuentas.crear_cuenta_con_acceso(
        empresa.email_contacto, rol_responsable(empresa), empresa.nombre, empresa=empresa
    )
    return empresa


@transaction.atomic
def registrar_negocio_propio(*, nombre, tipo, categoria, email, telefono, password) -> Usuario:
    """Autorregistro: a diferencia de crear_empresa_con_acceso (alta manual del
    admin con contraseña temporal), acá el negocio/emprendimiento elige su
    propia contraseña y no espera aprobación — pensado para un emprendimiento
    que viene por poco tiempo y no puede esperar un alta manual."""
    empresa = Empresa.objects.create(
        nombre=nombre, tipo=tipo, categoria=categoria, email_contacto=email, telefono=telefono,
    )
    usuario = Usuario(
        username=email, email=email, rol=rol_responsable(empresa), empresa=empresa,
    )
    usuario.set_password(password)
    usuario.save()
    return usuario


def reenviar_acceso(empresa: Empresa) -> Usuario:
    """Genera una nueva contraseña temporal para el responsable y la reenvía."""
    usuario = empresa.usuarios.get(rol=rol_responsable(empresa))
    return cuentas.reenviar_acceso(usuario, empresa.nombre)


def regenerar_codigo_fidelizacion(empresa: Empresa) -> Empresa:
    """Invalida el QR/NFC actual (p. ej. si se filtró una foto del QR)."""
    empresa.codigo_fidelizacion = _nuevo_codigo_fidelizacion()
    empresa.save(update_fields=["codigo_fidelizacion"])
    return empresa
