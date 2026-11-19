from django.contrib import admin

from .models import Invitacion


@admin.register(Invitacion)
class InvitacionAdmin(admin.ModelAdmin):
    list_display = ("codigo", "visitante_nombre", "oficina", "fecha", "hora", "origen", "estado", "ingreso_en")
    list_filter = ("estado", "origen", "oficina")
    search_fields = ("visitante_nombre", "visitante_ci", "codigo")
