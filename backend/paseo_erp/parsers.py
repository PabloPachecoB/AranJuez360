"""Parser JSON con un límite de anidación independiente de la versión de Python."""

from rest_framework.exceptions import ParseError
from rest_framework.parsers import JSONParser


class JSONSeguroParser(JSONParser):
    max_niveles = 256
    error_anidacion = "El JSON tiene demasiados niveles de anidación."

    def parse(self, stream, media_type=None, parser_context=None):
        try:
            datos = super().parse(stream, media_type=media_type, parser_context=parser_context)
        except RecursionError as exc:
            raise ParseError(self.error_anidacion) from exc

        # Algunos decodificadores aceptan más niveles que otros. Un iterador por
        # contenedor permite comprobarlos sin recursión ni copiar su contenido.
        pendientes = [iter((datos,))]
        while pendientes:
            for valor in pendientes[-1]:
                if isinstance(valor, (dict, list)):
                    if len(pendientes) > self.max_niveles:
                        raise ParseError(self.error_anidacion)
                    pendientes.append(iter(valor.values() if isinstance(valor, dict) else valor))
                    break
            else:
                pendientes.pop()
        return datos
