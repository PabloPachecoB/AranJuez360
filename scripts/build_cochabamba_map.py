"""Genera geometrías SVG locales desde geoBoundaries BOL ADM2 (9469f09).

Uso: python scripts/build_cochabamba_map.py archivo_geojson
Fuente: https://www.geoboundaries.org/api/current/gbOpen/BOL/ADM2/
GeoBolivia, dominio público, límites de referencia de 2015.
"""
import json
import math
import sys
import unicodedata
from pathlib import Path

names = {
    'Cercado': 'CERCADO', 'Quillacollo': 'QUILLACOLLO', 'Chapare': 'CHAPARE',
    'Arani': 'ARANI', 'Arque': 'ARQUE', 'Ayopaya': 'AYOPAYA', 'Bolivar': 'BOLIVAR',
    'Capinota': 'CAPINOTA', 'Carrasco': 'CARRASCO', 'Esteban Arze': 'ESTEBAN_ARCE',
    'German Jordan': 'GERMAN_JORDAN', 'Mizque': 'MIZQUE', 'Campero': 'NARCISO_CAMPERO',
    'Punata': 'PUNATA', 'Tapacari': 'TAPACARI', 'Tiraque': 'TIRAQUE',
}
features = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))['features']
selected = []
for f in features:
    name = ''.join(c for c in unicodedata.normalize('NFD', f['properties']['shapeName']) if not unicodedata.combining(c))
    if name not in names:
        continue
    g = f['geometry']
    polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
    # La fuente agrupa las provincias homónimas de Cercado en un MultiPolygon.
    # Conservar solo el polígono de Cochabamba, no Tarija, Oruro ni Beni.
    if name == 'Cercado':
        polys = [p for p in polys if all(-66.5 < x < -65.8 and -17.7 < y < -17.1 for x, y in p[0])]
        assert len(polys) == 1
    selected.append((names[name], polys))
assert len(selected) == 16 and len({code for code, _ in selected}) == 16
factor = math.cos(math.radians(-17.2))
points = [(x * factor, -y) for _, polys in selected for poly in polys for ring in poly for x, y in ring]
xmin, xmax = min(p[0] for p in points), max(p[0] for p in points)
ymin, ymax = min(p[1] for p in points), max(p[1] for p in points)
scale = min(720 / (xmax - xmin), 470 / (ymax - ymin))
ox = (800 - (xmax - xmin) * scale) / 2
oy = (540 - (ymax - ymin) * scale) / 2
rows = []
for code, polys in selected:
    parts = []
    for poly in polys:
        for ring in poly:
            coords = [f'{(x * factor - xmin) * scale + ox:.1f},{(-y - ymin) * scale + oy:.1f}' for x, y in ring]
            parts.append('M' + 'L'.join(coords) + 'Z')
    rows.append({'codigo': code, 'path': ''.join(parts)})
target = Path('web/src/admin/data/cochabamba.json')
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(rows, separators=(',', ':')), encoding='utf-8')
print(f'{len(rows)} provincias; {target.stat().st_size} bytes')
