from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers

from fidelizacion.models import PuntoEscaneo

from . import escenario, services
from .models import Espacio, Evento, Funcion, Pelicula, Propuesta, ReservaCine, ReservaEvento

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
    espacio_nombre = serializers.CharField(source="espacio.nombre", read_only=True, default=None)
    gratis = serializers.SerializerMethodField()
    acceso = serializers.SerializerMethodField()
    reservados = serializers.SerializerMethodField()
    disponibles = serializers.SerializerMethodField()
    organiza = serializers.SerializerMethodField()
    mi_reserva = serializers.SerializerMethodField()

    class Meta:
        model = Evento
        fields = [
            "id", "titulo", "descripcion", "categoria", "categoria_nombre", "inicio", "fin", "lugar",
            "imagen", "precio", "gratis", "empresa", "empresa_nombre", "espacio", "espacio_nombre",
            "cupos", "acceso", "reservados", "disponibles", "organiza", "mi_reserva", "destacado", "activo",
        ]

    def get_gratis(self, obj):
        return not obj.precio

    def get_acceso(self, obj):
        return "LIBRE" if obj.cupos is None else "CUPOS"

    def get_reservados(self, obj):
        return escenario.reservados(obj) if obj.cupos is not None else 0

    def get_disponibles(self, obj):
        return escenario.disponibles(obj)

    def get_organiza(self, obj):
        """Artista que lo propuso en Escenario abierto (si vino de una propuesta)."""
        propuesta = getattr(obj, "propuesta", None)
        return propuesta.artista if propuesta else None

    def get_mi_reserva(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if obj.cupos is None or not (user and user.is_authenticated):
            return None
        reserva = obj.reservas.filter(cliente=user, estado=ReservaEvento.Estado.CONFIRMADA).first()
        return ReservaEventoSerializer(reserva).data if reserva else None

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


class EspacioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Espacio
        fields = ["id", "nombre", "lugar", "descripcion", "capacidad", "equipamiento", "activo"]


class ReservaEventoSerializer(serializers.ModelSerializer):
    """Entrada a un evento con cupos: el QR lleva `paseo360://evento/<codigo>`."""

    titulo = serializers.CharField(source="evento.titulo", read_only=True)
    inicio = serializers.DateTimeField(source="evento.inicio", read_only=True)
    fin = serializers.DateTimeField(source="evento.fin", read_only=True)
    lugar = serializers.CharField(source="evento.lugar", read_only=True)
    imagen = serializers.ImageField(source="evento.imagen", read_only=True)
    cliente_nombre = serializers.SerializerMethodField()
    qr = serializers.SerializerMethodField()

    class Meta:
        model = ReservaEvento
        fields = [
            "id", "evento", "titulo", "inicio", "fin", "lugar", "imagen", "cantidad", "codigo", "qr",
            "estado", "ingreso_en", "cliente_nombre", "creado_en",
        ]
        read_only_fields = ["codigo", "estado", "ingreso_en", "creado_en"]

    def get_qr(self, obj):
        return f"paseo360://evento/{obj.codigo}"

    def get_cliente_nombre(self, obj):
        return obj.cliente.get_full_name() or obj.cliente.email


class PropuestaSerializer(serializers.ModelSerializer):
    """Solicitud vista por quien la envía."""

    espacio_nombre = serializers.CharField(source="espacio.nombre", read_only=True)
    espacio_lugar = serializers.CharField(source="espacio.lugar", read_only=True)
    tipo_nombre = serializers.CharField(source="get_tipo_display", read_only=True)
    acceso_nombre = serializers.CharField(source="get_acceso_display", read_only=True)
    estado_nombre = serializers.CharField(source="get_estado_display", read_only=True)
    cupos = serializers.IntegerField(source="evento.cupos", read_only=True, default=None)
    reservados = serializers.SerializerMethodField()

    class Meta:
        model = Propuesta
        fields = [
            "id", "espacio", "espacio_nombre", "espacio_lugar", "artista", "titulo", "tipo", "tipo_nombre",
            "descripcion", "necesidades", "inicio", "fin", "personas", "acceso", "acceso_nombre",
            "estado", "estado_nombre", "motivo_rechazo", "evento", "cupos", "reservados", "creado_en",
        ]
        read_only_fields = ["estado", "motivo_rechazo", "evento", "creado_en"]

    def get_reservados(self, obj):
        return escenario.reservados(obj.evento) if obj.evento and obj.evento.cupos is not None else 0

    def validate_personas(self, valor):
        if valor < 1:
            raise serializers.ValidationError("Indica para cuántas personas es.")
        return valor


class PropuestaAdminSerializer(PropuestaSerializer):
    """Para el panel: quién la pide y si choca con otros eventos o solicitudes del mismo espacio."""

    solicitante_nombre = serializers.SerializerMethodField()
    solicitante_email = serializers.EmailField(source="solicitante.email", read_only=True)
    solicitante_celular = serializers.CharField(source="solicitante.celular", read_only=True, default="")
    espacio_capacidad = serializers.IntegerField(source="espacio.capacidad", read_only=True)
    conflictos = serializers.SerializerMethodField()
    revisada_por_nombre = serializers.SerializerMethodField()

    class Meta(PropuestaSerializer.Meta):
        fields = PropuestaSerializer.Meta.fields + [
            "solicitante_nombre", "solicitante_email", "solicitante_celular", "espacio_capacidad",
            "conflictos", "revisada_por_nombre", "revisada_en",
        ]

    def get_solicitante_nombre(self, obj):
        return obj.solicitante.get_full_name() or obj.solicitante.email

    def get_revisada_por_nombre(self, obj):
        return (obj.revisada_por.get_full_name() or obj.revisada_por.email) if obj.revisada_por else None

    def get_conflictos(self, obj):
        if obj.estado != Propuesta.Estado.PENDIENTE:
            return []
        eventos = [
            {"tipo": "evento", "titulo": e.titulo, "inicio": e.inicio, "fin": e.fin}
            for e in escenario.eventos_en_conflicto(obj.espacio, obj.inicio, obj.fin)
        ]
        solicitudes = [
            {"tipo": "solicitud", "titulo": f"{p.titulo} ({p.artista})", "inicio": p.inicio, "fin": p.fin}
            for p in escenario.propuestas_que_se_cruzan(obj)
        ]
        return eventos + solicitudes
