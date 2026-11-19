"""Parser JSON que responde 400 ante un cuerpo anidado miles de niveles.

`json.loads` lanza RecursionError (no ValueError) con algo como `[[[[…]]]]` de 3.000 niveles, y el parser de DRF
solo captura ValueError: la petición terminaba en un error 500. Afectaba a toda la API, incluido el login.
"""

from rest_framework.exceptions import ParseError
from rest_framework.parsers import JSONParser


class JSONSeguroParser(JSONParser):
    def parse(self, stream, media_type=None, parser_context=None):
        try:
            return super().parse(stream, media_type=media_type, parser_context=parser_context)
        except RecursionError as exc:
            raise ParseError("El JSON tiene demasiados niveles de anidación.") from exc
