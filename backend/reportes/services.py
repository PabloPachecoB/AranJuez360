"""Estadísticas del dashboard administrativo.

Solo se mide lo que pasa por el sistema: visitas = clientes registrados en
portería; compras = tickets de fidelización aprobados en caja (no las ventas
totales de cada tienda, que viven en sus propios sistemas).
"""

from datetime import date, timedelta

from django.db.models import Count, DecimalField, Max, OuterRef, Q, Subquery, Sum, Value
from django.db.models.functions import Coalesce, ExtractHour, ExtractIsoWeekDay, TruncDate
from django.utils import timezone

from empresas.models import Empresa
from fidelizacion.models import MovimientoPuntos, SolicitudPuntos, Visita
from usuarios.models import Usuario

APROBADA = SolicitudPuntos.Estado.APROBADA
RECHAZADA = SolicitudPuntos.Estado.RECHAZADA
DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]


def _rango(desde: date, hasta: date) -> dict:
    """Filtro de fechas inclusivo para campos `creado_en`."""
    return {"creado_en__date__gte": desde, "creado_en__date__lte": hasta}


def _rango_texto(desde: date, hasta: date) -> dict:
    return {"desde": desde.isoformat(), "hasta": hasta.isoformat()}


def _indicadores(desde: date, hasta: date) -> dict:
    visitas = Visita.objects.filter(**_rango(desde, hasta))
    compras = SolicitudPuntos.objects.filter(estado=APROBADA, **_rango(desde, hasta))
    movimientos = MovimientoPuntos.objects.filter(**_rango(desde, hasta))
    puntos = movimientos.aggregate(
        entregados=Sum("puntos", filter=Q(puntos__gt=0)),
        canjeados=Sum("puntos", filter=Q(puntos__lt=0)),
    )
    return {
        "visitas": visitas.count(),
        "clientes_distintos": visitas.values("cliente").distinct().count(),
        "clientes_nuevos": Usuario.objects.filter(
            rol=Usuario.Rol.CLIENTE, date_joined__date__gte=desde, date_joined__date__lte=hasta
        ).count(),
        "compras": compras.count(),
        "monto_total": compras.aggregate(t=Sum("monto"))["t"] or 0,
        "puntos_entregados": puntos["entregados"] or 0,
        "puntos_canjeados": -(puntos["canjeados"] or 0),
        "solicitudes_rechazadas": SolicitudPuntos.objects.filter(
            estado=RECHAZADA, **_rango(desde, hasta)
        ).count(),
    }


def resumen(desde: date, hasta: date) -> dict:
    """Indicadores del periodo comparados con el periodo anterior de igual duración."""
    duracion = (hasta - desde).days + 1
    anterior_hasta = desde - timedelta(days=1)
    anterior_desde = anterior_hasta - timedelta(days=duracion - 1)
    return {
        "desde": desde,
        "hasta": hasta,
        "actual": _indicadores(desde, hasta),
        "anterior": _indicadores(anterior_desde, anterior_hasta),
        # Estado actual, sin depender del periodo:
        "solicitudes_pendientes": SolicitudPuntos.objects.filter(
            estado=SolicitudPuntos.Estado.PENDIENTE
        ).count(),
        "puntos_en_circulacion": Usuario.objects.filter(rol=Usuario.Rol.CLIENTE).aggregate(
            t=Sum("puntos_saldo")
        )["t"] or 0,
    }


SIN_DATO = "SIN_DATO"


def _de_procedencia(procedencia: str | None, campo: str = "cliente__procedencia") -> dict:
    """Filtro opcional ?procedencia=QUILLACOLLO (SIN_DATO = clientes que no la indicaron)."""
    if not procedencia:
        return {}
    return {campo: "" if procedencia == SIN_DATO else procedencia}


def _nombre_procedencia(codigo: str) -> str:
    if not codigo:
        return "Sin indicar"
    return dict(Usuario.Procedencia.choices).get(codigo, codigo).split(" (")[0]


def visitas_por_dia(desde: date, hasta: date, procedencia: str | None = None) -> list:
    filas = (
        Visita.objects.filter(**_rango(desde, hasta), **_de_procedencia(procedencia))
        .annotate(fecha=TruncDate("creado_en"))
        .values("fecha")
        .annotate(visitas=Count("id"), clientes=Count("cliente", distinct=True), puntos=Sum("puntos"))
        .order_by("fecha")
    )
    return list(filas)


def compras_por_dia(desde: date, hasta: date, procedencia: str | None = None) -> list:
    filas = (
        SolicitudPuntos.objects.filter(estado=APROBADA, **_rango(desde, hasta), **_de_procedencia(procedencia))
        .annotate(fecha=TruncDate("creado_en"))
        .values("fecha")
        .annotate(compras=Count("id"), monto=Sum("monto"), puntos=Sum("puntos"))
        .order_by("fecha")
    )
    return list(filas)


def horas_pico(desde: date, hasta: date) -> list:
    filas = (
        Visita.objects.filter(**_rango(desde, hasta))
        .annotate(hora=ExtractHour("creado_en"))
        .values("hora")
        .annotate(visitas=Count("id"))
        .order_by("hora")
    )
    return list(filas)


def dias_semana(desde: date, hasta: date) -> list:
    filas = (
        Visita.objects.filter(**_rango(desde, hasta))
        .annotate(dia=ExtractIsoWeekDay("creado_en"))
        .values("dia")
        .annotate(visitas=Count("id"))
        .order_by("dia")
    )
    return [{**f, "nombre": DIAS_SEMANA[f["dia"] - 1]} for f in filas]


def ranking_empresas(desde: date, hasta: date, tipo: str | None = None) -> list:
    """Actividad de fidelización por empresa (excluye oficinas: no tienen caja)."""
    en_rango = Q(solicitudes_puntos__creado_en__date__gte=desde) & Q(
        solicitudes_puntos__creado_en__date__lte=hasta
    )
    aprobadas = en_rango & Q(solicitudes_puntos__estado=APROBADA)
    qs = Empresa.objects.exclude(tipo=Empresa.Tipo.OFICINA)
    if tipo:
        qs = qs.filter(tipo=tipo)
    filas = qs.annotate(
        compras=Count("solicitudes_puntos", filter=aprobadas),
        rechazadas=Count("solicitudes_puntos", filter=en_rango & Q(solicitudes_puntos__estado=RECHAZADA)),
        monto=Sum("solicitudes_puntos__monto", filter=aprobadas),
        puntos=Sum("solicitudes_puntos__puntos", filter=aprobadas),
        clientes=Count("solicitudes_puntos__cliente", filter=aprobadas, distinct=True),
        ultima_compra=Max("solicitudes_puntos__creado_en", filter=Q(solicitudes_puntos__estado=APROBADA)),
    ).values(
        "id", "nombre", "tipo", "activo", "compras", "rechazadas", "monto", "puntos",
        "clientes", "ultima_compra",
    ).order_by("-compras", "-monto", "nombre")

    resultado = []
    for f in filas:
        atendidas = f["compras"] + f["rechazadas"]
        resultado.append({
            **f,
            "monto": f["monto"] or 0,
            "puntos": f["puntos"] or 0,
            "tasa_rechazo": round(f["rechazadas"] / atendidas, 2) if atendidas else 0,
        })
    return resultado


def empresas_sin_actividad(dias: int) -> list:
    limite = timezone.now() - timedelta(days=dias)
    recientes = SolicitudPuntos.objects.filter(estado=APROBADA, creado_en__gte=limite).values("empresa")
    return list(
        Empresa.objects.filter(activo=True)
        .exclude(tipo=Empresa.Tipo.OFICINA)
        .exclude(pk__in=recientes)
        .annotate(ultima_compra=Max(
            "solicitudes_puntos__creado_en", filter=Q(solicitudes_puntos__estado=APROBADA)
        ))
        .values("id", "nombre", "tipo", "piso", "local", "ultima_compra")
        .order_by("nombre")
    )


ORDENES_CLIENTES = {
    "visitas": "total_visitas", "compras": "total_compras", "monto": "total_monto", "monedas": "puntos_saldo",
}


def clientes_frecuentes(
    desde: date, hasta: date, orden: str = "visitas", limite: int = 20, procedencia: str | None = None,
) -> list:
    """Top de clientes por visitas, compras, monto gastado o monedas en su saldo, con su procedencia."""
    # El monto va en subconsulta: sumarlo junto al conteo de visitas multiplicaría las filas.
    monto = (
        SolicitudPuntos.objects.filter(
            cliente=OuterRef("pk"), estado=APROBADA, creado_en__date__gte=desde, creado_en__date__lte=hasta,
        )
        .values("cliente")
        .annotate(total=Sum("monto"))
        .values("total")
    )
    clientes = Usuario.objects.filter(
        rol=Usuario.Rol.CLIENTE, **_de_procedencia(procedencia, "procedencia")
    ).annotate(
        total_monto=Coalesce(Subquery(monto), Value(0), output_field=DecimalField(max_digits=12, decimal_places=2)),
        total_visitas=Count(
            "visitas", distinct=True,
            filter=Q(visitas__creado_en__date__gte=desde, visitas__creado_en__date__lte=hasta),
        ),
        total_compras=Count(
            "solicitudes_puntos", distinct=True,
            filter=Q(
                solicitudes_puntos__estado=APROBADA,
                solicitudes_puntos__creado_en__date__gte=desde,
                solicitudes_puntos__creado_en__date__lte=hasta,
            ),
        ),
    )
    campo = ORDENES_CLIENTES.get(orden, "total_visitas")
    filas = (
        clientes.filter(**{f"{campo}__gt": 0})
        .order_by(f"-{campo}", "username")
        .values(
            "id", "first_name", "last_name", "email", "puntos_saldo", "total_visitas", "total_compras",
            "total_monto", "procedencia", "ciudad_otra",
        )[:limite]
    )
    resultado = []
    for fila in filas:
        fila["procedencia_nombre"] = (
            f"Otro: {fila['ciudad_otra']}" if fila["procedencia"] == "OTRO" and fila["ciudad_otra"]
            else _nombre_procedencia(fila["procedencia"])
        )
        resultado.append(fila)
    return resultado


def clientes_por_procedencia(desde: date, hasta: date) -> dict:
    """De dónde son los clientes: cuántos hay, cuánto compran y cuántas monedas tienen, por procedencia.

    `ciudades` desglosa a los que vienen de fuera de Cochabamba (procedencia OTRO).
    """
    clientes = Usuario.objects.filter(rol=Usuario.Rol.CLIENTE)
    base = {
        f["procedencia"]: {
            "procedencia": f["procedencia"] or SIN_DATO,
            "nombre": _nombre_procedencia(f["procedencia"]),
            "clientes": f["clientes"],
            "monedas": f["monedas"] or 0,
            "compras": 0, "monto": 0, "visitas": 0, "clientes_con_compras": 0,
        }
        for f in clientes.values("procedencia").annotate(clientes=Count("id"), monedas=Sum("puntos_saldo"))
    }
    compras = (
        SolicitudPuntos.objects.filter(estado=APROBADA, **_rango(desde, hasta))
        .values("cliente__procedencia")
        .annotate(compras=Count("id"), monto=Sum("monto"), compradores=Count("cliente", distinct=True))
    )
    for f in compras:
        fila = base.get(f["cliente__procedencia"])
        if fila:
            fila.update(compras=f["compras"], monto=f["monto"] or 0, clientes_con_compras=f["compradores"])
    for f in Visita.objects.filter(**_rango(desde, hasta)).values("cliente__procedencia").annotate(n=Count("id")):
        if f["cliente__procedencia"] in base:
            base[f["cliente__procedencia"]]["visitas"] = f["n"]

    ciudades = (
        clientes.filter(procedencia=Usuario.Procedencia.OTRO)
        .exclude(ciudad_otra="")
        .values("ciudad_otra")
        .annotate(clientes=Count("id"), monedas=Sum("puntos_saldo"))
        .order_by("-clientes", "ciudad_otra")
    )
    return {
        **_rango_texto(desde, hasta),
        "procedencias": sorted(base.values(), key=lambda f: (-f["monto"], -f["clientes"])),
        "ciudades": [
            {"ciudad": c["ciudad_otra"], "clientes": c["clientes"], "monedas": c["monedas"] or 0} for c in ciudades
        ],
    }


def volumen_diario_por_procedencia(desde: date, hasta: date) -> list:
    """Compras aprobadas por día y procedencia (para un gráfico apilado)."""
    filas = (
        SolicitudPuntos.objects.filter(estado=APROBADA, **_rango(desde, hasta))
        .annotate(fecha=TruncDate("creado_en"))
        .values("fecha", "cliente__procedencia")
        .annotate(compras=Count("id"), monto=Sum("monto"), puntos=Sum("puntos"))
        .order_by("fecha", "cliente__procedencia")
    )
    return [
        {
            "fecha": f["fecha"], "procedencia": f["cliente__procedencia"] or SIN_DATO,
            "nombre": _nombre_procedencia(f["cliente__procedencia"]),
            "compras": f["compras"], "monto": f["monto"] or 0, "monedas": f["puntos"] or 0,
        }
        for f in filas
    ]


def clientes_dormidos(dias: int) -> list:
    """Clientes que vinieron alguna vez pero no registran visita en los últimos `dias`."""
    limite = timezone.now() - timedelta(days=dias)
    return list(
        Usuario.objects.filter(rol=Usuario.Rol.CLIENTE, is_active=True)
        .annotate(ultima_visita=Max("visitas__creado_en"))
        .filter(ultima_visita__lt=limite)
        .order_by("ultima_visita")
        .values("id", "first_name", "last_name", "email", "puntos_saldo", "ultima_visita")
    )


def historial_cliente(cliente: Usuario) -> dict:
    """Ficha del cliente: totales, tiendas donde más tickets de fidelización tiene,
    y sus últimas visitas y movimientos."""
    tiendas = (
        SolicitudPuntos.objects.filter(cliente=cliente, estado=APROBADA)
        .values("empresa", "empresa__nombre", "empresa__tipo")
        .annotate(
            tickets=Count("id"),
            monto=Sum("monto"),
            puntos=Sum("puntos"),
            ultimo_ticket=Max("creado_en"),
        )
        .order_by("-tickets", "-monto")
    )
    visitas = Visita.objects.filter(cliente=cliente)
    compras = SolicitudPuntos.objects.filter(cliente=cliente, estado=APROBADA)
    return {
        "cliente": {
            "id": cliente.id,
            "nombre": cliente.get_full_name() or cliente.username,
            "email": cliente.email,
            "celular": cliente.celular,
            "activo": cliente.is_active,
            "registrado_en": cliente.date_joined,
            "puntos_saldo": cliente.puntos_saldo,
            "procedencia_texto": cliente.procedencia_texto,
        "procedencia": cliente.procedencia,
        "procedencia_texto": cliente.procedencia_texto,
        },
        "totales": {
            "visitas": visitas.count(),
            "ultima_visita": visitas.aggregate(u=Max("creado_en"))["u"],
            "tickets": compras.count(),
            "monto_total": compras.aggregate(t=Sum("monto"))["t"] or 0,
            "tiendas_distintas": len(tiendas),
        },
        "tiendas": [
            {
                "empresa": t["empresa"],
                "nombre": t["empresa__nombre"],
                "tipo": t["empresa__tipo"],
                "tickets": t["tickets"],
                "monto": t["monto"],
                "puntos": t["puntos"],
                "ultimo_ticket": t["ultimo_ticket"],
            }
            for t in tiendas
        ],
        "ultimos_movimientos": list(
            MovimientoPuntos.objects.filter(cliente=cliente)
            .select_related("empresa")
            .values("tipo", "puntos", "descripcion", "empresa__nombre", "creado_en")[:20]
        ),
    }


RANGOS_EDAD = [(0, 17, "Menos de 18"), (18, 24, "18 a 24"), (25, 34, "25 a 34"), (35, 44, "35 a 44"),
               (45, 59, "45 a 59"), (60, 200, "60 o más")]


def _rango_edad(edad) -> str:
    if edad is None:
        return "Sin dato"
    return next(nombre for desde, hasta, nombre in RANGOS_EDAD if desde <= edad <= hasta)


def perfil_clientes(desde: date, hasta: date) -> dict:
    """Clientes por rango de edad y por ocupación: cuántos son, cuánto vienen y cuánto compran."""
    clientes = list(Usuario.objects.filter(rol=Usuario.Rol.CLIENTE).only("id", "fecha_nacimiento", "ocupacion"))
    compras = {
        f["cliente"]: f for f in SolicitudPuntos.objects.filter(estado=APROBADA, **_rango(desde, hasta))
        .values("cliente").annotate(compras=Count("id"), monto=Sum("monto"))
    }
    visitas = {
        f["cliente"]: f["n"] for f in Visita.objects.filter(**_rango(desde, hasta)).values("cliente").annotate(n=Count("id"))
    }
    nombres_ocupacion = dict(Usuario.Ocupacion.choices)

    def acumular(grupos, clave, nombre, c):
        fila = grupos.setdefault(clave, {"clave": clave, "nombre": nombre, "clientes": 0, "visitas": 0,
                                         "compras": 0, "monto": 0, "clientes_con_compras": 0})
        fila["clientes"] += 1
        fila["visitas"] += visitas.get(c.id, 0)
        compra = compras.get(c.id)
        if compra:
            fila["compras"] += compra["compras"]
            fila["monto"] += compra["monto"] or 0
            fila["clientes_con_compras"] += 1

    por_edad, por_ocupacion = {}, {}
    edades = []
    for c in clientes:
        edad = c.edad
        if edad is not None:
            edades.append(edad)
        rango = _rango_edad(edad)
        acumular(por_edad, rango, rango, c)
        ocupacion = c.ocupacion or SIN_DATO
        acumular(por_ocupacion, ocupacion, nombres_ocupacion.get(c.ocupacion, "Sin dato").split(" (")[0], c)

    orden_edad = [n for _, _, n in RANGOS_EDAD] + ["Sin dato"]
    orden_ocupacion = list(Usuario.Ocupacion.values) + [SIN_DATO]
    return {
        **_rango_texto(desde, hasta),
        "edad_promedio": round(sum(edades) / len(edades), 1) if edades else None,
        "por_edad": sorted(por_edad.values(), key=lambda f: orden_edad.index(f["clave"])),
        "por_ocupacion": sorted(por_ocupacion.values(), key=lambda f: orden_ocupacion.index(f["clave"])),
    }
