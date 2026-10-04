from django.contrib import admin

from .models import Espacio, Evento, Funcion, Pelicula, Propuesta, ReservaCine, ReservaEvento


class FuncionInline(admin.TabularInline):
    model = Funcion
    extra = 1


@admin.register(Pelicula)
class PeliculaAdmin(admin.ModelAdmin):
    list_display = ("titulo", "genero", "clasificacion", "duracion_min", "estreno", "activo")
    list_filter = ("activo", "estreno")
    inlines = [FuncionInline]


@admin.register(Evento)
class EventoAdmin(admin.ModelAdmin):
    list_display = ("titulo", "categoria", "inicio", "lugar", "espacio", "cupos", "destacado", "activo")
    list_filter = ("categoria", "destacado", "activo", "espacio")


@admin.register(ReservaCine)
class ReservaCineAdmin(admin.ModelAdmin):
    list_display = ("codigo", "cliente", "funcion", "cantidad", "metodo", "monedas", "estado", "creado_en")
    list_filter = ("estado", "metodo")


@admin.register(Espacio)
class EspacioAdmin(admin.ModelAdmin):
    list_display = ("nombre", "lugar", "capacidad", "activo")


@admin.register(Propuesta)
class PropuestaAdmin(admin.ModelAdmin):
    list_display = ("titulo", "artista", "espacio", "inicio", "personas", "acceso", "estado", "creado_en")
    list_filter = ("estado", "tipo", "espacio")
    search_fields = ("titulo", "artista", "solicitante__email")


@admin.register(ReservaEvento)
class ReservaEventoAdmin(admin.ModelAdmin):
    list_display = ("codigo", "evento", "cliente", "cantidad", "estado", "ingreso_en", "creado_en")
    list_filter = ("estado",)
