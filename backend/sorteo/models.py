import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q

from .texto import correo_canonico, iniciales_apellidos


class Campania(models.Model):
    """Campaña del Sorteo Paseo. Sus reglas se fijan al lanzarla (para otra estrategia, otra campaña)."""

    class Estado(models.TextChoices):
        BORRADOR = "BORRADOR", "Borrador"
        ACTIVA = "ACTIVA", "Activa"
        PAUSADA = "PAUSADA", "Pausada"
        CERRADA = "CERRADA", "Cerrada"

    CAMPOS_BLOQUEADOS = ("bs_por_punto", "inicio", "cierre", "fecha_sorteo")

    nombre = models.CharField(max_length=80, default="Sorteo Paseo")
    estado = models.CharField(max_length=10, choices=Estado.choices, default=Estado.BORRADOR, db_index=True)
    bs_por_punto = models.DecimalField(
        "Bs por punto", max_digits=10, decimal_places=2, default=200,
        help_text="Cada tanto en compras aprobadas equivale a 1 punto y 1 participación.",
    )
    inicio = models.DateField(null=True, blank=True)
    cierre = models.DateField(null=True, blank=True)
    fecha_sorteo = models.DateField(null=True, blank=True)
    lanzada_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+",
    )
    lanzada_en = models.DateTimeField(null=True, blank=True)
    creada_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-creada_en"]
        verbose_name = "campaña"
        constraints = [
            models.UniqueConstraint(
                fields=["estado"], condition=Q(estado="ACTIVA"), name="sorteo_una_campania_activa",
                violation_error_message="Ya hay otra campaña activa: páusala o ciérrala primero.",
            ),
            models.CheckConstraint(check=Q(bs_por_punto__gt=0), name="sorteo_bs_por_punto_positivo"),
        ]

    def __str__(self):
        return f"{self.nombre} ({self.get_estado_display()})"

    def _validar_reglas_bloqueadas(self):
        if not self.pk:
            return
        previa = Campania.objects.filter(pk=self.pk).first()
        if previa is None or previa.estado == self.Estado.BORRADOR:
            return
        cambiados = [c for c in self.CAMPOS_BLOQUEADOS if getattr(previa, c) != getattr(self, c)]
        if cambiados:
            raise ValidationError(
                "Las reglas de una campaña lanzada no se pueden cambiar (%s). Crea una campaña nueva."
                % ", ".join(cambiados)
            )

    def _validar_fechas(self):
        """El orden natural: inicio ≤ cierre ≤ sorteo (las que estén definidas)."""
        errores = {}
        if self.inicio and self.cierre and self.cierre < self.inicio:
            errores["cierre"] = "El cierre no puede ser anterior al inicio."
        limite = self.cierre or self.inicio
        if self.fecha_sorteo and limite and self.fecha_sorteo < limite:
            errores["fecha_sorteo"] = "El sorteo no puede ser anterior al %s de la campaña." % (
                "cierre" if self.cierre else "inicio"
            )
        if errores:
            raise ValidationError(errores)

    def clean(self):
        super().clean()
        self._validar_reglas_bloqueadas()
        self._validar_fechas()

    def save(self, *args, **kwargs):
        self._validar_reglas_bloqueadas()
        super().save(*args, **kwargs)


class CuentaFidelizacion(models.Model):
    """Cuenta del cliente en el sorteo. Es independiente de `Usuario`: la tarjeta se usa antes que la app."""

    class Estado(models.TextChoices):
        PENDIENTE = "PENDIENTE", "Pendiente de verificar"
        ACTIVA = "ACTIVA", "Activa"
        BLOQUEADA = "BLOQUEADA", "Bloqueada"

    referencia = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    nombres = models.CharField(max_length=80)
    apellidos = models.CharField(max_length=80)
    correo = models.EmailField()
    # Correo sin «+etiqueta» (y sin puntos en Gmail): solo para señalar tarjetas repetidas con alias.
    correo_canonico = models.CharField(max_length=254, blank=True, db_index=True, editable=False)
    correo_verificado_en = models.DateTimeField(null=True, blank=True)
    # Bolivia: 8 dígitos sin prefijo. Otro país: «+» y los dígitos con su prefijo (E.164, hasta 15 dígitos).
    celular = models.CharField(
        max_length=16, help_text="Bolivia: 8 dígitos, sin +591. Otro país: con su prefijo, por ejemplo +5491123456789.",
    )
    celular_verificado_en = models.DateTimeField(null=True, blank=True)
    estado = models.CharField(max_length=10, choices=Estado.choices, default=Estado.PENDIENTE, db_index=True)
    usuario = models.OneToOneField(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="cuenta_fidelizacion", help_text="Vínculo opcional con la cuenta de la app.",
    )
    acepto_terminos_en = models.DateTimeField(null=True, blank=True)
    # Sube al recuperar la cuenta: cierra las sesiones anteriores.
    version_sesion = models.PositiveIntegerField(default=1)
    creada_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-creada_en"]
        verbose_name = "cuenta de fidelización"
        verbose_name_plural = "cuentas de fidelización"
        constraints = [
            # Solo un contacto VERIFICADO identifica a una persona; uno sin verificar no bloquea a nadie.
            models.UniqueConstraint(
                fields=["correo"], condition=Q(correo_verificado_en__isnull=False),
                name="sorteo_correo_verificado_unico",
                violation_error_message="Ese correo ya está verificado en otra tarjeta.",
            ),
            models.UniqueConstraint(
                fields=["celular"], condition=Q(celular_verificado_en__isnull=False),
                name="sorteo_celular_verificado_unico",
                violation_error_message="Ese celular ya está verificado en otra tarjeta.",
            ),
        ]

    def __str__(self):
        return f"{self.nombres} {self.apellidos}"

    def save(self, *args, **kwargs):
        """Mantiene el correo canónico y quita la verificación de un contacto cuando este cambia.

        «Verificado» significa que la persona demostró que ese correo o celular es suyo. Si alguien lo edita (p. ej.
        desde el admin), el contacto nuevo no está comprobado: de seguir marcado, su dueño real recibiría códigos
        que abren esta tarjeta. Los contactos que perdieron la verificación quedan en `contactos_desverificados`.
        """
        self.correo_canonico = correo_canonico(self.correo)
        self.contactos_desverificados = []
        campos = kwargs.get("update_fields")
        extra = set()
        if self.pk and (campos is None or {"correo", "celular"} & set(campos)):
            previo = type(self).objects.filter(pk=self.pk).values("correo", "celular").first()
            for campo in ("correo", "celular"):
                marca = f"{campo}_verificado_en"
                if previo and previo[campo] != getattr(self, campo) and getattr(self, marca) is not None:
                    setattr(self, marca, None)
                    extra.add(marca)
                    self.contactos_desverificados.append(campo)
        if campos is not None:
            if "correo" in campos:
                extra.add("correo_canonico")
            kwargs["update_fields"] = {*campos, *extra}
        super().save(*args, **kwargs)

    @property
    def nombre_completo(self):
        return f"{self.nombres} {self.apellidos}".strip()

    @property
    def primer_nombre(self):
        return (self.nombres or "").strip().split(" ")[0]

    @property
    def nombre_reducido(self):
        """Primer nombre e iniciales de los apellidos, para mostrar a caja: «María G. P.»."""
        return f"{self.primer_nombre} {iniciales_apellidos(self.apellidos)}".strip()


class CodigoTarjeta(models.Model):
    """Código opaco y revocable del QR de la tarjeta. No contiene ningún dato de la persona."""

    cuenta = models.ForeignKey(CuentaFidelizacion, on_delete=models.CASCADE, related_name="codigos")
    codigo = models.CharField(max_length=12, unique=True)
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    revocado_en = models.DateTimeField(null=True, blank=True)
    revocado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+",
    )
    motivo = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ["-creado_en"]
        constraints = [
            models.UniqueConstraint(
                fields=["cuenta"], condition=Q(activo=True), name="sorteo_un_codigo_activo_por_cuenta",
            ),
        ]

    def __str__(self):
        return f"{self.codigo} ({'activo' if self.activo else 'revocado'})"


class PaseWallet(models.Model):
    """Estado del pase de una cuenta en Google o Apple Wallet. El `pase_id` no cambia al revocar el código."""

    class Plataforma(models.TextChoices):
        GOOGLE = "GOOGLE", "Google Wallet"
        APPLE = "APPLE", "Apple Wallet"

    class Sync(models.TextChoices):
        SIN_EMITIR = "SIN_EMITIR", "Sin emitir"
        PENDIENTE = "PENDIENTE", "Pendiente de actualizar"
        SINCRONIZADO = "SINCRONIZADO", "Sincronizado"
        ERROR = "ERROR", "Con error"

    cuenta = models.ForeignKey(CuentaFidelizacion, on_delete=models.CASCADE, related_name="pases")
    plataforma = models.CharField(max_length=10, choices=Plataforma.choices)
    pase_id = models.CharField(max_length=40, unique=True)
    estado_sync = models.CharField(max_length=12, choices=Sync.choices, default=Sync.SIN_EMITIR)
    sincronizado_en = models.DateTimeField(null=True, blank=True)
    intentos = models.PositiveIntegerField(default=0)
    ultimo_error = models.CharField(max_length=300, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["cuenta", "plataforma"], name="sorteo_un_pase_por_plataforma"),
        ]

    def __str__(self):
        return f"{self.get_plataforma_display()} · {self.pase_id} · {self.estado_sync}"


class DesafioContacto(models.Model):
    """Código de 6 dígitos enviado a un contacto para verificarlo o recuperar la cuenta."""

    class Canal(models.TextChoices):
        CORREO = "CORREO", "Correo"
        CELULAR = "CELULAR", "Celular"

    class Proposito(models.TextChoices):
        REGISTRO = "REGISTRO", "Verificar contacto al registrarse"
        RECUPERAR = "RECUPERAR", "Recuperar la cuenta"

    desafio = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    # Vacío cuando se pide recuperar un contacto que no existe: la respuesta no debe delatarlo.
    cuenta = models.ForeignKey(
        CuentaFidelizacion, null=True, blank=True, on_delete=models.CASCADE, related_name="desafios",
    )
    canal = models.CharField(max_length=8, choices=Canal.choices)
    destino = models.CharField(max_length=254, db_index=True)
    proposito = models.CharField(max_length=10, choices=Proposito.choices)
    codigo_hash = models.CharField(max_length=64)
    expira_en = models.DateTimeField()
    intentos = models.PositiveSmallIntegerField(default=0)
    usado = models.BooleanField(default=False)
    # Solo se llena cuando el código se acertó: un desafío agotado o vencido todavía permite pedir otro código.
    verificado_en = models.DateTimeField(null=True, blank=True)
    # Huella de la IP que lo pidió (no la dirección): topa los envíos por IP para un mismo contacto.
    ip_hash = models.CharField(max_length=64, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-creado_en"]

    def __str__(self):
        return f"{self.canal} {self.destino} ({self.proposito})"


class EventoAuditoria(models.Model):
    class Tipo(models.TextChoices):
        REGISTRO = "REGISTRO", "Registro"
        VERIFICACION = "VERIFICACION", "Contacto verificado"
        RECUPERACION = "RECUPERACION", "Cuenta recuperada"
        CODIGO_EMITIDO = "CODIGO_EMITIDO", "Código de tarjeta emitido"
        CODIGO_REVOCADO = "CODIGO_REVOCADO", "Código de tarjeta revocado"
        WALLET_PUBLICADO = "WALLET_PUBLICADO", "Pase publicado en Wallet"
        WALLET_ERROR = "WALLET_ERROR", "Error al publicar el pase"
        RESOLUCION = "RESOLUCION", "Tarjeta consultada en caja"
        SESION_CERRADA = "SESION_CERRADA", "Sesión cerrada por el titular"
        ENVIOS_DESBLOQUEADOS = "ENVIOS_DESBLOQUEADOS", "Envíos de código desbloqueados"

    cuenta = models.ForeignKey(CuentaFidelizacion, on_delete=models.CASCADE, related_name="eventos")
    tipo = models.CharField(max_length=20, choices=Tipo.choices)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+",
    )
    detalle = models.CharField(max_length=300, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-creado_en"]

    def __str__(self):
        return f"{self.get_tipo_display()} · {self.cuenta_id}"
