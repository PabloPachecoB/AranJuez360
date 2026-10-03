from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers

from fidelizacion.models import PuntoEscaneo

from . import services
from .models import Evento, Funcion, Pelicula, ReservaCine

DIAS_CARTELERA = 7


class FuncionSerializer(serializers.ModelSerializer):
    formato_nombre = serializers.CharField(source="get_formato_display", read_only=True)
    idioma_nombre = serializers.CharField(source="get_idioma_display", read_only=True)
    disponibles = serializers.SerializerMethodField()

    class Meta:
        model = Funcion
        fields = [
            "id", "pelicula", "inicio", "sala", "formato", "formato_nombre", "idioma", "idioma_nombre",
            "precio", "capacidad", "disponibles",
        ]

    def get_disponibles(self, obj):
        return services.disponibles(obj)


class PeliculaSerializer(serializers.ModelSerializer):
    """Película con sus funciones de los próximos días."""

    funciones = serializers.SerializerMethodField()
    cine_nombre = serializers.CharField(source="cine.nombre", read_only=True, default=None)

    class Meta:
        model = Pelicula
        fields = [
            "id", "titulo", "sinopsis", "genero", "clasificacion", "duracion_min", "poster",
            "trailer_url", "cine", "cine_nombre", "estreno", "activo", "funciones",
        ]

    def get_funciones(self, obj):
        ahora = timezone.now()
        # Usa las funciones precargadas por la vista (prefetch) si las hay.
        funciones = [
            f for f in obj.funciones.all()
            if ahora <= f.inicio <= ahora + timedelta(days=DIAS_CARTELERA)
        ]
        return FuncionSerializer(funciones, many=True).data


class EventoSerializer(serializers.ModelSerializer):
    categoria_nombre = serializers.CharField(source="get_categoria_display", read_only=True)
    empresa_nombre = serializers.CharField(source="empresa.nombre", read_only=True, default=None)
    gratis = serializers.SerializerMethodField()

    class Meta:
        model = Evento
        fields = [
            "id", "titulo", "descripcion", "categoria", "categoria_nombre", "inicio", "fin", "lugar",
            "imagen", "precio", "gratis", "empresa", "empresa_nombre", "destacado", "activo",
        ]

    def get_gratis(self, obj):
        return not obj.precio

    def validate(self, data):
        inicio = data.get("inicio", getattr(self.instance, "inicio", None))
        fin = data.get("fin", getattr(self.instance, "fin", None))
        if inicio and fin and fin <= inicio:
            raise serializers.ValidationError({"fin": "Debe ser posterior al inicio."})
        return data


class ActividadSerializer(serializers.ModelSerializer):
    """Juegos y actividades que dan monedas al escanear su NFC/QR."""

    empresa_nombre = serializers.CharField(source="empresa.nombre", read_only=True, default=None)

    class Meta:
        model = PuntoEscaneo
        fields = ["id", "nombre", "descripcion", "monedas", "horas_espera", "empresa_nombre"]


class ReservaSerializer(serializers.ModelSerializer):
    pelicula = serializers.CharField(source="funcion.pelicula.titulo", read_only=True)
    inicio = serializers.DateTimeField(source="funcion.inicio", read_only=True)
    sala = serializers.CharField(source="funcion.sala", read_only=True)
    formato = serializers.CharField(source="funcion.formato", read_only=True)
    metodo_nombre = serializers.CharField(source="get_metodo_display", read_only=True)

    class Meta:
        model = ReservaCine
        fields = [
            "id", "funcion", "pelicula", "inicio", "sala", "formato", "cantidad", "metodo", "metodo_nombre",
            "total_bs", "monedas", "codigo", "estado", "creado_en",
        ]
        read_only_fields = ["total_bs", "monedas", "codigo", "estado", "creado_en"]
