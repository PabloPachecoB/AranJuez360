from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework import serializers

from .models import Usuario


def _validar_procedencia(attrs):
    """Si es de fuera de Cochabamba (OTRO) debe escribir la ciudad; si no, la ciudad se limpia."""
    procedencia = attrs.get("procedencia")
    ciudad = (attrs.get("ciudad_otra") or "").strip()
    if procedencia == Usuario.Procedencia.OTRO and not ciudad:
        raise serializers.ValidationError({"ciudad_otra": "Escribe tu ciudad."})
    attrs["ciudad_otra"] = ciudad if procedencia == Usuario.Procedencia.OTRO else ""
    return attrs


class UsuarioSerializer(serializers.ModelSerializer):
    procedencia_texto = serializers.CharField(read_only=True)
    empresa_nombre = serializers.CharField(source="empresa.nombre", read_only=True, default=None)

    class Meta:
        model = Usuario
        fields = [
            "id", "username", "first_name", "last_name", "email", "celular", "ci", "nit",
            "fecha_nacimiento", "email_verificado", "rol", "empresa", "empresa_nombre",
            "puntos_saldo", "debe_cambiar_password", "procedencia", "ciudad_otra", "procedencia_texto",
        ]
        read_only_fields = fields


class RegistroClienteSerializer(serializers.ModelSerializer):
    """Registro de clientes desde la app.

    El CI debe ser real: se verifica contra el carnet al entregar premios.
    """

    first_name = serializers.CharField(max_length=60)
    last_name = serializers.CharField(max_length=60)
    celular = serializers.RegexField(
        r"^(\+591)?[67]\d{7}$",
        error_messages={"invalid": "Ingresa un celular boliviano válido (8 dígitos, empieza con 6 o 7)."},
    )
    ci = serializers.RegexField(
        r"^\d{5,10}(-[0-9A-Za-z]{1,2})?$",
        error_messages={"invalid": "Ingresa tu número de carnet (solo números, con complemento opcional, ej. 1234567-1A)."},
    )
    nit = serializers.RegexField(
        r"^\d{5,20}$", required=False, allow_blank=True,
        error_messages={"invalid": "El NIT debe tener solo números."},
    )
    fecha_nacimiento = serializers.DateField(required=False, allow_null=True)
    procedencia = serializers.ChoiceField(
        choices=Usuario.Procedencia.choices,
        error_messages={"required": "Indica de dónde eres.", "invalid_choice": "Elige una opción de la lista."},
    )
    ciudad_otra = serializers.CharField(max_length=80, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, style={"input_type": "password"})
    password_confirmacion = serializers.CharField(write_only=True, style={"input_type": "password"})
    acepta_terminos = serializers.BooleanField(write_only=True)

    class Meta:
        model = Usuario
        fields = [
            "first_name", "last_name", "email", "celular", "ci", "nit", "fecha_nacimiento",
            "procedencia", "ciudad_otra", "password", "password_confirmacion", "acepta_terminos",
        ]
        extra_kwargs = {"email": {"required": True}}

    def validate_email(self, value):
        value = value.strip().lower()
        if Usuario.objects.filter(username=value).exists():
            raise serializers.ValidationError("Ya existe una cuenta con este correo.")
        return value

    def validate_celular(self, value):
        return value.removeprefix("+591")

    def validate_ci(self, value):
        value = value.upper()
        if Usuario.objects.filter(ci=value).exists():
            raise serializers.ValidationError("Este carnet ya está registrado.")
        return value

    def validate_fecha_nacimiento(self, value):
        if value and value > timezone.localdate():
            raise serializers.ValidationError("La fecha de nacimiento no puede ser futura.")
        return value

    def validate_acepta_terminos(self, value):
        if not value:
            raise serializers.ValidationError("Debes aceptar los términos y condiciones.")
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirmacion"]:
            raise serializers.ValidationError({"password_confirmacion": "Las contraseñas no coinciden."})
        candidato = Usuario(
            username=attrs["email"], email=attrs["email"],
            first_name=attrs["first_name"], last_name=attrs["last_name"],
        )
        try:
            validate_password(attrs["password"], candidato)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)})
        return _validar_procedencia(attrs)

    def create(self, validated_data):
        password = validated_data.pop("password")
        validated_data.pop("password_confirmacion")
        validated_data.pop("acepta_terminos")
        user = Usuario(
            username=validated_data["email"],
            rol=Usuario.Rol.CLIENTE,
            acepto_terminos_en=timezone.now(),
            **validated_data,
        )
        user.set_password(password)
        user.save()
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(style={"input_type": "password"})


class DesafioSerializer(serializers.Serializer):
    desafio = serializers.UUIDField()


class VerificarCodigoSerializer(DesafioSerializer):
    codigo = serializers.RegexField(r"^\d{6}$", error_messages={"invalid": "El código tiene 6 dígitos."})


class CambiarPasswordSerializer(serializers.Serializer):
    password_actual = serializers.CharField()
    password_nueva = serializers.CharField()

    def validate(self, attrs):
        user = self.context["request"].user
        if not user.check_password(attrs["password_actual"]):
            raise serializers.ValidationError({"password_actual": "Contraseña incorrecta."})
        validate_password(attrs["password_nueva"], user)
        return attrs


class PorteroSerializer(serializers.ModelSerializer):
    """El admin crea porteros con nombre y correo; la contraseña llega por correo."""

    class Meta:
        model = Usuario
        fields = ["id", "first_name", "last_name", "email", "celular", "is_active", "date_joined"]
        read_only_fields = ["date_joined"]
        extra_kwargs = {"email": {"required": True}, "first_name": {"required": True}}

    def validate_email(self, value):
        value = value.lower()
        qs = Usuario.objects.filter(username=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Ya existe una cuenta con este correo.")
        return value


class UsuarioAdminSerializer(serializers.ModelSerializer):
    """Lista de usuarios para la vista administrativa. Solo se edita is_active."""

    nombre = serializers.SerializerMethodField()
    empresa_nombre = serializers.CharField(source="empresa.nombre", read_only=True, default=None)

    class Meta:
        model = Usuario
        fields = [
            "id", "nombre", "email", "celular", "rol", "empresa", "empresa_nombre",
            "is_active", "debe_cambiar_password", "puntos_saldo", "date_joined", "last_login",
        ]
        read_only_fields = [f for f in fields if f != "is_active"]

    def get_nombre(self, obj):
        return obj.get_full_name() or obj.username



class ProcedenciaSerializer(serializers.ModelSerializer):
    """El cliente completa o corrige de dónde es (desde la app)."""

    procedencia = serializers.ChoiceField(choices=Usuario.Procedencia.choices)
    ciudad_otra = serializers.CharField(max_length=80, required=False, allow_blank=True)

    class Meta:
        model = Usuario
        fields = ["procedencia", "ciudad_otra"]

    def validate(self, attrs):
        return _validar_procedencia(attrs)
