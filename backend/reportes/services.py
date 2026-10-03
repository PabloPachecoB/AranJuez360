"""Estadísticas del dashboard administrativo.

Solo se mide lo que pasa por el sistema: visitas = clientes registrados en
portería; compras = tickets de fidelización aprobados en caja (no las ventas
totales de cada tienda, que viven en sus propios sistemas).
"""

from datetime import date, timedelta

from django.db.models import Count, Max, Q, Sum
from django.db.models.functions import ExtractHour, ExtractIsoWeekDay, TruncDate
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


def visitas_por_dia(desde: date, hasta: date) -> list:
    filas = (
        Visita.objects.filter(**_rango(desde, hasta))
        .annotate(fecha=TruncDate("creado_en"))
        .values("fecha")
        .annotate(visitas=Count("id"), clientes=Count("cliente", distinct=True), puntos=Sum("puntos"))
        .order_by("fecha")
    )
    return list(filas)


def compras_por_dia(desde: date, hasta: date) -> list:
    filas = (
        SolicitudPuntos.objects.filter(estado=APROBADA, **_rango(desde, hasta))
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


def clientes_frecuentes(desde: date, hasta: date, orden: str = "visitas", limite: int = 20) -> list:
    clientes = Usuario.objects.filter(rol=Usuario.Rol.CLIENTE).annotate(
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
    campo = "total_compras" if orden == "compras" else "total_visitas"
    filas = (
        clientes.filter(**{f"{campo}__gt": 0})
        .order_by(f"-{campo}", "username")
        .values("id", "first_name", "last_name", "email", "puntos_saldo", "total_visitas", "total_compras")
    )
    return list(filas[:limite])


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
