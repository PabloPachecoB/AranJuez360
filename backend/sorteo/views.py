import logging

from django.conf import settings
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from usuarios.models import Usuario
from usuarios.permissions import EsAdmin

from . import canales, pase, services
from .errores import SorteoError
from .models import CuentaFidelizacion
from .permissions import EsTitular, PuedeResolverTarjeta
from .red import LimiteSorteo, ip_cliente
from .serializers import (
    DesafioSerializer,
    RecuperarSerializer,
    RegistroSerializer,
    RevocarSerializer,
    VerificarSerializer,
)
from .sesion import SesionTarjeta, emitir_sesion

logger = logging.getLogger(__name__)


class _SinCache(APIView):
    """Las respuestas del sorteo llevan datos de una persona o su sesión: ningún navegador ni proxy debe guardarlas."""

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response["Cache-Control"] = "no-store"
        return response


class _ConLimite(_SinCache):
    """Límite de peticiones por alcance (`throttle_scope`), con un aviso en español y código estable."""

    throttle_classes = [LimiteSorteo]

    def throttled(self, request, wait):
        segundos = max(1, int(wait or 1))
        error = SorteoError(
            "demasiadas_peticiones",
            f"Hay mucha gente ahora. Prueba en {segundos} segundos.", 429,
        )
        error.wait = segundos  # DRF lo convierte en la cabecera Retry-After
        raise error


class _Publica(_ConLimite):
    """Rutas abiertas: sin autenticación."""

    authentication_classes = []
    permission_classes = [AllowAny]


def _respuesta_desafio(desafio, codigo_http=status.HTTP_200_OK) -> Response:
    return Response({
        "desafio": str(desafio.desafio),
        "canal": desafio.canal,
        "destino": canales.enmascarar(desafio.canal, desafio.destino),
        "vence_en_minutos": settings.CODIGO_VERIFICACION_MINUTOS,
    }, status=codigo_http)


class CampaniaView(_Publica):
    """Reglas de la campaña activa y canales de verificación. Sin límite: solo lee y la carga cada visitante."""

    throttle_classes = []

    def get(self, request):
        return Response({
            **services.datos_campania(services.campania_activa()),
            "canales": canales.canales_disponibles(),
            "terminos_url": settings.SORTEO_TERMINOS_URL or None,
        })


class RegistroView(_Publica):
    throttle_scope = "sorteo_envio"

    def post(self, request):
        entrada = RegistroSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        desafio = services.registrar(**entrada.validated_data, ip=ip_cliente(request))
        return _respuesta_desafio(desafio, status.HTTP_201_CREATED)


class VerificarView(_Publica):
    throttle_scope = "sorteo_verificar"

    def post(self, request):
        entrada = VerificarSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        cuenta = services.verificar(entrada.validated_data["desafio"], entrada.validated_data["codigo"])
        return Response({"sesion": emitir_sesion(cuenta), "tarjeta": services.datos_tarjeta(cuenta)})


class ReenviarView(_Publica):
    throttle_scope = "sorteo_envio"

    def post(self, request):
        entrada = DesafioSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        return _respuesta_desafio(services.reenviar(entrada.validated_data["desafio"], ip=ip_cliente(request)))


class RecuperarView(_Publica):
    throttle_scope = "sorteo_envio"

    def post(self, request):
        entrada = RecuperarSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        return _respuesta_desafio(services.recuperar(entrada.validated_data["contacto"], ip=ip_cliente(request)))


class _Titular(_SinCache):
    authentication_classes = [SesionTarjeta]
    permission_classes = [EsTitular]


class MiTarjetaView(_Titular):
    def get(self, request):
        return Response(services.datos_tarjeta(request.user.cuenta))


class CerrarSesionView(_Titular):
    """Cierra la sesión del titular en todos sus dispositivos."""

    def post(self, request):
        services.cerrar_sesiones(request.user.cuenta)
        return Response(status=status.HTTP_204_NO_CONTENT)


class GoogleWalletView(_Titular):
    def post(self, request):
        registro, url = pase.publicar_google(request.user.cuenta)
        return Response({"url": url, "estado": registro.estado_sync})


class AppleWalletView(_Titular):
    def post(self, request):
        raise SorteoError("apple_pendiente", "Apple Wallet estará disponible pronto.", status.HTTP_501_NOT_IMPLEMENTED)


class ResolverView(_ConLimite):
    """Caja o admin escanean la tarjeta: devuelve la cuenta del código (reducida salvo para el admin).

    Tiene límite por usuario y deja rastro: nadie puede probar códigos en masa sin que se note.
    """

    permission_classes = [PuedeResolverTarjeta]
    throttle_scope = "sorteo_resolver"

    def get(self, request, codigo):
        try:
            cuenta = services.resolver_codigo(codigo)
        except SorteoError:
            logger.warning("Tarjeta no válida consultada por el usuario %s (empresa %s)",
                           request.user.pk, request.user.empresa_id)
            raise
        services.registrar_resolucion(cuenta, request.user)
        datos = {
            "referencia": str(cuenta.referencia),
            "nombre": cuenta.nombre_reducido,
            "campania_activa": services.campania_activa() is not None,
        }
        if request.user.rol == Usuario.Rol.ADMIN:
            datos.update({
                "id": cuenta.pk,
                "nombres": cuenta.nombres,
                "apellidos": cuenta.apellidos,
                "correo": cuenta.correo,
                "correo_verificado": cuenta.correo_verificado_en is not None,
                "celular": cuenta.celular,
                "celular_verificado": cuenta.celular_verificado_en is not None,
                "estado": cuenta.estado,
                "posibles_duplicados": services.posibles_duplicados(cuenta),
            })
        return Response(datos)


class RevocarCodigoView(_SinCache):
    permission_classes = [EsAdmin]

    def post(self, request, pk):
        entrada = RevocarSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        cuenta = get_object_or_404(CuentaFidelizacion, pk=pk)
        nuevo = services.revocar_codigo(cuenta.pk, request.user, entrada.validated_data["motivo"])
        pase.resincronizar_si_existe(cuenta)
        return Response({"codigo": nuevo.codigo, "pases": services.estado_pases(cuenta)})
