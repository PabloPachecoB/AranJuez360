from django.contrib import admin

from .models import (
    ConfiguracionPuntos,
    MovimientoPuntos,
    PuntoEscaneo,
    RangoCompra,
    Recompensa,
    SolicitudPuntos,
    Visita,
)


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
    list_display = ("id", "cliente", "portero", "punto", "puntos", "creado_en")


admin.site.register(ConfiguracionPuntos)


@admin.register(Recompensa)
class RecompensaAdmin(admin.ModelAdmin):
    list_display = ("nombre", "categoria", "costo_puntos", "empresa", "activo")
    list_filter = ("activo", "categoria")


@admin.register(PuntoEscaneo)
class PuntoEscaneoAdmin(admin.ModelAdmin):
    list_display = ("nombre", "tipo", "monedas", "horas_espera", "codigo", "activo")
    list_filter = ("tipo", "activo")
    readonly_fields = ("codigo",)


@admin.register(RangoCompra)
class RangoCompraAdmin(admin.ModelAdmin):
    list_display = ("monto_minimo", "monto_maximo", "monedas", "activo")
