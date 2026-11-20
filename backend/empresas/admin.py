from django.contrib import admin

from .models import Categoria, Empresa, Horario, Oferta, Producto


class HorarioInline(admin.TabularInline):
    model = Horario
    extra = 0


@admin.register(Empresa)
class EmpresaAdmin(admin.ModelAdmin):
    list_display = ("nombre", "tipo", "categoria", "piso", "local", "activo")
    list_filter = ("tipo", "activo", "categoria")
    search_fields = ("nombre", "email_contacto")
    readonly_fields = ("codigo_fidelizacion",)
    inlines = [HorarioInline]


admin.site.register(Categoria)
admin.site.register(Producto)
admin.site.register(Oferta)
