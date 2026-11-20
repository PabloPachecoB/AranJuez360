"""Procedencia declarada y actividad agregada; no usa ubicación en tiempo real."""
import unicodedata
from decimal import Decimal

from django.db.models import Count, Max, Min, Q, Sum
from django.utils import timezone

from fidelizacion.models import MovimientoPuntos, SolicitudPuntos, Visita
from usuarios.models import Usuario
from .services import APROBADA, RANGOS_EDAD, _rango


def _clave_ciudad(nombre):
    limpio = ' '.join(nombre.split())
    return ''.join(c for c in unicodedata.normalize('NFKD', limpio.casefold())
                   if not unicodedata.combining(c)), limpio


def _metricas():
    return dict(clientes=0, clientes_con_compras=0, compras=0, monto=Decimal('0'), visitas=0,
                puntos_saldo=Decimal('0'), puntos_ganados=Decimal('0'), compradores_recurrentes=0,
                suma_dias=0, intervalos=0)


def mapa_clientes(desde, hasta):
    clientes = Usuario.objects.filter(rol=Usuario.Rol.CLIENTE).only(
        'id', 'procedencia', 'ciudad_otra', 'fecha_nacimiento', 'ocupacion', 'puntos_saldo')
    compras = {f['cliente']: f for f in SolicitudPuntos.objects.filter(
        estado=APROBADA, cliente__rol=Usuario.Rol.CLIENTE, **_rango(desde, hasta)
    ).values('cliente').annotate(compras=Count('id'), monto=Sum('monto'), primera=Min('creado_en'), ultima=Max('creado_en'))}
    puntos = {f['cliente']: f['ganados'] or Decimal('0') for f in MovimientoPuntos.objects.filter(
        cliente__rol=Usuario.Rol.CLIENTE, **_rango(desde, hasta)
    ).values('cliente').annotate(ganados=Sum('puntos', filter=Q(puntos__gt=0)))}
    visitas = {f['cliente']: f['n'] for f in Visita.objects.filter(
        cliente__rol=Usuario.Rol.CLIENTE, **_rango(desde, hasta)
    ).values('cliente').annotate(n=Count('id'))}

    def grupo(clave, nombre):
        return dict(clave=clave, nombre=nombre, **_metricas(), edades={}, ocupaciones={}, suma_edades=0, con_edad=0)

    provincias = {c: grupo(c, n.split(' (')[0]) for c, n in Usuario.Procedencia.choices if c != 'OTRO'}
    ciudades = {}
    sin_dato = grupo('SIN_DATO', 'Sin procedencia indicada')
    hoy = timezone.localdate()
    for cliente in clientes.iterator():
        if cliente.procedencia == 'OTRO':
            clave, nombre = _clave_ciudad(cliente.ciudad_otra)
            fila = ciudades.setdefault(clave or 'SIN_CIUDAD', grupo(clave or 'SIN_CIUDAD', nombre or 'Ciudad sin indicar'))
        else:
            fila = provincias.get(cliente.procedencia, sin_dato)
        fecha = cliente.fecha_nacimiento
        edad = hoy.year - fecha.year - ((hoy.month, hoy.day) < (fecha.month, fecha.day)) if fecha else None
        if edad is not None and not 0 <= edad <= 110:
            edad = None
        rango = next((n for lo, hi, n in RANGOS_EDAD if edad is not None and lo <= edad <= hi), 'Sin dato')
        edad_fila = fila['edades'].setdefault(rango, dict(nombre=rango, **_metricas()))
        ocupacion = cliente.get_ocupacion_display() if cliente.ocupacion else 'Sin dato'
        ocupacion_fila = fila['ocupaciones'].setdefault(ocupacion, dict(nombre=ocupacion, **_metricas()))
        compra = compras.get(cliente.id, {})
        for destino in (fila, edad_fila, ocupacion_fila):
            destino['clientes'] += 1
            destino['visitas'] += visitas.get(cliente.id, 0)
            destino['compras'] += compra.get('compras', 0)
            destino['monto'] += compra.get('monto') or Decimal('0')
            destino['clientes_con_compras'] += bool(compra)
            destino['puntos_saldo'] += cliente.puntos_saldo
            destino['puntos_ganados'] += puntos.get(cliente.id, Decimal('0'))
            if compra.get('compras', 0) > 1:
                destino['compradores_recurrentes'] += 1
                destino['suma_dias'] += (compra['ultima'] - compra['primera']).total_seconds() / 86400
                destino['intervalos'] += compra['compras'] - 1
        if edad is not None:
            fila['suma_edades'] += edad
            fila['con_edad'] += 1

    orden = [n for _, _, n in RANGOS_EDAD] + ['Sin dato']
    def frecuencia(fila):
        dias, intervalos = fila.pop('suma_dias'), fila.pop('intervalos')
        fila['dias_entre_compras'] = round(dias / intervalos, 1) if intervalos else None
        fila['compras_por_comprador'] = round(fila['compras'] / fila['clientes_con_compras'], 2) if fila['clientes_con_compras'] else 0
        return fila

    def terminar(fila):
        suma = fila.pop('suma_edades')
        cantidad = fila.pop('con_edad')
        fila['edad_promedio'] = round(suma / cantidad, 1) if cantidad else None
        fila['por_edad'] = [frecuencia(e) for e in sorted(fila.pop('edades').values(), key=lambda e: orden.index(e['nombre']))]
        fila['por_ocupacion'] = [frecuencia(e) for e in sorted(fila.pop('ocupaciones').values(), key=lambda e: (-e['clientes'], e['nombre']))]
        fila['consumo_por_comprador'] = (fila['monto'] / fila['clientes_con_compras']).quantize(Decimal('.01')) if fila['clientes_con_compras'] else Decimal('0')
        return frecuencia(fila)

    return {
        'desde': desde, 'hasta': hasta,
        'provincias': [terminar(p) for p in provincias.values()],
        'ciudades': sorted((terminar(c) for c in ciudades.values()), key=lambda c: (-c['clientes'], c['nombre'])),
        'sin_procedencia': terminar(sin_dato),
    }
