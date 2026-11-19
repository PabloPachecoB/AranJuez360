from decimal import Decimal

from django.test import SimpleTestCase

from sorteo.services import calcular_progreso


class ProgresoTests(SimpleTestCase):
    def prog(self, total, bs=200):
        return calcular_progreso(Decimal(str(total)), bs)

    def test_sin_compras(self):
        self.assertEqual(self.prog(0), {
            "total_aprobado": "0.00", "puntos": 0, "participaciones": 0,
            "sobrante": "0.00", "faltan": "200.00", "pendientes": 0,
        })

    def test_380_es_un_punto_y_sobran_180(self):
        p = self.prog(380)
        self.assertEqual((p["puntos"], p["participaciones"], p["sobrante"], p["faltan"]), (1, 1, "180.00", "20.00"))

    def test_150_mas_80_es_un_punto_y_sobran_30(self):
        p = self.prog(Decimal("150") + Decimal("80"))
        self.assertEqual((p["puntos"], p["participaciones"], p["sobrante"], p["faltan"]), (1, 1, "30.00", "170.00"))

    def test_devolver_la_compra_de_80_deja_150_y_sin_participacion(self):
        p = self.prog(150)
        self.assertEqual((p["puntos"], p["participaciones"], p["sobrante"]), (0, 0, "150.00"))

    def test_multiplo_exacto(self):
        p = self.prog(400)
        self.assertEqual((p["puntos"], p["sobrante"], p["faltan"]), (2, "0.00", "200.00"))

    def test_decimales_sin_errores_de_punto_flotante(self):
        p = calcular_progreso(Decimal("199.99"), 200)
        self.assertEqual((p["puntos"], p["sobrante"], p["faltan"]), (0, "199.99", "0.01"))
        p = calcular_progreso(Decimal("0.10") + Decimal("0.20"), 200)
        self.assertEqual(p["total_aprobado"], "0.30")

    def test_total_negativo_se_trata_como_cero(self):
        self.assertEqual(self.prog(-50)["puntos"], 0)

    def test_otro_valor_por_punto(self):
        p = calcular_progreso(Decimal("1000"), Decimal("250"))
        self.assertEqual((p["puntos"], p["faltan"]), (4, "250.00"))

    def test_bs_por_punto_invalido(self):
        for malo in (0, -1):
            with self.assertRaises(ValueError):
                calcular_progreso(100, malo)
