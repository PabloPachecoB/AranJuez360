"""Puente mínimo entre el frontend de Wallet Android y Google Wallet real (issue #42).

Publica el pase que le pasan y devuelve el enlace real de "Agregar a Google
Wallet". No guarda nada en base de datos: la persistencia de cuentas, compras
y puntos es tarea de "Backend compartido de fidelización" (sin asignar, ver
docs/FIDELIZACION_EQUIPO.md). Esto solo conecta el botón con la cuenta real,
que es el criterio de aceptación de "Completar Google Wallet en Android".

ADVERTENCIA DE SEGURIDAD (temporal, a propósito):
Este endpoint es público (AllowAny) y confía en los montos que le manda el
cliente — no hay todavía una cuenta real ni un historial de compras contra
los cuales validar `puntos`/`participaciones`/`faltan_bs`. Hoy eso es
aceptable porque el botón del cliente (`MiTarjetaPage`) tampoco tiene sesión
y los datos que muestra son simulados. **En cuanto el "Backend compartido de
fidelización" exista y los códigos correspondan a cuentas reales, este
endpoint debe dejar de aceptar los montos del cliente** y en su lugar leer el
estado real de la cuenta en el servidor (el cliente solo pasaría el código).
De lo contrario cualquiera que conozca un código real podría forjar puntos
falsos y sobreescribir el pase real de otra persona en Google Wallet.
"""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .wallet_google import (
    ClienteWallet,
    EstadoTarjeta,
    WalletErrorAPI,
    WalletNoConfigurado,
    cargar_config,
    enlace_guardar_existente,
)

CAMPOS_REQUERIDOS = ("codigo", "puntos", "participaciones", "faltan_bs", "pendientes", "fecha_sorteo")


@api_view(["POST"])
@permission_classes([AllowAny])
def publicar_tarjeta(request):
    datos = request.data
    faltantes = [c for c in CAMPOS_REQUERIDOS if c not in datos]
    if faltantes:
        raise ValidationError({c: ["Este campo es obligatorio."] for c in faltantes})

    try:
        estado = EstadoTarjeta(
            codigo=str(datos["codigo"]),
            puntos=int(datos["puntos"]),
            participaciones=int(datos["participaciones"]),
            faltan_bs=int(datos["faltan_bs"]),
            pendientes=int(datos["pendientes"]),
            fecha_sorteo=str(datos["fecha_sorteo"]),
            primer_nombre=str(datos.get("primer_nombre", "")),
        )
    except (TypeError, ValueError) as e:
        raise ValidationError({"detail": "Datos inválidos."}) from e

    try:
        cfg = cargar_config()
        cliente = ClienteWallet(cfg)
        cliente.publicar_clase()
        cliente.publicar_pase(estado)
        enlace = enlace_guardar_existente(cfg, estado.codigo)
    except (WalletNoConfigurado, WalletErrorAPI) as e:
        return Response({"detail": str(e)}, status=503)

    return Response({"enlace_wallet": enlace})
