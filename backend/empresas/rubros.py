"""Rubros comerciales compartidos por la importación y el directorio."""
import unicodedata

RUBROS = ("Comida", "Electrónica", "Servicios", "Ropa", "Cosméticos", "Concesionaria", "Banca", "Otros")


def normalizar(texto):
    return "".join(c for c in unicodedata.normalize("NFKD", texto.strip().lower())
                   if not unicodedata.combining(c))


ALIAS = {
    "comida": "Comida", "comidas": "Comida", "gastronomia": "Comida",
    "electronica": "Electrónica", "tecnologia": "Electrónica",
    "servicios": "Servicios", "telecomunicaciones": "Servicios",
    "ropa": "Ropa", "moda": "Ropa", "calzado": "Ropa",
    "cosmeticos": "Cosméticos", "belleza y cuidado personal": "Cosméticos",
    "belleza": "Cosméticos", "concesionaria": "Concesionaria",
    "concesionarias": "Concesionaria", "banca": "Banca", "bancos": "Banca",
    "otros": "Otros",
}


def rubro_comercial(categoria, nombre=""):
    if normalizar(nombre) == "tigo":
        return "Servicios"
    return ALIAS.get(normalizar(categoria or ""), "Otros")
