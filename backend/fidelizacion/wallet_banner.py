"""Banner de progreso del pase: puntos acumulados y barra hacia el siguiente punto.

Se genera una imagen por cliente y se cambia en cada compra validada, para que la
tarjeta «avance» sola en el Wallet. Solo lleva números: ni nombre, ni contacto,
ni locales. Tamaño recomendado por Google para el banner: 1032×336.
"""

from __future__ import annotations

from functools import lru_cache
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

# Manrope (SIL OFL 1.1, la misma de la app): tiene tildes, ñ y signos de apertura.
FUENTES = Path(__file__).resolve().parent / "fuentes"
NORMAL = FUENTES / "Manrope_500Medium.ttf"
NEGRITA = FUENTES / "Manrope_800ExtraBold.ttf"

ANCHO, ALTO = 1032, 336
MARINO = (0, 50, 75)        # --brand de la web (#00324B)
MARINO_OSCURO = (0, 28, 44)
DORADO = (218, 165, 32)     # --accent de la web (#DAA520)
BLANCO = (255, 255, 255)
GRIS = (176, 196, 210)
PISTA = (255, 255, 255, 46)


@lru_cache(maxsize=32)
def _fuente(tam: int, negrita: bool = False):
    return ImageFont.truetype(str(NEGRITA if negrita else NORMAL), tam)


def _texto(d: ImageDraw.ImageDraw, xy, texto: str, tam: int, color, ancla="la", negrita=False):
    d.text(xy, texto, font=_fuente(tam, negrita), fill=color, anchor=ancla)


def generar_banner(puntos: int, faltan_bs: int, monto_por_punto: int = 200, participaciones: int | None = None,
                   fecha_sorteo: str = "") -> bytes:
    """PNG con los puntos acumulados y la barra hacia el siguiente punto."""
    if monto_por_punto <= 0:
        raise ValueError("monto_por_punto debe ser mayor que 0.")
    faltan = max(0, min(int(faltan_bs), monto_por_punto))
    avance = monto_por_punto - faltan
    participaciones = puntos if participaciones is None else participaciones

    img = Image.new("RGBA", (ANCHO, ALTO), MARINO)
    # Degradado suave de arriba hacia abajo.
    fondo = ImageDraw.Draw(img)
    for y in range(ALTO):
        t = y / (ALTO - 1)
        fondo.line([(0, y), (ANCHO, y)], fill=tuple(round(a + (b - a) * t) for a, b in zip(MARINO, MARINO_OSCURO)))

    capa = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(capa)

    # Izquierda: puntos acumulados, en grande.
    centro_izq = 190
    _texto(d, (centro_izq, 150), str(puntos), 150, DORADO, ancla="mm", negrita=True)
    _texto(d, (centro_izq, 250), "punto acumulado" if puntos == 1 else "puntos acumulados", 30, BLANCO, ancla="mm")

    # Separador dorado.
    d.line([(380, 56), (380, ALTO - 56)], fill=DORADO + (160,), width=2)

    # Derecha: barra hacia el siguiente punto.
    x0, x1 = 424, ANCHO - 56
    _texto(d, (x0, 66), f"Hacia tu punto {puntos + 1}", 30, GRIS)
    _texto(d, (x1, 66), f"Bs {avance} / {monto_por_punto}", 30, BLANCO, ancla="ra")
    y0, alto_barra = 126, 40
    d.rounded_rectangle([x0, y0, x1, y0 + alto_barra], radius=alto_barra // 2, fill=PISTA)
    lleno = x0 + round((x1 - x0) * avance / monto_por_punto)
    if avance > 0:
        d.rounded_rectangle([x0, y0, max(lleno, x0 + alto_barra), y0 + alto_barra],
                            radius=alto_barra // 2, fill=DORADO)
    # Marcas cada 25 %.
    for i in (1, 2, 3):
        x = x0 + (x1 - x0) * i // 4
        d.line([(x, y0 + 8), (x, y0 + alto_barra - 8)], fill=(255, 255, 255, 70), width=2)

    if faltan:
        _texto(d, (x0, 200), "Te faltan ", 34, BLANCO)
        ancho = d.textlength("Te faltan ", font=_fuente(34))
        _texto(d, (x0 + ancho, 200), f"Bs {faltan}", 34, DORADO, negrita=True)
    else:
        _texto(d, (x0, 200), "¡Punto completo!", 34, DORADO, negrita=True)

    pie = f"{participaciones} participaci{'ón' if participaciones == 1 else 'ones'} en el sorteo"
    if fecha_sorteo:
        pie += f" del {fecha_sorteo}"
    _texto(d, (x0, 262), pie, 26, GRIS)

    img = Image.alpha_composite(img, capa).convert("RGB")
    salida = BytesIO()
    img.save(salida, format="PNG", optimize=True)
    return salida.getvalue()
