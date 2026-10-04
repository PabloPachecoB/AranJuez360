"""Genera actividad ficticia (clientes, visitas y compras) para ver el dashboard con datos.

Uso: python manage.py cargar_actividad_demo [--dias 30] [--clientes 40]
Requiere haber corrido antes `cargar_demo`. Es determinista (misma semilla) y
borra la actividad de demo anterior antes de generar la nueva.
"""

import random
from datetime import datetime, time, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from empresas.models import Empresa
from fidelizacion.models import ConfiguracionPuntos, MovimientoPuntos, SolicitudPuntos, Visita
from fidelizacion.services import calcular_puntos
from usuarios.models import Usuario

NOMBRES = ["Ana", "Luis", "María", "Jorge", "Camila", "Diego", "Valeria", "Andrés", "Sofía", "Mateo",
           "Lucía", "Gabriel", "Daniela", "Sebastián", "Paola", "Rodrigo", "Fernanda", "Marco", "Natalia", "Iván"]
APELLIDOS = ["Rojas", "Mamani", "Quispe", "Gutiérrez", "Flores", "Vargas", "Choque", "Pérez", "López", "Salazar"]
DOMINIO = "demo.paseo.bo"
# De dónde vienen los clientes (peso aproximado): la mayoría de la ciudad y alrededores.
PROCEDENCIAS = [("CERCADO", 46), ("QUILLACOLLO", 18), ("CHAPARE", 12), ("GERMAN_JORDAN", 4), ("PUNATA", 4),
                ("ESTEBAN_ARCE", 3), ("CAPINOTA", 2), ("CARRASCO", 2), ("OTRO", 9)]
CIUDADES_FUERA = ["La Paz", "Santa Cruz", "Oruro", "Sucre", "Potosí", "Tarija"]
# Peso de cada hora del día (10 a 21): picos al mediodía y por la tarde-noche.
PESO_HORA = {10: 2, 11: 3, 12: 6, 13: 8, 14: 5, 15: 3, 16: 3, 17: 5, 18: 8, 19: 9, 20: 6, 21: 2}
# Peso por día de la semana (0 = lunes): más movimiento el fin de semana.
PESO_DIA = [0.7, 0.7, 0.8, 0.9, 1.2, 1.6, 1.3]


class Command(BaseCommand):
    help = "Genera visitas y compras ficticias para el dashboard."

    def add_arguments(self, parser):
        parser.add_argument("--dias", type=int, default=30)
        parser.add_argument("--clientes", type=int, default=40)

    def _momento(self, rnd, dia):
        hora = rnd.choices(list(PESO_HORA), weights=list(PESO_HORA.values()))[0]
        naive = datetime.combine(dia, time(hora, rnd.randint(0, 59)))
        return timezone.make_aware(naive)

    @transaction.atomic
    def handle(self, *args, **opts):
        rnd = random.Random(360)
        portero = Usuario.objects.filter(rol=Usuario.Rol.PORTERO).first()
        negocios = list(Empresa.objects.exclude(tipo=Empresa.Tipo.OFICINA).filter(activo=True))
        if not portero or not negocios:
            raise CommandError("Corre primero `python manage.py cargar_demo`.")
        cajeros = {e.id: e.usuarios.filter(rol__in=["NEGOCIO", "CAJERO"]).first() for e in negocios}
        config = ConfiguracionPuntos.actual()

        # Limpia la actividad de demo anterior.
        demo = Usuario.objects.filter(username__endswith=f"@{DOMINIO}")
        MovimientoPuntos.objects.filter(cliente__in=demo).delete()
        SolicitudPuntos.objects.filter(cliente__in=demo).delete()
        Visita.objects.filter(cliente__in=demo).delete()
        demo.delete()

        hoy = timezone.localdate()
        clientes = []
        for i in range(opts["clientes"]):
            nombre, apellido = rnd.choice(NOMBRES), rnd.choice(APELLIDOS)
            c = Usuario(
                username=f"cliente{i + 1}@{DOMINIO}", email=f"cliente{i + 1}@{DOMINIO}",
                first_name=nombre, last_name=apellido, rol=Usuario.Rol.CLIENTE,
                ci=str(4_000_000 + i * 7919), celular=f"7{rnd.randint(1_000_000, 9_999_999)}",
                email_verificado=True,
            )
            c.procedencia = rnd.choices([p for p, _ in PROCEDENCIAS], weights=[w for _, w in PROCEDENCIAS])[0]
            if c.procedencia == "OTRO":
                c.ciudad_otra = rnd.choice(CIUDADES_FUERA)
            # Edad y ocupación coherentes: colegio 13–17, universidad 18–26, profesionales 24–60.
            c.ocupacion = rnd.choices(["ESTUDIANTE", "UNIVERSITARIO", "PROFESIONAL", "OTRO"], weights=[15, 35, 35, 15])[0]
            edad = {"ESTUDIANTE": (13, 17), "UNIVERSITARIO": (18, 26), "PROFESIONAL": (24, 60), "OTRO": (20, 70)}[c.ocupacion]
            c.fecha_nacimiento = hoy - timedelta(days=rnd.randint(edad[0] * 365, edad[1] * 365 + 364))
            c.set_unusable_password()
            clientes.append(c)
        Usuario.objects.bulk_create(clientes)
        clientes = list(Usuario.objects.filter(username__endswith=f"@{DOMINIO}").order_by("id"))
        # Algunos clientes "dormidos": solo vinieron la primera semana del periodo.
        dormidos = set(rnd.sample(range(len(clientes)), k=max(1, len(clientes) // 8)))

        visitas = compras = 0
        for idx, cliente in enumerate(clientes):
            # Frecuencia: unos pocos muy fieles, la mayoría ocasionales.
            freq = rnd.choice([0.6, 0.35, 0.2, 0.1, 0.1, 0.05, 0.05])
            favoritos = rnd.sample(negocios, k=min(len(negocios), rnd.randint(1, 3)))
            hasta_atras = opts["dias"] - 7 if idx in dormidos else 0
            for atras in range(opts["dias"] - 1, hasta_atras - 1, -1):
                dia = hoy - timedelta(days=atras)
                prob = max(freq, 0.5) if idx in dormidos else freq
                if rnd.random() > prob * PESO_DIA[dia.weekday()]:
                    continue
                momento = self._momento(rnd, dia)
                visita = Visita.objects.create(cliente=cliente, portero=portero, puntos=config.puntos_por_visita)
                Visita.objects.filter(pk=visita.pk).update(creado_en=momento)
                mov = MovimientoPuntos.objects.create(
                    cliente=cliente, visita=visita, puntos=visita.puntos,
                    tipo=MovimientoPuntos.Tipo.VISITA, descripcion="Visita al Paseo",
                )
                MovimientoPuntos.objects.filter(pk=mov.pk).update(creado_en=momento)
                visitas += 1

                # En ~60% de las visitas compra en 1 o 2 negocios (sobre todo sus favoritos).
                if rnd.random() < 0.6:
                    for _ in range(rnd.choice([1, 1, 1, 2])):
                        empresa = rnd.choice(favoritos) if rnd.random() < 0.75 else rnd.choice(negocios)
                        monto = Decimal(rnd.choice([15, 22, 25, 35, 45, 60, 80, 120, 180, 250, 320]))
                        cuando = momento + timedelta(minutes=rnd.randint(10, 90))
                        aprobada = rnd.random() > 0.07
                        s = SolicitudPuntos.objects.create(
                            cliente=cliente, empresa=empresa, nit=str(rnd.randint(1_000_000, 9_999_999)),
                            monto=monto, atendida_por=cajeros[empresa.id], atendida_en=cuando,
                            estado=SolicitudPuntos.Estado.APROBADA if aprobada else SolicitudPuntos.Estado.RECHAZADA,
                            puntos=calcular_puntos(monto, config) if aprobada else 0,
                            motivo_rechazo="" if aprobada else "Monto no coincide con el ticket",
                        )
                        SolicitudPuntos.objects.filter(pk=s.pk).update(creado_en=cuando)
                        if aprobada:
                            m = MovimientoPuntos.objects.create(
                                cliente=cliente, empresa=empresa, solicitud=s, puntos=s.puntos,
                                tipo=MovimientoPuntos.Tipo.COMPRA, descripcion=f"Compra de Bs {monto}",
                            )
                            MovimientoPuntos.objects.filter(pk=m.pk).update(creado_en=cuando)
                            compras += 1

            saldo = MovimientoPuntos.objects.filter(cliente=cliente).aggregate(t=Sum("puntos"))["t"] or 0
            alta = timezone.make_aware(datetime.combine(hoy - timedelta(days=rnd.randint(0, opts["dias"] + 20)), time(9)))
            Usuario.objects.filter(pk=cliente.pk).update(puntos_saldo=saldo, date_joined=alta)

        self.stdout.write(self.style.SUCCESS(
            f"Actividad de demo: {len(clientes)} clientes, {visitas} visitas, {compras} compras aprobadas."
        ))
