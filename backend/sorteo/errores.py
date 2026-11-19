"""Errores del Sorteo Paseo con un código estable que el frontend puede interpretar."""

from rest_framework.exceptions import APIException


class SorteoError(APIException):
    """Se devuelve como `{"detail": mensaje, "codigo": codigo}` con el estado HTTP indicado."""

    def __init__(self, codigo: str, mensaje: str, status: int = 400):
        super().__init__(detail={"detail": mensaje, "codigo": codigo})
        self.status_code = status
        self.codigo = codigo
        self.mensaje = mensaje
