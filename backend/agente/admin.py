from django.contrib import admin

from .models import AgentAction


@admin.register(AgentAction)
class AgentActionAdmin(admin.ModelAdmin):
    list_display = ("id", "tipo_accion", "estado", "usuario", "fecha_creacion")
    list_filter = ("estado", "tipo_accion")
