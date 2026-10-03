from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework import serializers

from usuarios.models import Usuario

from .models import Categoria, Empresa, FotoEmpresa, Horario, InvitacionEmpresa, Oferta, Producto


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
        fields = ["id", "nombre", "descripcion", "seccion", "precio", "foto", "activo", "creado_en"]
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


class FotoEmpresaSerializer(serializers.ModelSerializer):
    class Meta:
        model = FotoEmpresa
        fields = ["id", "imagen", "titulo", "orden"]


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
    fotos = serializers.SerializerMethodField()

    def get_fotos(self, obj):
        return FotoEmpresaSerializer(obj.fotos.all(), many=True, context=self.context).data

    class Meta:
        model = Empresa
        fields = [
            "id", "nombre", "tipo", "categoria_nombre", "email_contacto", "telefono",
            "descripcion", "piso", "local", "referencia", "logo", "horarios",
            "lema", "portada", "whatsapp", "facebook", "instagram", "sitio_web", "fotos",
        ]
        read_only_fields = ["nombre", "tipo", "email_contacto"]


# --- Público (app y web) --------------------------------------------------------

class OfertaPublicaSerializer(OfertaSerializer):
    """Oferta vigente para la app: incluye el negocio y el precio normal del producto."""

    empresa_id = serializers.IntegerField(source="empresa.id", read_only=True)
    empresa_nombre = serializers.CharField(source="empresa.nombre", read_only=True)
    piso = serializers.CharField(source="empresa.piso", read_only=True)
    local = serializers.CharField(source="empresa.local", read_only=True)
    precio_normal = serializers.DecimalField(
        source="producto.precio", max_digits=10, decimal_places=2, read_only=True, default=None
    )

    class Meta(OfertaSerializer.Meta):
        fields = [
            "id", "titulo", "descripcion", "precio_oferta", "precio_normal", "imagen", "fin",
            "empresa_id", "empresa_nombre", "piso", "local",
        ]
        read_only_fields = fields


class EmpresaPublicaListSerializer(serializers.ModelSerializer):
    categoria_nombre = serializers.CharField(source="categoria.nombre", read_only=True, default=None)

    class Meta:
        model = Empresa
        fields = ["id", "nombre", "tipo", "categoria", "categoria_nombre", "piso", "local", "logo"]


class EmpresaPublicaDetalleSerializer(EmpresaPublicaListSerializer):
    horarios = HorarioSerializer(many=True, read_only=True)
    productos = serializers.SerializerMethodField()
    ofertas = serializers.SerializerMethodField()
    fotos = serializers.SerializerMethodField()

    class Meta(EmpresaPublicaListSerializer.Meta):
        fields = EmpresaPublicaListSerializer.Meta.fields + [
            "descripcion", "referencia", "telefono", "horarios", "productos", "ofertas",
            "lema", "portada", "whatsapp", "facebook", "instagram", "sitio_web", "fotos",
        ]

    def get_fotos(self, obj):
        return FotoEmpresaSerializer(obj.fotos.all(), many=True, context=self.context).data

    def get_productos(self, obj):
        qs = obj.productos.filter(activo=True)
        return ProductoSerializer(qs, many=True, context=self.context).data

    def get_ofertas(self, obj):
        hoy = timezone.localdate()
        qs = obj.ofertas.filter(activo=True, inicio__lte=hoy, fin__gte=hoy)
        return OfertaSerializer(qs, many=True, context=self.context).data



# --- Alta por invitación ------------------------------------------------------------

class InvitacionEmpresaSerializer(serializers.ModelSerializer):
    tipo_nombre = serializers.CharField(source="get_tipo_display", read_only=True)
    categoria_nombre = serializers.CharField(source="categoria.nombre", read_only=True, default=None)
    empresa_nombre = serializers.CharField(source="empresa.nombre", read_only=True, default=None)
    estado_nombre = serializers.SerializerMethodField()
    aceptada_por_nombre = serializers.SerializerMethodField()

    class Meta:
        model = InvitacionEmpresa
        fields = [
            "id", "email", "tipo", "tipo_nombre", "nombre_sugerido", "categoria", "categoria_nombre",
            "empresa", "empresa_nombre", "mensaje", "estado", "estado_nombre", "expira_en", "creado_en",
            "aceptada_en", "aceptada_por_nombre",
        ]
        read_only_fields = fields

    def get_estado_nombre(self, obj):
        if obj.estado == InvitacionEmpresa.Estado.PENDIENTE and obj.expira_en < timezone.now():
            return "Vencida"
        return obj.get_estado_display()

    def get_aceptada_por_nombre(self, obj):
        return obj.aceptada_por and (obj.aceptada_por.get_full_name() or obj.aceptada_por.email)


class CrearInvitacionSerializer(serializers.Serializer):
    email = serializers.EmailField()
    tipo = serializers.ChoiceField(choices=Empresa.Tipo.choices, default=Empresa.Tipo.NEGOCIO)
    nombre_sugerido = serializers.CharField(max_length=120, required=False, allow_blank=True)
    categoria = serializers.PrimaryKeyRelatedField(queryset=Categoria.objects.all(), required=False, allow_null=True)
    empresa = serializers.PrimaryKeyRelatedField(queryset=Empresa.objects.all(), required=False, allow_null=True)
    mensaje = serializers.CharField(max_length=300, required=False, allow_blank=True)


class AceptarInvitacionSerializer(serializers.Serializer):
    """Lo que llena el invitado: su nombre, el de la empresa y su propia contraseña
    (validación de contraseña tomada del autorregistro de la rama reto3-paseoya)."""

    nombre_empresa = serializers.CharField(max_length=120, required=False, allow_blank=True)
    first_name = serializers.CharField(max_length=60)
    last_name = serializers.CharField(max_length=60)
    password = serializers.CharField(write_only=True)
    password_confirmacion = serializers.CharField(write_only=True)

    def validate(self, attrs):
        invitacion = self.context["invitacion"]
        if not invitacion.empresa and not (attrs.get("nombre_empresa") or invitacion.nombre_sugerido).strip():
            raise serializers.ValidationError({"nombre_empresa": "Escribe el nombre de tu empresa."})
        if attrs["password"] != attrs["password_confirmacion"]:
            raise serializers.ValidationError({"password_confirmacion": "Las contraseñas no coinciden."})
        try:
            validate_password(attrs["password"], Usuario(username=invitacion.email, email=invitacion.email))
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)})
        return attrs
