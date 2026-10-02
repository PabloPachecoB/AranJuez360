from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Usuario


@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    list_display = ("username", "email", "rol", "empresa", "puntos_saldo", "is_active")
    list_filter = ("rol", "is_active")
    fieldsets = UserAdmin.fieldsets + (
        ("Paseo 360", {"fields": ("rol", "empresa", "celular", "puntos_saldo", "debe_cambiar_password")}),
    )
