from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenRefreshView

from oficinas.views import invitacion_publica
from pedidos.views import pago_simulado

urlpatterns = [
    path("admin/", admin.site.urls),
    # El login (con doble autenticación) vive en /api/v1/auth/login/; aquí solo el refresh.
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/v1/", include("paseo_erp.api_v1_urls")),
    # Página con el QR de una invitación a oficina (se comparte por WhatsApp a quien no tiene la app).
    path("invitacion/<str:codigo>/", invitacion_publica, name="invitacion-publica"),
    # Banco simulado: el QR de cobro de un pedido de Comer abre esta página para "pagar".
    path("pago-simulado/<str:referencia>/", pago_simulado, name="pago-simulado"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
