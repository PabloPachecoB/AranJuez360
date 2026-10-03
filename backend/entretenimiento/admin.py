from django.contrib import admin

from .models import Evento, Funcion, Pelicula, ReservaCine


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
    list_display = ("titulo", "categoria", "inicio", "lugar", "destacado", "activo")
    list_filter = ("categoria", "destacado", "activo")


@admin.register(ReservaCine)
class ReservaCineAdmin(admin.ModelAdmin):
    list_display = ("codigo", "cliente", "funcion", "cantidad", "metodo", "monedas", "estado", "creado_en")
    list_filter = ("estado", "metodo")
