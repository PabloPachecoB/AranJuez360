from django.contrib import admin

from .models import Pedido, PedidoItem


class PedidoItemInline(admin.TabularInline):
    model = PedidoItem
    extra = 0


@admin.register(Pedido)
class PedidoAdmin(admin.ModelAdmin):
    list_display = ["codigo_retiro", "cliente", "empresa", "estado", "total", "creado_en"]
    list_filter = ["estado", "empresa"]
    search_fields = ["codigo_retiro", "cliente__username", "cliente__email"]
    inlines = [PedidoItemInline]
