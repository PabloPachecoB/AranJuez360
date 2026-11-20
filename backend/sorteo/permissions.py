from rest_framework.permissions import BasePermission

from usuarios.models import Usuario

from .sesion import TitularTarjeta


class EsTitular(BasePermission):
    """Persona con una sesión de tarjeta válida (no un usuario de los paneles)."""

    def has_permission(self, request, view):
        return isinstance(request.user, TitularTarjeta)


class PuedeResolverTarjeta(BasePermission):
    """Quien puede resolver un código de tarjeta: el admin o la caja de un negocio con empresa activa."""

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated) or isinstance(user, TitularTarjeta):
            return False
        if user.rol == Usuario.Rol.ADMIN:
            return True
        if user.rol in (Usuario.Rol.NEGOCIO, Usuario.Rol.CAJERO):
            return user.empresa_id is not None and bool(user.empresa.activo)
        return False
