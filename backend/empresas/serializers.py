from django.utils import timezone
from rest_framework import serializers

from usuarios.models import Usuario

from .models import Categoria, Empresa, Horario, Oferta, Producto


class CategoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categoria
        fields = ["id", "nombre"]


class HorarioSerializer(serializers.ModelSerializer):
    dia_nombre = serializers.CharField(source="get_dia_display", read_only=True)

    class Meta:
        model = Horario
        fields = ["dia", "dia_nombre", "abre", "cierra", "cerrado"]

    def validate(self, attrs):
        if not attrs.get("cerrado") and not (attrs.get("abre") and attrs.get("cierra")):
            raise serializers.ValidationError("Indica hora de apertura y cierre, o marca el día como cerrado.")
        return attrs


class ProductoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Producto
        fields = ["id", "nombre", "descripcion", "precio", "foto", "activo", "creado_en"]
        read_only_fields = ["creado_en"]

    def validate_precio(self, value):
        if value <= 0:
            raise serializers.ValidationError("El precio debe ser mayor a 0.")
        return value


class OfertaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Oferta
        fields = [
            "id", "producto", "titulo", "descripcion", "precio_oferta",
            "imagen", "inicio", "fin", "activo", "creado_en",
        ]
        read_only_fields = ["creado_en"]

    def validate_producto(self, producto):
        empresa = self.context["request"].user.empresa
        if producto and producto.empresa_id != empresa.id:
            raise serializers.ValidationError("El producto no pertenece a tu empresa.")
        return producto

    def validate(self, attrs):
        inicio = attrs.get("inicio", getattr(self.instance, "inicio", None))
        fin = attrs.get("fin", getattr(self.instance, "fin", None))
        if inicio and fin and fin < inicio:
            raise serializers.ValidationError({"fin": "La fecha de fin no puede ser anterior al inicio."})
        return attrs


# --- Vista administrativa -----------------------------------------------------

class EmpresaAdminSerializer(serializers.ModelSerializer):
    """El admin crea la empresa solo con datos mínimos; el resto lo llena la empresa."""

    categoria_nombre = serializers.CharField(source="categoria.nombre", read_only=True, default=None)
    ficha_completa = serializers.SerializerMethodField()

    class Meta:
        model = Empresa
        fields = [
            "id", "nombre", "tipo", "categoria", "categoria_nombre", "email_contacto",
            "telefono", "piso", "local", "logo", "activo", "ficha_completa", "creado_en",
        ]
        read_only_fields = ["piso", "local", "logo", "creado_en"]

    def get_ficha_completa(self, obj):
        return bool(obj.logo and obj.piso and obj.local and obj.horarios.exists())

    def validate_email_contacto(self, value):
        value = value.lower()
        usuarios = Usuario.objects.filter(username=value)
        if self.instance:
            usuarios = usuarios.exclude(empresa=self.instance)
        if usuarios.exists():
            raise serializers.ValidationError("Ya existe una cuenta con este correo.")
        return value


# --- Panel de la empresa ------------------------------------------------------

class EmpresaPerfilSerializer(serializers.ModelSerializer):
    """Lo que la empresa puede completar y modificar de su propia ficha."""

    categoria_nombre = serializers.CharField(source="categoria.nombre", read_only=True, default=None)
    horarios = HorarioSerializer(many=True, read_only=True)

    class Meta:
        model = Empresa
        fields = [
            "id", "nombre", "tipo", "categoria_nombre", "email_contacto", "telefono",
            "descripcion", "piso", "local", "referencia", "logo", "horarios",
        ]
        read_only_fields = ["nombre", "tipo", "email_contacto"]


# --- Público (app y web) --------------------------------------------------------

class EmpresaPublicaListSerializer(serializers.ModelSerializer):
    categoria_nombre = serializers.CharField(source="categoria.nombre", read_only=True, default=None)

    class Meta:
        model = Empresa
        fields = ["id", "nombre", "tipo", "categoria", "categoria_nombre", "piso", "local", "logo"]


class EmpresaPublicaDetalleSerializer(EmpresaPublicaListSerializer):
    horarios = HorarioSerializer(many=True, read_only=True)
    productos = serializers.SerializerMethodField()
    ofertas = serializers.SerializerMethodField()

    class Meta(EmpresaPublicaListSerializer.Meta):
        fields = EmpresaPublicaListSerializer.Meta.fields + [
            "descripcion", "referencia", "telefono", "horarios", "productos", "ofertas",
        ]

    def get_productos(self, obj):
        qs = obj.productos.filter(activo=True)
        return ProductoSerializer(qs, many=True, context=self.context).data

    def get_ofertas(self, obj):
        hoy = timezone.localdate()
        qs = obj.ofertas.filter(activo=True, inicio__lte=hoy, fin__gte=hoy)
        return OfertaSerializer(qs, many=True, context=self.context).data
