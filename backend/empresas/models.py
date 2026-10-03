import secrets

from django.db import models


def _nuevo_codigo_fidelizacion():
    return secrets.token_urlsafe(12)


class Categoria(models.Model):
    nombre = models.CharField(max_length=80, unique=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre


class Empresa(models.Model):
    """Establecimiento del Paseo.

    Puede ser un negocio, un emprendimiento o una oficina. El admin la crea con
    los datos mínimos; la propia empresa completa su ficha
    (logo, ubicación, horarios, productos y ofertas) desde la web.
    """

    class Tipo(models.TextChoices):
        NEGOCIO = "NEGOCIO", "Negocio"
        EMPRENDIMIENTO = "EMPRENDIMIENTO", "Emprendimiento"
        OFICINA = "OFICINA", "Oficina"  # alquila y brinda sus servicios aparte; sin caja de puntos

    nombre = models.CharField(max_length=120)
    tipo = models.CharField(max_length=20, choices=Tipo.choices, default=Tipo.NEGOCIO)
    categoria = models.ForeignKey(
        Categoria, on_delete=models.SET_NULL, null=True, blank=True, related_name="empresas"
    )
    email_contacto = models.EmailField()
    telefono = models.CharField(max_length=20, blank=True)
    descripcion = models.TextField(blank=True)
    piso = models.CharField(max_length=20, blank=True)
    local = models.CharField(max_length=20, blank=True, help_text="Número de local u oficina.")
    referencia = models.CharField(max_length=200, blank=True, help_text="Cómo llegar.")
    logo = models.ImageField(upload_to="empresas/logos/", blank=True)
    activo = models.BooleanField(default=True)
    # Va dentro del QR y del sticker NFC de caja. Regenerable si se filtra.
    codigo_fidelizacion = models.CharField(
        max_length=32, unique=True, default=_nuevo_codigo_fidelizacion, editable=False
    )
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre


class Horario(models.Model):
    class Dia(models.IntegerChoices):
        LUNES = 0, "Lunes"
        MARTES = 1, "Martes"
        MIERCOLES = 2, "Miércoles"
        JUEVES = 3, "Jueves"
        VIERNES = 4, "Viernes"
        SABADO = 5, "Sábado"
        DOMINGO = 6, "Domingo"

    empresa = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name="horarios")
    dia = models.PositiveSmallIntegerField(choices=Dia.choices)
    abre = models.TimeField(null=True, blank=True)
    cierra = models.TimeField(null=True, blank=True)
    cerrado = models.BooleanField(default=False)

    class Meta:
        ordering = ["dia"]
        constraints = [
            models.UniqueConstraint(fields=["empresa", "dia"], name="horario_unico_por_dia"),
        ]

    def __str__(self):
        return f"{self.empresa} {self.get_dia_display()}"


class Producto(models.Model):
    empresa = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name="productos")
    nombre = models.CharField(max_length=120)
    descripcion = models.TextField(blank=True)
    precio = models.DecimalField(max_digits=10, decimal_places=2, help_text="En bolivianos.")
    foto = models.ImageField(upload_to="empresas/productos/", blank=True)
    # Campos de PaseoYa (Reto 3): el reto oficial pide "administrar inventario"
    # y valora promociones, por eso viven en el Producto compartido y no en un
    # modelo aparte.
    stock = models.PositiveIntegerField(default=0)
    en_promocion = models.BooleanField(default=False)
    precio_promocion = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        help_text="Solo si en_promocion es verdadero; debe ser menor al precio regular.",
    )
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["nombre"]

    def __str__(self):
        return f"{self.nombre} ({self.empresa})"


class Oferta(models.Model):
    empresa = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name="ofertas")
    producto = models.ForeignKey(
        Producto, on_delete=models.SET_NULL, null=True, blank=True, related_name="ofertas"
    )
    titulo = models.CharField(max_length=120)
    descripcion = models.TextField(blank=True)
    precio_oferta = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    imagen = models.ImageField(upload_to="empresas/ofertas/", blank=True)
    inicio = models.DateField()
    fin = models.DateField()
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-inicio"]

    def __str__(self):
        return f"{self.titulo} ({self.empresa})"
