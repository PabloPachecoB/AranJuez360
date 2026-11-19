from datetime import date
from decimal import Decimal
from io import StringIO

from django.core.exceptions import ValidationError
from django.core.management import CommandError, call_command
from django.db import IntegrityError, transaction
from django.test import TestCase

from sorteo.models import Campania


class CampaniaTests(TestCase):
    def test_solo_una_campania_activa(self):
        Campania.objects.create(estado=Campania.Estado.ACTIVA)
        with self.assertRaises(IntegrityError), transaction.atomic():
            Campania.objects.create(estado=Campania.Estado.ACTIVA)
        # pausadas o cerradas, todas las que se quiera
        Campania.objects.create(estado=Campania.Estado.PAUSADA)
        Campania.objects.create(estado=Campania.Estado.CERRADA)

    def test_las_reglas_se_editan_en_borrador(self):
        c = Campania.objects.create(bs_por_punto=200)
        c.bs_por_punto = Decimal("250")
        c.fecha_sorteo = date(2026, 12, 20)
        c.save()
        c.refresh_from_db()
        self.assertEqual(c.bs_por_punto, Decimal("250.00"))

    def test_las_reglas_quedan_fijas_al_lanzar(self):
        c = Campania.objects.create(bs_por_punto=200, fecha_sorteo=date(2026, 12, 20))
        c.estado = Campania.Estado.ACTIVA
        c.save()  # cambiar el estado sí se puede

        c.bs_por_punto = Decimal("100")
        with self.assertRaises(ValidationError):
            c.save()
        with self.assertRaises(ValidationError):
            c.full_clean()  # el admin de Django valida con clean()
        c.refresh_from_db()
        c.fecha_sorteo = date(2027, 1, 1)
        with self.assertRaises(ValidationError):
            c.save()
        c.refresh_from_db()
        self.assertEqual(c.bs_por_punto, Decimal("200.00"))

    def test_pausada_y_cerrada_tambien_quedan_fijas(self):
        for estado in (Campania.Estado.PAUSADA, Campania.Estado.CERRADA):
            c = Campania.objects.create(estado=estado)
            c.bs_por_punto = Decimal("1")
            with self.assertRaises(ValidationError):
                c.save()

    def test_bs_por_punto_debe_ser_positivo(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            Campania.objects.create(bs_por_punto=0)


class ComandoCampaniaTests(TestCase):
    def correr(self, *args):
        salida = StringIO()
        call_command("crear_campania_sorteo", *args, stdout=salida)
        return salida.getvalue()

    def test_crea_borrador(self):
        self.correr("--fecha-sorteo", "2026-12-20")
        c = Campania.objects.get()
        self.assertEqual((c.estado, c.bs_por_punto, c.fecha_sorteo), ("BORRADOR", Decimal("200.00"), date(2026, 12, 20)))

    def test_lanzar_deja_activa(self):
        self.correr("--lanzar")
        c = Campania.objects.get()
        self.assertEqual(c.estado, Campania.Estado.ACTIVA)
        self.assertIsNotNone(c.lanzada_en)

    def test_no_lanza_si_ya_hay_una_activa(self):
        self.correr("--lanzar")
        with self.assertRaises(CommandError):
            self.correr("--lanzar")
        self.assertEqual(Campania.objects.count(), 1)

    def test_valida_los_argumentos(self):
        for args in (["--fecha-sorteo", "20/12/2026"], ["--bs-por-punto", "abc"], ["--bs-por-punto", "0"]):
            with self.subTest(args=args), self.assertRaises(CommandError):
                self.correr(*args)
        self.assertEqual(Campania.objects.count(), 0)
