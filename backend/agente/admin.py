from django.contrib import admin

from .models import AgentAction, ConversacionJarvis, MensajeJarvis


class _SoloLecturaAuditoriaAdmin(admin.ModelAdmin):
    """Permite consultar el historial sin alterarlo ni borrarlo desde Admin."""

    def has_view_permission(self, request, obj=None):
        return request.user.has_perm(
            f"{self.opts.app_label}.view_{self.opts.model_name}"
        )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(ConversacionJarvis)
class ConversacionJarvisAdmin(_SoloLecturaAuditoriaAdmin):
    list_display = ("id", "usuario", "titulo", "creada_en", "actualizada_en", "archivada_en")
    list_filter = ("archivada_en",)
    search_fields = ("titulo", "usuario__email", "usuario__username")
    readonly_fields = ("id", "usuario", "titulo", "creada_en", "actualizada_en", "archivada_en")

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("usuario")


@admin.register(MensajeJarvis)
class MensajeJarvisAdmin(_SoloLecturaAuditoriaAdmin):
    list_display = ("id", "conversacion", "rol", "origen", "creado_en")
    list_filter = ("rol", "origen")
    search_fields = ("contenido", "conversacion__titulo", "conversacion__usuario__email")
    readonly_fields = ("conversacion", "rol", "contenido", "origen", "metadatos", "creado_en")

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("conversacion", "conversacion__usuario")


@admin.register(AgentAction)
class AgentActionAdmin(admin.ModelAdmin):
    list_display = ("id", "tipo_accion", "estado", "conversacion", "usuario", "fecha_creacion")
    list_filter = ("estado", "tipo_accion")
    search_fields = ("conversacion__titulo", "usuario__email", "usuario__username")
    exclude = ("thread_id",)

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("conversacion", "usuario")
