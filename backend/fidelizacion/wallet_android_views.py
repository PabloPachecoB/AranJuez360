"""Puente mínimo entre el frontend de Wallet Android y Google Wallet real (issue #42).

Publica el pase que le pasan y devuelve el enlace real de "Agregar a Google
Wallet". No guarda nada en base de datos: la persistencia de cuentas, compras
y puntos es tarea de "Backend compartido de fidelización" (sin asignar, ver
docs/FIDELIZACION_EQUIPO.md). Esto solo conecta el botón con la cuenta real,
que es el criterio de aceptación de "Completar Google Wallet en Android".
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
