from rest_framework.permissions import BasePermission

from .models import Usuario


class _RolPermission(BasePermission):
    roles: tuple = ()
    requiere_empresa = False

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated and user.rol in self.roles):
            return False
        return not self.requiere_empresa or user.empresa_id is not None


class EsAdmin(_RolPermission):
    roles = (Usuario.Rol.ADMIN,)


class EsPortero(_RolPermission):
    roles = (Usuario.Rol.PORTERO,)


class EsCliente(_RolPermission):
    roles = (Usuario.Rol.CLIENTE,)


class EsEmpresa(_RolPermission):
    """Responsable de un negocio/emprendimiento u oficina (edita su ficha)."""

    roles = (Usuario.Rol.NEGOCIO, Usuario.Rol.OFICINA)
    requiere_empresa = True


class EsCaja(_RolPermission):
    """Quien atiende caja en un negocio: el responsable o un cajero. Las oficinas no tienen caja."""

    roles = (Usuario.Rol.NEGOCIO, Usuario.Rol.CAJERO)
    requiere_empresa = True
