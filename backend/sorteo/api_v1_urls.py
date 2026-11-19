from django.urls import path

from . import views

urlpatterns = [
    path("campania/", views.CampaniaView.as_view(), name="sorteo-campania"),
    path("registro/", views.RegistroView.as_view(), name="sorteo-registro"),
    path("verificar/", views.VerificarView.as_view(), name="sorteo-verificar"),
    path("reenviar/", views.ReenviarView.as_view(), name="sorteo-reenviar"),
    path("recuperar/", views.RecuperarView.as_view(), name="sorteo-recuperar"),
    path("mi-tarjeta/", views.MiTarjetaView.as_view(), name="sorteo-mi-tarjeta"),
    path("mi-tarjeta/cerrar-sesion/", views.CerrarSesionView.as_view(), name="sorteo-cerrar-sesion"),
    path("mi-tarjeta/google-wallet/", views.GoogleWalletView.as_view(), name="sorteo-google-wallet"),
    path("mi-tarjeta/apple-wallet/", views.AppleWalletView.as_view(), name="sorteo-apple-wallet"),
    path("resolver/<str:codigo>/", views.ResolverView.as_view(), name="sorteo-resolver"),
    path("admin/cuentas/<int:pk>/revocar-codigo/", views.RevocarCodigoView.as_view(), name="sorteo-revocar-codigo"),
]
