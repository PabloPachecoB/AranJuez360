from django import forms
from django.contrib import admin, messages
from django.db import IntegrityError
from django.db.models import Count, OuterRef, Q, Subquery, Value
from django.db.models.functions import Coalesce
from django.utils import timezone

from . import pase, services
from .models import Campania, CodigoTarjeta, CuentaFidelizacion, EventoAuditoria, PaseWallet
from .texto import limpiar_nombre


@admin.register(Campania)
class CampaniaAdmin(admin.ModelAdmin):
    list_display = ("nombre", "estado", "bs_por_punto", "inicio", "cierre", "fecha_sorteo", "lanzada_en")
    list_filter = ("estado",)
    readonly_fields = ("lanzada_por", "lanzada_en")
    actions = ["lanzar", "pausar", "cerrar"]

    @admin.action(description="Lanzar campaña (las reglas quedan fijas)")
    def lanzar(self, request, queryset):
        for campania in queryset.filter(estado__in=[Campania.Estado.BORRADOR, Campania.Estado.PAUSADA]):
            primera = campania.estado == Campania.Estado.BORRADOR
            campania.estado = Campania.Estado.ACTIVA
            if primera:
                campania.lanzada_por, campania.lanzada_en = request.user, timezone.now()
            try:
                campania.save()
            except IntegrityError:
                self.message_user(request, "Ya hay otra campaña activa: páusala o ciérrala primero.", messages.ERROR)
                return
        self.message_user(request, "Campaña lanzada.", messages.SUCCESS)

    @admin.action(description="Pausar (deja de registrar compras nuevas)")
    def pausar(self, request, queryset):
        queryset.filter(estado=Campania.Estado.ACTIVA).update(estado=Campania.Estado.PAUSADA)

    @admin.action(description="Cerrar campaña")
    def cerrar(self, request, queryset):
        queryset.exclude(estado=Campania.Estado.CERRADA).update(estado=Campania.Estado.CERRADA)


class CodigoInline(admin.TabularInline):
    model = CodigoTarjeta
    extra = 0
    can_delete = False
    readonly_fields = ("codigo", "activo", "creado_en", "revocado_en", "revocado_por", "motivo")

    def has_add_permission(self, request, obj=None):
        return False


class CuentaForm(forms.ModelForm):
    """Las mismas reglas del registro público: el admin no puede guardar datos que la página rechazaría."""

    class Meta:
        model = CuentaFidelizacion
        fields = "__all__"

    def _nombre(self, campo):
        try:
            return limpiar_nombre(self.cleaned_data[campo])
        except ValueError as exc:
            raise forms.ValidationError(str(exc)) from exc

    def clean_nombres(self):
        return self._nombre("nombres")

    def clean_apellidos(self):
        return self._nombre("apellidos")

    def clean_correo(self):
        valor = self.cleaned_data["correo"]
        correo = services.normalizar_correo(valor)
        if correo is None:
            raise forms.ValidationError(services.mensaje_correo(valor))
        return correo

    def clean_celular(self):
        valor = self.cleaned_data["celular"]
        celular = services.normalizar_celular(valor)
        if celular is None:
            raise forms.ValidationError(services.mensaje_celular(valor))
        return celular

    def clean(self):
        datos = super().clean()
        cuenta = self.instance
        if datos.get("estado") == CuentaFidelizacion.Estado.PENDIENTE and cuenta.pk and (
            cuenta.correo_verificado_en or cuenta.celular_verificado_en
        ):
            self.add_error("estado", "Una cuenta con un contacto verificado no puede volver a «pendiente»: bloquéala si hace falta.")
        return datos


@admin.register(CuentaFidelizacion)
class CuentaAdmin(admin.ModelAdmin):
    form = CuentaForm
    list_display = ("nombres", "apellidos", "correo", "celular", "estado", "duplicados", "creada_en")
    list_filter = ("estado",)
    search_fields = ("nombres", "apellidos", "correo", "celular", "codigos__codigo")
    readonly_fields = ("referencia", "correo_verificado_en", "celular_verificado_en", "version_sesion", "creada_en")
    inlines = [CodigoInline]
    actions = ["revocar_codigo", "desbloquear_envios"]

    def get_queryset(self, request):
        # «Posibles duplicados» en una sola consulta (antes, una por fila del listado).
        otras = (
            CuentaFidelizacion.objects.filter(Q(correo_canonico=OuterRef("correo_canonico")) | Q(celular=OuterRef("celular")))
            .exclude(pk=OuterRef("pk")).order_by().values(uno=Value(1)).annotate(n=Count("pk")).values("n")
        )
        return super().get_queryset(request).annotate(_duplicados=Coalesce(Subquery(otras), 0))

    @admin.display(description="Posibles duplicados", ordering="_duplicados")
    def duplicados(self, obj):
        """Otras cuentas con el mismo correo (o un alias) o el mismo celular: revisar antes de entregar un premio."""
        return f"⚠ {obj._duplicados}" if obj._duplicados else "—"

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        quitados = getattr(obj, "contactos_desverificados", [])
        if quitados:
            self.message_user(
                request,
                f"Cambiaste el {' y el '.join(quitados)} de {obj}: quedó SIN verificar, porque nadie comprobó que el "
                "contacto nuevo sea de esta persona. No sirve para recuperar la tarjeta hasta que se verifique.",
                messages.WARNING,
            )

    @admin.action(description="Desbloquear los envíos de código (si alguien pidió códigos a su nombre)")
    def desbloquear_envios(self, request, queryset):
        for cuenta in queryset:
            n = services.desbloquear_envios(cuenta, request.user)
            self.message_user(request, f"{cuenta}: se borraron {n} códigos pedidos; ya puede pedir uno nuevo.", messages.SUCCESS)

    @admin.action(description="Revocar el código de la tarjeta y emitir uno nuevo")
    def revocar_codigo(self, request, queryset):
        for cuenta in queryset:
            nuevo = services.revocar_codigo(cuenta.pk, request.user, "Revocado desde el admin")
            pase.resincronizar_si_existe(cuenta)
            self.message_user(request, f"{cuenta}: nuevo código {nuevo.codigo}", messages.SUCCESS)


@admin.register(PaseWallet)
class PaseWalletAdmin(admin.ModelAdmin):
    list_display = ("pase_id", "cuenta", "plataforma", "estado_sync", "sincronizado_en", "intentos")
    list_filter = ("plataforma", "estado_sync")
    readonly_fields = ("pase_id", "ultimo_error")


@admin.register(EventoAuditoria)
class EventoAuditoriaAdmin(admin.ModelAdmin):
    list_display = ("creado_en", "tipo", "cuenta", "actor", "detalle")
    list_filter = ("tipo",)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
