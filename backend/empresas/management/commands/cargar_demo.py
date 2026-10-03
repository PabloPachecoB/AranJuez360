"""Datos de demo: admin, portero, cliente, negocios, emprendimiento, oficina y cajero.

Uso: python manage.py cargar_demo
Todas las cuentas de demo usan la contraseña "Paseo2026!".
"""

from datetime import time, timedelta
from decimal import Decimal

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from empresas.models import Categoria, Empresa, Horario, Oferta, Producto
from empresas.services import rol_responsable
from empresas.rubros import rubro_comercial
from fidelizacion.models import ConfiguracionPuntos, PuntoEscaneo, RangoCompra, Recompensa
from usuarios.models import Usuario

PASSWORD = "Paseo2026!"

EMPRESAS = [
    ("Café Aranjuez", "NEGOCIO", "Comida", "1", "12", [("Chocolate caliente", 25), ("Capuchino", 22)]),
    ("Burger Paseo", "NEGOCIO", "Comida", "1", "05", [("Hamburguesa clásica", 45), ("Papas fritas", 18)]),
    ("TecnoPlus", "NEGOCIO", "Tecnología", "2", "21", [("Audífonos Bluetooth", 250), ("Cargador rápido", 120)]),
    ("Moda Urbana", "NEGOCIO", "Moda", "2", "08", [("Camisa de lino", 180), ("Jeans slim", 260)]),
    ("Dulce Hogar", "EMPRENDIMIENTO", "Comida", "PB", "K3", [("Brownie artesanal", 15), ("Alfajores x6", 30)]),
    ("Estudio Legal Andino", "OFICINA", "Servicios profesionales", "5", "502",
     [("Asesoría legal (consulta)", 200)]),
    ("Consultorio Dental Sonrisa", "OFICINA", "Salud", "4", "405",
     [("Limpieza dental", 150), ("Consulta y diagnóstico", 80)]),
    ("Agencia Digital Tunari", "OFICINA", "Tecnología", "5", "510",
     [("Diseño de página web", 1500), ("Manejo de redes sociales (mes)", 900)]),
]

# Datos del mini-sitio de cada empresa (lema, descripción, WhatsApp; en oficinas, sección "Servicios").
FICHAS = {
    "Estudio Legal Andino": ("Asesoría legal cercana y clara",
                             "Abogados especialistas en derecho civil, laboral y comercial. Atención con cita previa.",
                             "71230001"),
    "Consultorio Dental Sonrisa": ("Tu sonrisa en buenas manos",
                                   "Odontología general, limpiezas, ortodoncia y blanqueamiento. Atendemos niños y adultos.",
                                   "71230002"),
    "Agencia Digital Tunari": ("Hacemos crecer tu marca en internet",
                               "Diseño web, redes sociales y publicidad digital para negocios de Cochabamba.",
                               "71230003"),
    "Dulce Hogar": ("Repostería casera de Cochabamba",
                    "Emprendimiento familiar: brownies, alfajores y tortas por encargo. Estamos en el kiosco K3.",
                    "71230004"),
}

OFERTAS = [
    ("Burger Paseo", "Hamburguesa clásica", "Combo hamburguesa clásica con papas", 39),
    ("Café Aranjuez", "Capuchino", "2x1 en capuchinos", 22),
    ("TecnoPlus", "Audífonos Bluetooth", "Audífonos Bluetooth -20%", 199),
    ("Dulce Hogar", "Alfajores x6", "Alfajores artesanales x6", 24),
]

# Escala: 1000 monedas = Bs 30. (nombre, categoría, costo en monedas, negocio, valor real en Bs)
# Lo del Paseo (parqueo, cine) va por debajo de su valor; los productos de tiendas, un poco por encima.
RECOMPENSAS = [
    ("Parqueo gratis (1 hora)", "PARQUEO", 150, None, 5),
    ("Entrada de cine 2D", "CINE", 1000, None, 35),
    ("Capuchino gratis", "PRODUCTO", 760, "Café Aranjuez", 22),
    ("Combo hamburguesa clásica", "PRODUCTO", 1580, "Burger Paseo", 45),
    ("10% de descuento en TecnoPlus", "DESCUENTO", 500, "TecnoPlus", None),
    ("Audífonos Bluetooth", "PRODUCTO", 9170, "TecnoPlus", 250),
    ("Camisa de lino", "PRODUCTO", 6600, "Moda Urbana", 180),
]
RECOMPENSAS_VIEJAS = [
    "Cupón 10% de descuento", "Producto promocional del Paseo",
    "Bs 50 de descuento en tiendas participantes", "Acceso a promoción exclusiva",
]

# Monedas por compra según el monto (Bs desde, Bs hasta, monedas): retorno de ~2,5%.
RANGOS_COMPRA = [
    (Decimal("10"), Decimal("49.99"), Decimal("20")),
    (Decimal("50"), Decimal("99.99"), Decimal("60")),
    (Decimal("100"), Decimal("199.99"), Decimal("130")),
    (Decimal("200"), Decimal("499.99"), Decimal("300")),
    (Decimal("500"), None, Decimal("800")),
]

PUNTOS_ESCANEO = [
    ("Puerta principal", "ENTRADA", Decimal("20"), "NFC de la entrada: una visita cada 24 horas."),
    ("Zona de juegos", "ACTIVIDAD", Decimal("15"), "Escanea al jugar."),
    ("Cine Paseo", "ACTIVIDAD", Decimal("15"), "Escanea al entrar a la función."),
]

# Cartelera y eventos ficticios de versiones anteriores: importar_agenda_paseo los retira de la app.
PELICULAS_FICTICIAS = ["Guardianes del Illimani", "Galaxia Lejana", "Risas en Cochabamba", "La Última Función"]
EVENTOS_FICTICIOS = [
    "Noche de música en vivo", "Taller de pintura infantil", "Feria gastronómica", "Exposición de arte local",
]


class Command(BaseCommand):
    help = "Carga datos de demostración para Paseo Aranjuez 360."

    def _usuario(self, username, **campos):
        campos.setdefault("email_verificado", True)
        user, creado = Usuario.objects.get_or_create(username=username, defaults=campos)
        if creado:
            user.set_password(PASSWORD)
            user.save()
        return user

    @transaction.atomic
    def handle(self, *args, **options):
        self._usuario("admin@paseo.bo", email="admin@paseo.bo", rol=Usuario.Rol.ADMIN,
                      is_staff=True, is_superuser=True)
        self._usuario("portero@paseo.bo", email="portero@paseo.bo", rol=Usuario.Rol.PORTERO,
                      first_name="Portero", last_name="Demo")
        self._usuario("cliente@paseo.bo", email="cliente@paseo.bo", rol=Usuario.Rol.CLIENTE,
                      first_name="Cliente", last_name="Demo", ci="1234567", celular="71234567",
                      procedencia="CERCADO")
        # Si la cuenta ya existía (de una carga anterior), se completa su procedencia.
        Usuario.objects.filter(username="cliente@paseo.bo", procedencia="").update(procedencia="CERCADO")

        for nombre, tipo, categoria, piso, local, productos in EMPRESAS:
            if tipo != Empresa.Tipo.OFICINA:
                categoria = rubro_comercial(categoria, nombre)
            cat, _ = Categoria.objects.get_or_create(nombre=categoria)
            slug = nombre.lower().replace(" ", "").replace("é", "e")
            empresa, creada = Empresa.objects.get_or_create(
                nombre=nombre,
                defaults=dict(tipo=tipo, categoria=cat, email_contacto=f"{slug}@paseo.bo",
                              piso=piso, local=local),
            )
            if creada:
                for dia in range(6):
                    Horario.objects.create(empresa=empresa, dia=dia, abre=time(10), cierra=time(21))
                Horario.objects.create(empresa=empresa, dia=6, cerrado=True)
                for prod, precio in productos:
                    Producto.objects.create(empresa=empresa, nombre=prod, precio=precio)
            self._usuario(empresa.email_contacto, email=empresa.email_contacto,
                          rol=rol_responsable(empresa), empresa=empresa)
            if nombre in FICHAS:
                lema, descripcion, whatsapp = FICHAS[nombre]
                Empresa.objects.filter(pk=empresa.pk).update(lema=lema, descripcion=descripcion, whatsapp=whatsapp)
                if tipo == "OFICINA":
                    empresa.productos.filter(seccion="").update(seccion="Servicios")

        # Ofertas vigentes (se renuevan cada vez que se corre el comando).
        hoy = timezone.localdate()
        for empresa_nombre, producto_nombre, titulo, precio in OFERTAS:
            empresa = Empresa.objects.get(nombre=empresa_nombre)
            Oferta.objects.update_or_create(
                empresa=empresa, titulo=titulo,
                defaults=dict(producto=empresa.productos.filter(nombre=producto_nombre).first(),
                              precio_oferta=precio, inicio=hoy, fin=hoy + timedelta(days=30), activo=True),
            )

        cafe = Empresa.objects.get(nombre="Café Aranjuez")
        # Recompensas en monedas (1 moneda = Bs 0,10).
        for nombre, categoria, costo, empresa_nombre, valor in RECOMPENSAS:
            empresa = Empresa.objects.get(nombre=empresa_nombre) if empresa_nombre else None
            Recompensa.objects.update_or_create(
                nombre=nombre,
                defaults={"categoria": categoria, "costo_puntos": costo, "empresa": empresa, "activo": True,
                          "valor_bs": valor,
                          # Parqueo gratis: además de las monedas, venir 15 días seguidos.
                          "racha_minima_dias": 15 if categoria == "PARQUEO" else 0},
            )
        config = ConfiguracionPuntos.actual()
        config.valor_moneda_bs, config.puntos_por_visita = Decimal("0.03"), Decimal("20")
        config.save(update_fields=["valor_moneda_bs", "puntos_por_visita"])
        # Las recompensas de la versión anterior de la demo (en puntos enteros) se desactivan.
        Recompensa.objects.filter(nombre__in=RECOMPENSAS_VIEJAS).update(activo=False)

        # Los rangos de la escala anterior se reemplazan por los nuevos.
        RangoCompra.objects.exclude(monto_minimo__in=[r[0] for r in RANGOS_COMPRA]).delete()
        for minimo, maximo, monedas in RANGOS_COMPRA:
            RangoCompra.objects.update_or_create(
                monto_minimo=minimo, defaults={"monto_maximo": maximo, "monedas": monedas, "activo": True},
            )

        puntos = []
        for nombre, tipo, monedas, descripcion in PUNTOS_ESCANEO:
            punto, _ = PuntoEscaneo.objects.update_or_create(
                nombre=nombre, defaults={"tipo": tipo, "monedas": monedas, "descripcion": descripcion},
            )
            puntos.append(punto)
        self._usuario("caja.cafe@paseo.bo", email="caja.cafe@paseo.bo", rol=Usuario.Rol.CAJERO, empresa=cafe)

        # Cartelera y eventos reales del Paseo (retira los ficticios de versiones anteriores).
        call_command("importar_agenda_paseo", stdout=self.stdout)
        self._visita_demo()

        self.stdout.write(self.style.SUCCESS(f"Datos de demo listos. Contraseña de todas las cuentas: {PASSWORD}"))
        self.stdout.write(f"Código QR/NFC de Café Aranjuez: {cafe.codigo_fidelizacion}")
        for punto in puntos:
            self.stdout.write(f"{punto.nombre} ({punto.monedas} monedas): paseo360://f/{punto.codigo}")

    def _visita_demo(self):
        """Una solicitud de visita pendiente del cliente demo al estudio legal (para probar la bandeja)."""
        from oficinas.models import Invitacion

        cliente = Usuario.objects.get(username="cliente@paseo.bo")
        oficina = Empresa.objects.get(nombre="Estudio Legal Andino")
        manana = timezone.localdate() + timedelta(days=1)
        if not Invitacion.objects.filter(cliente=cliente, oficina=oficina, fecha__gte=timezone.localdate()).exists():
            Invitacion.objects.create(
                oficina=oficina, cliente=cliente, visitante_nombre=cliente.get_full_name(),
                visitante_ci=cliente.ci or "", visitante_celular=cliente.celular, fecha=manana,
                hora=time(10, 30), motivo="Consulta sobre contrato de alquiler", origen="SOLICITUD",
            )
