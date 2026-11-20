"""Diversión en el Paseo: cartelera de cine y eventos (los juegos que dan monedas
son PuntoEscaneo de tipo ACTIVIDAD en fidelizacion)."""

import secrets

from django.conf import settings
from django.db import models


class Pelicula(models.Model):
    class Clasificacion(models.TextChoices):
        ATP = "ATP", "Apta para todo público"
        M7 = "+7", "Mayores de 7"
        M13 = "+13", "Mayores de 13"
        M16 = "+16", "Mayores de 16"
        M18 = "+18", "Mayores de 18"

    titulo = models.CharField(max_length=150)
    sinopsis = models.TextField(blank=True)
    genero = models.CharField(max_length=60, blank=True)
    clasificacion = models.CharField(max_length=4, choices=Clasificacion.choices, default=Clasificacion.ATP)
    duracion_min = models.PositiveSmallIntegerField(default=90)
    poster = models.ImageField(upload_to="cartelera/", blank=True)
    trailer_url = models.URLField(blank=True)
    cine = models.ForeignKey(
        "empresas.Empresa", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="peliculas", help_text="Empresa que opera el cine.",
    )
    estreno = models.BooleanField(default=False)
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-estreno", "titulo"]
        verbose_name = "película"

    def __str__(self):
        return self.titulo


class Funcion(models.Model):
    class Formato(models.TextChoices):
        F2D = "2D", "2D"
        F3D = "3D", "3D"

    class Idioma(models.TextChoices):
        DOBLADA = "DOB", "Doblada"
        SUBTITULADA = "SUB", "Subtitulada"

    pelicula = models.ForeignKey(Pelicula, on_delete=models.CASCADE, related_name="funciones")
    inicio = models.DateTimeField()
    sala = models.CharField(max_length=20, blank=True)
    formato = models.CharField(max_length=2, choices=Formato.choices, default=Formato.F2D)
    idioma = models.CharField(max_length=3, choices=Idioma.choices, default=Idioma.DOBLADA)
    precio = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True, help_text="En Bs.")
    capacidad = models.PositiveSmallIntegerField(default=80, help_text="Butacas disponibles para reservar.")

    class Meta:
        ordering = ["inicio"]
        verbose_name = "función"
        verbose_name_plural = "funciones"

    def __str__(self):
        return f"{self.pelicula} · {self.inicio:%d/%m %H:%M}"


class Espacio(models.Model):
    """Lugar del Paseo que la comunidad puede pedir para presentarse (escenario, sala de podcast...)."""

    nombre = models.CharField(max_length=120)
    lugar = models.CharField(max_length=120, help_text="Ej. El Club by Mercado Gastronómico, piso 3.")
    descripcion = models.TextField(blank=True)
    capacidad = models.PositiveSmallIntegerField(help_text="Personas que caben como público.")
    equipamiento = models.TextField(blank=True, help_text="Lo que ya tiene: sonido, micrófonos, proyector...")
    activo = models.BooleanField(default=True)

    class Meta:
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre


class Evento(models.Model):
    class Categoria(models.TextChoices):
        MUSICA = "MUSICA", "Música"
        CULTURA = "CULTURA", "Arte y cultura"
        INFANTIL = "INFANTIL", "Infantil"
        GASTRONOMIA = "GASTRONOMIA", "Gastronomía"
        DEPORTE = "DEPORTE", "Deporte"
        OTRO = "OTRO", "Otro"

    titulo = models.CharField(max_length=150)
    descripcion = models.TextField(blank=True)
    categoria = models.CharField(max_length=20, choices=Categoria.choices, default=Categoria.OTRO)
    inicio = models.DateTimeField()
    fin = models.DateTimeField(null=True, blank=True)
    lugar = models.CharField(max_length=120, blank=True, help_text="Ej. Terraza, piso 4.")
    imagen = models.ImageField(upload_to="eventos/", blank=True)
    precio = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True, help_text="Vacío o 0 = entrada libre.",
    )
    empresa = models.ForeignKey(
        "empresas.Empresa", on_delete=models.SET_NULL, null=True, blank=True, related_name="eventos",
    )
    destacado = models.BooleanField(default=False, help_text="Se muestra en el Inicio de la app.")
    espacio = models.ForeignKey(
        Espacio, on_delete=models.SET_NULL, null=True, blank=True, related_name="eventos",
        help_text="Si ocupa un espacio reservable, para detectar choques de horario.",
    )
    cupos = models.PositiveSmallIntegerField(
        null=True, blank=True, help_text="Vacío = acceso libre (sin reserva). Con número = hay que reservar cupo.",
    )
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["inicio"]

    def __str__(self):
        return f"{self.titulo} ({self.inicio:%d/%m %H:%M})"


def _nuevo_codigo_reserva():
    alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alfabeto) for _ in range(8))


class ReservaCine(models.Model):
    """Entradas reservadas para una función: pagadas con monedas o a pagar en boletería."""

    class Metodo(models.TextChoices):
        MONEDAS = "MONEDAS", "Pagado con monedas"
        BOLETERIA = "BOLETERIA", "Pagar en boletería"

    class Estado(models.TextChoices):
        CONFIRMADA = "CONFIRMADA", "Confirmada"
        CANCELADA = "CANCELADA", "Cancelada"

    cliente = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="reservas_cine")
    funcion = models.ForeignKey(Funcion, on_delete=models.PROTECT, related_name="reservas")
    cantidad = models.PositiveSmallIntegerField()
    metodo = models.CharField(max_length=10, choices=Metodo.choices)
    total_bs = models.DecimalField(max_digits=10, decimal_places=2)
    monedas = models.DecimalField(max_digits=10, decimal_places=2, default=0, help_text="Monedas cobradas.")
    codigo = models.CharField(max_length=12, unique=True, default=_nuevo_codigo_reserva, editable=False)
    estado = models.CharField(max_length=10, choices=Estado.choices, default=Estado.CONFIRMADA)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-creado_en"]
        verbose_name = "reserva de cine"
        verbose_name_plural = "reservas de cine"

    def __str__(self):
        return f"{self.codigo} · {self.cantidad} × {self.funcion}"


class Propuesta(models.Model):
    """Solicitud de un cliente para presentarse en un espacio del Paseo (música, podcast, taller...).

    El admin la aprueba según la disponibilidad del espacio; al aprobarla se publica como Evento.
    """

    class Tipo(models.TextChoices):
        MUSICA = "MUSICA", "Música en vivo"
        PODCAST = "PODCAST", "Podcast o charla"
        ARTE = "ARTE", "Arte y cultura"
        TALLER = "TALLER", "Taller"
        OTRO = "OTRO", "Otro"

    class Acceso(models.TextChoices):
        LIBRE = "LIBRE", "Acceso libre"
        CUPOS = "CUPOS", "Con cupos (reserva)"

    class Estado(models.TextChoices):
        PENDIENTE = "PENDIENTE", "Pendiente"
        APROBADA = "APROBADA", "Aprobada"
        RECHAZADA = "RECHAZADA", "Rechazada"
        CANCELADA = "CANCELADA", "Cancelada"

    solicitante = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="propuestas")
    espacio = models.ForeignKey(Espacio, on_delete=models.PROTECT, related_name="propuestas")
    artista = models.CharField(max_length=120, help_text="Nombre del artista, grupo o presentador.")
    titulo = models.CharField(max_length=150, help_text="Nombre de la presentación.")
    tipo = models.CharField(max_length=10, choices=Tipo.choices, default=Tipo.MUSICA)
    descripcion = models.TextField()
    necesidades = models.TextField(blank=True, help_text="Lo que va a necesitar: sonido, sillas, proyector...")
    inicio = models.DateTimeField()
    fin = models.DateTimeField()
    personas = models.PositiveSmallIntegerField(help_text="Para cuántas personas (público esperado).")
    acceso = models.CharField(max_length=5, choices=Acceso.choices, default=Acceso.LIBRE)
    estado = models.CharField(max_length=10, choices=Estado.choices, default=Estado.PENDIENTE)
    motivo_rechazo = models.CharField(max_length=300, blank=True)
    revisada_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+",
    )
    revisada_en = models.DateTimeField(null=True, blank=True)
    evento = models.OneToOneField(
        Evento, on_delete=models.SET_NULL, null=True, blank=True, related_name="propuesta",
    )
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-creado_en"]

    def __str__(self):
        return f"{self.titulo} · {self.artista} ({self.get_estado_display()})"


class ReservaEvento(models.Model):
    """Cupo reservado para un evento con cupos. El código va en el QR que se valida en la puerta."""

    class Estado(models.TextChoices):
        CONFIRMADA = "CONFIRMADA", "Confirmada"
        CANCELADA = "CANCELADA", "Cancelada"

    evento = models.ForeignKey(Evento, on_delete=models.PROTECT, related_name="reservas")
    cliente = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="reservas_evento")
    cantidad = models.PositiveSmallIntegerField(default=1)
    codigo = models.CharField(max_length=12, unique=True, default=_nuevo_codigo_reserva, editable=False)
    estado = models.CharField(max_length=10, choices=Estado.choices, default=Estado.CONFIRMADA)
    ingreso_en = models.DateTimeField(null=True, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-creado_en"]
        verbose_name = "reserva de evento"
        verbose_name_plural = "reservas de eventos"

    def __str__(self):
        return f"{self.codigo} · {self.cantidad} × {self.evento.titulo}"
