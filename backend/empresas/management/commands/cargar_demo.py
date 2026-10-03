"""Datos de demo: admin, portero, cliente, negocios, emprendimiento, oficina y cajero.

Uso: python manage.py cargar_demo
Todas las cuentas de demo usan la contraseña "Paseo2026!".
"""

from datetime import datetime, time, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from empresas.models import Categoria, Empresa, Horario, Oferta, Producto
from empresas.services import rol_responsable
from entretenimiento.models import Evento, Funcion, Pelicula
from fidelizacion.models import PuntoEscaneo, RangoCompra, Recompensa
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

RECOMPENSAS = [
    ("Parqueo gratis (1 hora)", "PARQUEO", 50, None),
    ("Entrada de cine 2D", "CINE", 300, None),
    ("Capuchino gratis", "PRODUCTO", 220, "Café Aranjuez"),
    ("10% de descuento en TecnoPlus", "DESCUENTO", 150, "TecnoPlus"),
    ("Combo hamburguesa clásica", "PRODUCTO", 390, "Burger Paseo"),
]
RECOMPENSAS_VIEJAS = [
    "Cupón 10% de descuento", "Producto promocional del Paseo",
    "Bs 50 de descuento en tiendas participantes", "Acceso a promoción exclusiva",
]

# Monedas por compra según el monto (Bs desde, Bs hasta, monedas).
RANGOS_COMPRA = [
    (Decimal("0"), Decimal("49.99"), Decimal("2")),
    (Decimal("50"), Decimal("99.99"), Decimal("5")),
    (Decimal("100"), Decimal("299.99"), Decimal("12")),
    (Decimal("300"), None, Decimal("40")),
]

PUNTOS_ESCANEO = [
    ("Puerta principal", "ENTRADA", Decimal("0.75"), "NFC de la entrada: una visita cada 24 horas."),
    ("Zona de juegos", "ACTIVIDAD", Decimal("0.50"), "Escanea al jugar."),
    ("Cine Paseo", "ACTIVIDAD", Decimal("0.50"), "Escanea al entrar a la función."),
]

# Cartelera de demostración (títulos ficticios).
PELICULAS = [
    ("Guardianes del Illimani", "Aventura", "+7", 112, True,
     "Tres amigos suben a la montaña para salvar un tesoro andino de unos cazadores furtivos."),
    ("Galaxia Lejana", "Ciencia ficción", "+13", 125, True,
     "Una piloto boliviana lidera la primera misión tripulada a una luna habitable."),
    ("Risas en Cochabamba", "Comedia", "ATP", 95, False,
     "Una familia intenta organizar la boda perfecta en plena Fiesta de Urkupiña."),
    ("La Última Función", "Drama", "+13", 98, False,
     "El dueño de un viejo cine de barrio se niega a cerrar sus puertas."),
]
HORARIOS = [(15, 0), (17, 30), (20, 0)]

# Eventos: (título, categoría, días desde hoy, hora, duración h, lugar, precio, destacado, descripción)
EVENTOS = [
    ("Noche de música en vivo", "MUSICA", 2, 20, 3, "Terraza, piso 4", None, True,
     "Bandas locales de rock y folclore fusión bajo las estrellas."),
    ("Taller de pintura infantil", "INFANTIL", 3, 10, 2, "Piso 2, junto a juegos", 20, False,
     "Para niños de 5 a 10 años. Materiales incluidos."),
    ("Feria gastronómica", "GASTRONOMIA", 4, 12, 6, "Planta baja", None, False,
     "Lo mejor de la comida cochabambina en un solo lugar."),
    ("Exposición de arte local", "CULTURA", 0, 10, 24 * 7, "Piso 1, hall central", None, False,
     "Obras de artistas emergentes de Cochabamba. Toda la semana."),
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
                      first_name="Cliente", last_name="Demo", ci="1234567", celular="71234567")

        for nombre, tipo, categoria, piso, local, productos in EMPRESAS:
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
        for nombre, categoria, costo, empresa_nombre in RECOMPENSAS:
            empresa = Empresa.objects.get(nombre=empresa_nombre) if empresa_nombre else None
            Recompensa.objects.update_or_create(
                nombre=nombre,
                defaults={"categoria": categoria, "costo_puntos": costo, "empresa": empresa, "activo": True},
            )
        # Las recompensas de la versión anterior de la demo (en puntos enteros) se desactivan.
        Recompensa.objects.filter(nombre__in=RECOMPENSAS_VIEJAS).update(activo=False)

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

        self._diversion()
        self._visita_demo()

        self.stdout.write(self.style.SUCCESS(f"Datos de demo listos. Contraseña de todas las cuentas: {PASSWORD}"))
        self.stdout.write(f"Código QR/NFC de Café Aranjuez: {cafe.codigo_fidelizacion}")
        for punto in puntos:
            self.stdout.write(f"{punto.nombre} ({punto.monedas} monedas): paseo360://f/{punto.codigo}")

    def _diversion(self):
        """Cartelera y eventos con fechas relativas a hoy (se regeneran en cada corrida)."""
        zona = timezone.get_current_timezone()
        hoy = timezone.localdate()

        def momento(dias, hora, minuto=0):
            return timezone.make_aware(datetime.combine(hoy + timedelta(days=dias), time(hora, minuto)), zona)

        for i, (titulo, genero, clasif, duracion, estreno, sinopsis) in enumerate(PELICULAS):
            pelicula, _ = Pelicula.objects.update_or_create(
                titulo=titulo,
                defaults=dict(genero=genero, clasificacion=clasif, duracion_min=duracion,
                              estreno=estreno, sinopsis=sinopsis, activo=True),
            )
            pelicula.funciones.filter(inicio__gte=momento(0, 0)).delete()
            for dia in range(4):
                for j, (hora, minuto) in enumerate(HORARIOS):
                    tres_d = estreno and j == 2
                    Funcion.objects.create(
                        pelicula=pelicula, inicio=momento(dia, hora, minuto), sala=f"Sala {i + 1}",
                        formato="3D" if tres_d else "2D", idioma="SUB" if j == 2 else "DOB",
                        precio=Decimal("45") if tres_d else Decimal("35"),
                    )

        for titulo, categoria, dias, hora, horas, lugar, precio, destacado, descripcion in EVENTOS:
            inicio = momento(dias, hora)
            Evento.objects.update_or_create(
                titulo=titulo,
                defaults=dict(categoria=categoria, inicio=inicio, fin=inicio + timedelta(hours=horas),
                              lugar=lugar, precio=precio, destacado=destacado, descripcion=descripcion,
                              activo=True),
            )

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
