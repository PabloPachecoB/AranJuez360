from django.contrib import admin

from .models import ConfiguracionPuntos, MovimientoPuntos, SolicitudPuntos, Visita


@admin.register(SolicitudPuntos)
class SolicitudPuntosAdmin(admin.ModelAdmin):
    list_display = ("id", "cliente", "empresa", "nit", "monto", "estado", "puntos", "creado_en")
    list_filter = ("estado", "empresa")


@admin.register(MovimientoPuntos)
class MovimientoPuntosAdmin(admin.ModelAdmin):
    list_display = ("id", "cliente", "empresa", "puntos", "tipo", "creado_en")
    list_filter = ("tipo",)


@admin.register(Visita)
class VisitaAdmin(admin.ModelAdmin):
    list_display = ("id", "cliente", "portero", "puntos", "creado_en")


admin.site.register(ConfiguracionPuntos)
