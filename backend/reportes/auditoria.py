"""Auditoría: línea de tiempo de lo que pasa en el Paseo, armada con lo que cada módulo ya guarda
(quién atendió una compra, quién aprobó una presentación, quién entregó un pedido...).

No hay una tabla aparte: cada evento sale de las marcas de fecha y responsable de su propio módulo.
"""

from empresas.models import InvitacionEmpresa
from entretenimiento.models import Propuesta
from fidelizacion.models import Canje, SolicitudPuntos, Visita
from pedidos.models import Pedido
from usuarios.models import Usuario

TIPOS = {
    "PEDIDO": "Pedidos", "COMPRA": "Compras en caja", "CANJE": "Canjes", "VISITA": "Visitas",
    "ESCENARIO": "Escenario abierto", "INVITACION": "Invitaciones", "USUARIO": "Registros",
}


def _nombre(usuario) -> str:
    if usuario is None:
        return "Sistema"
    return usuario.get_full_name() or usuario.email or usuario.username


def eventos(limite: int = 120, tipo: str | None = None) -> list:
    """Los últimos `limite` eventos (más recientes primero), de todos los módulos o de un `tipo`."""
    out = []

    def agregar(cuando, t, titulo, detalle="", actor=None):
        if cuando and (not tipo or tipo == t):
            out.append({"cuando": cuando, "tipo": t, "tipo_nombre": TIPOS[t], "titulo": titulo, "detalle": detalle, "actor": actor})

    def ultimos(qs, campo):
        return qs.exclude(**{f"{campo}__isnull": True}).order_by(f"-{campo}")[:limite]

    if not tipo or tipo == "PEDIDO":
        pedidos = Pedido.objects.select_related("cliente", "empresa").order_by("-creado_en")[:limite]
        for p in pedidos:
            base = f"{p.empresa.nombre} · Bs {p.total} · código {p.codigo_retiro}"
            agregar(p.creado_en, "PEDIDO", "Pedido creado", base, _nombre(p.cliente))
            agregar(p.pagado_en, "PEDIDO", "Pedido pagado con QR", base, _nombre(p.cliente))
            agregar(p.entregado_en, "PEDIDO", "Pedido entregado en el local", base, p.empresa.nombre)
            agregar(p.reembolsado_en, "PEDIDO", "Pedido cancelado y reembolsado", base, p.empresa.nombre)

    if not tipo or tipo == "COMPRA":
        for s in ultimos(SolicitudPuntos.objects.select_related("cliente", "empresa", "atendida_por"), "atendida_en"):
            resultado = "aprobada" if s.estado == SolicitudPuntos.Estado.APROBADA else "rechazada"
            extra = f" · {s.motivo_rechazo}" if s.motivo_rechazo else ""
            agregar(s.atendida_en, "COMPRA", f"Compra {resultado}",
                    f"{s.empresa.nombre} · Bs {s.monto} de {_nombre(s.cliente)}{extra}", _nombre(s.atendida_por))

    if not tipo or tipo == "CANJE":
        for c in Canje.objects.select_related("cliente", "recompensa").order_by("-creado_en")[:limite]:
            agregar(c.creado_en, "CANJE", "Canje de recompensa", f"{c.recompensa.nombre} · {c.monedas} monedas", _nombre(c.cliente))
            agregar(c.usado_en, "CANJE", "Cupón entregado", f"{c.recompensa.nombre} · código {c.codigo}", _nombre(c.cliente))

    if not tipo or tipo == "VISITA":
        for v in Visita.objects.select_related("cliente", "portero").order_by("-creado_en")[:limite]:
            agregar(v.creado_en, "VISITA", "Visita registrada", f"{_nombre(v.cliente)} · {v.puntos} monedas", _nombre(v.portero))

    if not tipo or tipo == "ESCENARIO":
        for p in Propuesta.objects.select_related("solicitante", "revisada_por", "espacio").order_by("-creado_en")[:limite]:
            detalle = f"{p.titulo} · {p.espacio.nombre}"
            agregar(p.creado_en, "ESCENARIO", "Solicitud de presentación", f"{detalle} · {p.artista}", _nombre(p.solicitante))
            if p.revisada_en:
                agregar(p.revisada_en, "ESCENARIO", f"Presentación {p.get_estado_display().lower()}", detalle, _nombre(p.revisada_por))

    if not tipo or tipo == "INVITACION":
        for i in InvitacionEmpresa.objects.select_related("creada_por", "aceptada_por").order_by("-creado_en")[:limite]:
            agregar(i.creado_en, "INVITACION", "Invitación enviada", f"{i.email} · {i.get_tipo_display()}", _nombre(i.creada_por))
            agregar(i.aceptada_en, "INVITACION", "Invitación aceptada", i.email, _nombre(i.aceptada_por))

    if not tipo or tipo == "USUARIO":
        for u in Usuario.objects.filter(rol=Usuario.Rol.CLIENTE).order_by("-date_joined")[:limite]:
            agregar(u.date_joined, "USUARIO", "Cliente registrado", u.email, _nombre(u))

    out.sort(key=lambda e: e["cuando"], reverse=True)
    return out[:limite]
