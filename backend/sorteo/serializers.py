from rest_framework import serializers

from . import services
from .models import DesafioContacto
from .texto import limpiar_nombre

_DESAFIO_INVALIDO = "El código ya no es válido. Empieza de nuevo."


class _Nombre(serializers.CharField):
    """Nombres o apellidos: solo letras, sin espacios de más y con mayúsculas ordenadas."""

    def __init__(self, **kw):
        super().__init__(
            min_length=2, max_length=80, trim_whitespace=True,
            error_messages={
                "blank": "Completa este campo.",
                "required": "Completa este campo.",
                "min_length": "Escribe al menos {min_length} letras.",
                "max_length": "Usa como máximo {max_length} caracteres.",
            },
            **kw,
        )

    def to_internal_value(self, data):
        try:
            return limpiar_nombre(super().to_internal_value(data))
        except ValueError as exc:
            raise serializers.ValidationError(str(exc)) from exc


class RegistroSerializer(serializers.Serializer):
    nombres = _Nombre()
    apellidos = _Nombre()
    correo = serializers.CharField(max_length=254, error_messages={"blank": "Escribe tu correo.", "required": "Escribe tu correo."})
    celular = serializers.CharField(max_length=30, error_messages={"blank": "Escribe tu celular.", "required": "Escribe tu celular."})
    canal = serializers.ChoiceField(
        choices=DesafioContacto.Canal.choices,
        error_messages={"invalid_choice": "Elige correo o celular.", "required": "Elige correo o celular."},
    )
    acepta_terminos = serializers.BooleanField(
        error_messages={"required": "Debes aceptar los términos y condiciones."},
    )

    def validate_correo(self, valor):
        correo = services.normalizar_correo(valor)
        if correo is None:
            raise serializers.ValidationError(services.mensaje_correo(valor))
        return correo

    def validate_celular(self, valor):
        celular = services.normalizar_celular(valor)
        if celular is None:
            raise serializers.ValidationError(services.mensaje_celular(valor))
        return celular

    def validate_acepta_terminos(self, value):
        if not value:
            raise serializers.ValidationError("Debes aceptar los términos y condiciones.")
        return value


class DesafioSerializer(serializers.Serializer):
    desafio = serializers.UUIDField(error_messages={"invalid": _DESAFIO_INVALIDO, "required": _DESAFIO_INVALIDO})


class VerificarSerializer(DesafioSerializer):
    codigo = serializers.RegexField(
        r"^\d{6}$",
        error_messages={"invalid": "El código tiene 6 dígitos.", "blank": "Escribe el código.", "required": "Escribe el código."},
    )


class RecuperarSerializer(serializers.Serializer):
    contacto = serializers.CharField(
        max_length=254,
        error_messages={"blank": "Escribe tu correo o tu celular.", "required": "Escribe tu correo o tu celular."},
    )


class RevocarSerializer(serializers.Serializer):
    motivo = serializers.CharField(
        min_length=3, max_length=200,
        error_messages={"blank": "Indica el motivo.", "required": "Indica el motivo.", "min_length": "Indica el motivo."},
    )
