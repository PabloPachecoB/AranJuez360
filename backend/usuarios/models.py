import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models


class Usuario(AbstractUser):
    """Usuario de Paseo Aranjuez 360.

    - ADMIN: administración del Paseo (vista administrativa).
    - PORTERO: guardia de entrada; registra visitas de clientes (suman puntos).
    - CLIENTE: usuario principal de la app; acumula puntos por visitas y compras.
    - NEGOCIO: responsable de un negocio o emprendimiento; ficha, productos y caja.
    - CAJERO: personal de caja de un negocio; solo atiende solicitudes de puntos.
    - OFICINA: responsable de una oficina en alquiler; ficha y servicios propios.
    """

    class Rol(models.TextChoices):
        ADMIN = "ADMIN", "Administrador"
        PORTERO = "PORTERO", "Portero"
        CLIENTE = "CLIENTE", "Cliente"
        NEGOCIO = "NEGOCIO", "Negocio"
        CAJERO = "CAJERO", "Cajero"
        OFICINA = "OFICINA", "Oficina"

    class Procedencia(models.TextChoices):
        """De dónde viene el cliente: provincias del departamento de Cochabamba u otro lugar."""

        CERCADO = "CERCADO", "Cercado (ciudad de Cochabamba)"
        QUILLACOLLO = "QUILLACOLLO", "Quillacollo (Quillacollo, Tiquipaya, Vinto, Colcapirhua, Sipe Sipe)"
        CHAPARE = "CHAPARE", "Chapare (Sacaba, Colomi, Villa Tunari)"
        ARANI = "ARANI", "Arani"
        ARQUE = "ARQUE", "Arque"
        AYOPAYA = "AYOPAYA", "Ayopaya"
        BOLIVAR = "BOLIVAR", "Bolívar"
        CAPINOTA = "CAPINOTA", "Capinota"
        CARRASCO = "CARRASCO", "Carrasco"
        ESTEBAN_ARCE = "ESTEBAN_ARCE", "Esteban Arce"
        GERMAN_JORDAN = "GERMAN_JORDAN", "Germán Jordán"
        MIZQUE = "MIZQUE", "Mizque"
        NARCISO_CAMPERO = "NARCISO_CAMPERO", "Narciso Campero"
        PUNATA = "PUNATA", "Punata"
        TAPACARI = "TAPACARI", "Tapacarí"
        TIRAQUE = "TIRAQUE", "Tiraque"
        OTRO = "OTRO", "Otro lugar (fuera de Cochabamba)"

    rol = models.CharField(max_length=20, choices=Rol.choices, default=Rol.CLIENTE)
    empresa = models.ForeignKey(
        "empresas.Empresa",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="usuarios",
        help_text="Solo para roles NEGOCIO, CAJERO y OFICINA.",
    )
    celular = models.CharField(max_length=20, blank=True)
    # Identidad del cliente: se exige el carnet real para entregar premios.
    ci = models.CharField("carnet de identidad", max_length=15, unique=True, null=True, blank=True)
    nit = models.CharField(max_length=20, blank=True, help_text="Opcional; se usa por defecto en caja.")
    fecha_nacimiento = models.DateField(null=True, blank=True)
    # De dónde es el cliente (para el dashboard: de dónde vienen los mejores clientes).
    procedencia = models.CharField(max_length=20, choices=Procedencia.choices, blank=True, db_index=True)
    ciudad_otra = models.CharField(
        "ciudad", max_length=80, blank=True, help_text="Solo si la procedencia es OTRO (ej. La Paz, Santa Cruz).",
    )
    acepto_terminos_en = models.DateTimeField(null=True, blank=True)
    email_verificado = models.BooleanField(default=False)
    # Saldo en monedas de Paseo (con decimales: 0,75 por visita).
    puntos_saldo = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    # Las cuentas creadas por el admin reciben una contraseña temporal por correo.
    debe_cambiar_password = models.BooleanField(default=False)

    @property
    def procedencia_texto(self) -> str:
        """Ej. "Quillacollo" u "Otro: Santa Cruz" (vacío si no la indicó)."""
        if not self.procedencia:
            return ""
        if self.procedencia == self.Procedencia.OTRO:
            return f"Otro: {self.ciudad_otra}" if self.ciudad_otra else "Otro lugar"
        return self.get_procedencia_display().split(" (")[0]

    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.rol})"


class CodigoVerificacion(models.Model):
    """Código de 6 dígitos enviado al correo (verificación de correo y segundo factor).

    Se guarda solo el hash. El `desafio` es el identificador público que el
    cliente devuelve junto con el código.
    """

    class Proposito(models.TextChoices):
        VERIFICAR_EMAIL = "VERIFICAR_EMAIL", "Verificar correo"
        LOGIN = "LOGIN", "Inicio de sesión"

    desafio = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name="codigos")
    proposito = models.CharField(max_length=20, choices=Proposito.choices)
    codigo_hash = models.CharField(max_length=64)
    expira_en = models.DateTimeField()
    intentos = models.PositiveSmallIntegerField(default=0)
    usado = models.BooleanField(default=False)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-creado_en"]
