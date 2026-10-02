import re

from django.core.exceptions import ValidationError


class LetrasYNumerosValidator:
    """Exige al menos una letra y un número en la contraseña."""

    def validate(self, password, user=None):
        if not (re.search(r"[A-Za-z]", password) and re.search(r"\d", password)):
            raise ValidationError(
                "La contraseña debe tener al menos una letra y un número.",
                code="password_sin_letras_y_numeros",
            )

    def get_help_text(self):
        return "Tu contraseña debe tener al menos una letra y un número."
