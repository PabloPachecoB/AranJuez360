from rest_framework import serializers

from .models import (
    Canje,
    ConfiguracionPuntos,
    MovimientoPuntos,
    PuntoEscaneo,
    RangoCompra,
    Recompensa,
    SolicitudPuntos,
    Visita,
)


class EmpresaEscaneadaSerializer(serializers.Serializer):
    """Lo que ve el cliente al escanear el QR/NFC: nombre y logo."""

    id = serializers.IntegerField()
    nombre = serializers.CharField()
    logo = serializers.ImageField()
    piso = serializers.CharField()
    local = serializers.CharField()


class CrearSolicitudSerializer(serializers.Serializer):
    codigo = serializers.CharField(max_length=32)
    nit = serializers.RegexField(r"^\d{4,20}$", error_messages={"invalid": "El NIT debe tener solo dígitos."})
    monto = serializers.DecimalField(max_digits=10, decimal_places=2)


class SolicitudSerializer(serializers.ModelSerializer):
    empresa_nombre = serializers.CharField(source="empresa.nombre", read_only=True)
    empresa_logo = serializers.ImageField(source="empresa.logo", read_only=True)
    cliente_nombre = serializers.SerializerMethodField()

    class Meta:
        model = SolicitudPuntos
        fields = [
            "id", "empresa", "empresa_nombre", "empresa_logo", "cliente_nombre",
            "nit", "monto", "estado", "puntos", "motivo_rechazo", "creado_en", "atendida_en",
        ]
        read_only_fields = fields

    def get_cliente_nombre(self, obj):
        return obj.cliente.get_full_name() or obj.cliente.username


class RechazoSerializer(serializers.Serializer):
    motivo = serializers.CharField(max_length=200, required=False, allow_blank=True)


class MovimientoSerializer(serializers.ModelSerializer):
    empresa_nombre = serializers.CharField(source="empresa.nombre", read_only=True, default=None)

    class Meta:
        model = MovimientoPuntos
        fields = ["id", "empresa", "empresa_nombre", "puntos", "tipo", "descripcion", "creado_en"]
        read_only_fields = fields


class ConfiguracionPuntosSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConfiguracionPuntos
        fields = [
            "valor_moneda_bs", "puntos_por_boliviano", "monto_maximo_solicitud",
            "solicitudes_diarias_por_empresa", "puntos_por_visita",
            "horas_entre_visitas", "actualizado_en",
        ]
        read_only_fields = ["actualizado_en"]


class RegistrarVisitaSerializer(serializers.Serializer):
    token = serializers.CharField()


class VisitaSerializer(serializers.ModelSerializer):
    cliente_nombre = serializers.SerializerMethodField()
    portero_nombre = serializers.SerializerMethodField()
    punto_nombre = serializers.CharField(source="punto.nombre", read_only=True, default=None)

    class Meta:
        model = Visita
        fields = ["id", "cliente", "cliente_nombre", "portero_nombre", "punto_nombre", "puntos", "creado_en"]
        read_only_fields = fields

    def get_cliente_nombre(self, obj):
        return obj.cliente.get_full_name() or obj.cliente.username

    def get_portero_nombre(self, obj):
        return obj.portero and (obj.portero.get_full_name() or obj.portero.username)


class RecompensaSerializer(serializers.ModelSerializer):
    """Para el admin del Paseo: incluye el valor real en Bs y el costo sugerido."""

    empresa_nombre = serializers.CharField(source="empresa.nombre", read_only=True, default=None)
    costo_sugerido = serializers.SerializerMethodField()

    class Meta:
        model = Recompensa
        fields = [
            "id", "nombre", "descripcion", "categoria", "costo_puntos", "valor_bs", "costo_sugerido",
            "racha_minima_dias", "empresa", "empresa_nombre", "imagen", "activo", "creado_en",
        ]
        read_only_fields = ["creado_en"]

    def get_costo_sugerido(self, obj):
        from .services import costo_sugerido

        return costo_sugerido(obj.valor_bs) if obj.valor_bs else None

    def validate_costo_puntos(self, value):
        if value <= 0:
            raise serializers.ValidationError("El costo debe ser mayor a 0.")
        return value


class RangoCompraSerializer(serializers.ModelSerializer):
    class Meta:
        model = RangoCompra
        fields = ["id", "monto_minimo", "monto_maximo", "monedas", "activo"]

    def validate(self, data):
        minimo = data.get("monto_minimo", getattr(self.instance, "monto_minimo", None))
        maximo = data.get("monto_maximo", getattr(self.instance, "monto_maximo", None))
        if minimo is not None and minimo < 0:
            raise serializers.ValidationError({"monto_minimo": "No puede ser negativo."})
        if maximo is not None and minimo is not None and maximo <= minimo:
            raise serializers.ValidationError({"monto_maximo": "Debe ser mayor al monto mínimo."})
        if data.get("monedas") is not None and data["monedas"] < 0:
            raise serializers.ValidationError({"monedas": "No puede ser negativo."})
        return data


class PuntoEscaneoSerializer(serializers.ModelSerializer):
    """Para el admin: incluye el enlace que se graba en el NFC o se imprime en el QR."""

    empresa_nombre = serializers.CharField(source="empresa.nombre", read_only=True, default=None)
    enlace = serializers.SerializerMethodField()

    class Meta:
        model = PuntoEscaneo
        fields = [
            "id", "nombre", "tipo", "descripcion", "monedas", "horas_espera",
            "empresa", "empresa_nombre", "codigo", "enlace", "activo", "creado_en",
        ]
        read_only_fields = ["codigo", "creado_en"]

    def get_enlace(self, obj):
        return f"paseo360://f/{obj.codigo}"

    def validate_monedas(self, value):
        if value <= 0:
            raise serializers.ValidationError("Debe dar más de 0 monedas.")
        return value


class PuntoEscaneadoSerializer(serializers.ModelSerializer):
    """Lo que ve el cliente al escanear la puerta o una actividad, antes de cobrar."""

    class Meta:
        model = PuntoEscaneo
        fields = ["id", "nombre", "tipo", "descripcion", "monedas", "horas_espera"]


class EscanearSerializer(serializers.Serializer):
    codigo = serializers.CharField(max_length=32)


class CanjeSerializer(serializers.ModelSerializer):
    recompensa_nombre = serializers.CharField(source="recompensa.nombre", read_only=True)
    categoria = serializers.CharField(source="recompensa.categoria", read_only=True)
    empresa_nombre = serializers.CharField(source="recompensa.empresa.nombre", read_only=True, default=None)
    estado_nombre = serializers.CharField(source="get_estado_display", read_only=True)

    class Meta:
        model = Canje
        fields = [
            "id", "recompensa", "recompensa_nombre", "categoria", "empresa_nombre", "monedas",
            "codigo", "estado", "estado_nombre", "creado_en", "usado_en",
        ]
        read_only_fields = fields



class RecompensaClienteSerializer(serializers.ModelSerializer):
    """Lo que ve el cliente en la app: solo monedas (nunca el valor en Bs) y, si el premio
    pide venir varios días seguidos, cuántos lleva."""

    empresa_nombre = serializers.CharField(source="empresa.nombre", read_only=True, default=None)
    mi_racha = serializers.SerializerMethodField()

    class Meta:
        model = Recompensa
        fields = [
            "id", "nombre", "descripcion", "categoria", "costo_puntos", "racha_minima_dias", "mi_racha",
            "empresa", "empresa_nombre", "imagen",
        ]
        read_only_fields = fields

    def get_mi_racha(self, obj):
        request = self.context.get("request")
        if not obj.racha_minima_dias or not request:
            return None
        from .services import racha_para

        return racha_para(request.user, obj)


class RecompensaNegocioSerializer(RecompensaSerializer):
    """El negocio publica sus propios productos en el catálogo de canje."""

    canjes = serializers.SerializerMethodField()

    class Meta(RecompensaSerializer.Meta):
        fields = [
            "id", "nombre", "descripcion", "categoria", "costo_puntos", "valor_bs", "costo_sugerido",
            "imagen", "activo", "canjes", "creado_en",
        ]
        read_only_fields = ["creado_en"]

    def get_canjes(self, obj):
        return obj.canjes.count()

    def validate_categoria(self, value):
        if value not in (Recompensa.Categoria.PRODUCTO, Recompensa.Categoria.DESCUENTO, Recompensa.Categoria.OTRO):
            raise serializers.ValidationError("Los negocios publican productos, descuentos u otros premios propios.")
        return value


class CanjeNegocioSerializer(CanjeSerializer):
    """Canje visto por el negocio o el admin: quién lo canjeó y su estado."""

    cliente_nombre = serializers.SerializerMethodField()

    class Meta(CanjeSerializer.Meta):
        fields = CanjeSerializer.Meta.fields + ["cliente_nombre"]
        read_only_fields = fields

    def get_cliente_nombre(self, obj):
        return obj.cliente.get_full_name() or obj.cliente.username
