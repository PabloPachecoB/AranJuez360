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
    # Mini-sitio de la empresa (idea tomada del panel "Mi local" de la rama brenda-explorar).
    lema = models.CharField(max_length=120, blank=True, help_text="Frase corta bajo el nombre.")
    portada = models.ImageField(upload_to="empresas/portadas/", blank=True)
    whatsapp = models.CharField(max_length=20, blank=True)
    facebook = models.URLField(blank=True)
    instagram = models.URLField(blank=True)
    sitio_web = models.URLField(blank=True)
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
    seccion = models.CharField(
        max_length=60, blank=True, help_text="Sección del menú o catálogo (ej. Bebidas). En oficinas: servicios.",
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



class FotoEmpresa(models.Model):
    """Galería del mini-sitio: fotos del local, la oficina o los productos."""

    empresa = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name="fotos")
    imagen = models.ImageField(upload_to="empresas/fotos/")
    titulo = models.CharField(max_length=80, blank=True)
    orden = models.PositiveSmallIntegerField(default=0)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["orden", "id"]

    def __str__(self):
        return f"Foto de {self.empresa}"


def _nuevo_token_invitacion():
    return secrets.token_urlsafe(32)


class InvitacionEmpresa(models.Model):
    """Invitación del admin del Paseo para que un negocio, emprendimiento u oficina
    (o un encargado más de una empresa existente) cree su cuenta y llene su ficha.

    Solo quien recibe la invitación por correo puede registrarse: no hay autorregistro.
    """

    class Estado(models.TextChoices):
        PENDIENTE = "PENDIENTE", "Pendiente"
        ACEPTADA = "ACEPTADA", "Aceptada"
        ANULADA = "ANULADA", "Anulada"

    email = models.EmailField()
    tipo = models.CharField(max_length=20, choices=Empresa.Tipo.choices, default=Empresa.Tipo.NEGOCIO)
    nombre_sugerido = models.CharField(max_length=120, blank=True, help_text="Nombre de la empresa (lo puede corregir).")
    categoria = models.ForeignKey(Categoria, on_delete=models.SET_NULL, null=True, blank=True)
    empresa = models.ForeignKey(
        Empresa, on_delete=models.CASCADE, null=True, blank=True, related_name="invitaciones_acceso",
        help_text="Si se completa, invita a un encargado más de esta empresa (no crea una nueva).",
    )
    mensaje = models.CharField(max_length=300, blank=True)
    token = models.CharField(max_length=64, unique=True, default=_nuevo_token_invitacion, editable=False)
    estado = models.CharField(max_length=10, choices=Estado.choices, default=Estado.PENDIENTE)
    expira_en = models.DateTimeField()
    creada_por = models.ForeignKey(
        "usuarios.Usuario", on_delete=models.SET_NULL, null=True, related_name="invitaciones_empresa_enviadas",
    )
    aceptada_por = models.ForeignKey(
        "usuarios.Usuario", on_delete=models.SET_NULL, null=True, blank=True, related_name="+",
    )
    creado_en = models.DateTimeField(auto_now_add=True)
    aceptada_en = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-creado_en"]
        verbose_name = "invitación de empresa"
        verbose_name_plural = "invitaciones de empresas"

    def __str__(self):
        return f"{self.email} ({self.get_tipo_display()}) [{self.estado}]"
