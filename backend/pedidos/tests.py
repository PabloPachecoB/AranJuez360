from decimal import Decimal

from rest_framework.test import APITestCase

from empresas.models import Categoria, Empresa, Producto
from usuarios.models import Usuario

from . import services
from .models import Pedido, PedidoItem


def _comida():
    return Categoria.objects.get_or_create(nombre="Comida")[0]


class CrearPedidoTests(APITestCase):
    def setUp(self):
        self.empresa = Empresa.objects.create(nombre="Café Aranjuez", email_contacto="cafe@x.com", categoria=_comida())
        self.otra_empresa = Empresa.objects.create(nombre="Tienda Y", email_contacto="y@y.com", categoria=_comida())
        self.capuchino = Producto.objects.create(
            empresa=self.empresa, nombre="Capuchino", precio=Decimal("22.00"), stock=10
        )
        self.chocolate = Producto.objects.create(
            empresa=self.empresa, nombre="Chocolate caliente", precio=Decimal("25.00"), stock=10
        )
        self.ajeno = Producto.objects.create(
            empresa=self.otra_empresa, nombre="Ajeno", precio=Decimal("5.00"), stock=10
        )
        self.cliente = Usuario.objects.create_user("cli", password="x", rol=Usuario.Rol.CLIENTE)
        self.negocio = Usuario.objects.create_user(
            "neg", password="x", rol=Usuario.Rol.NEGOCIO, empresa=self.empresa
        )

    def _crear(self, items, empresa=None):
        self.client.force_authenticate(self.cliente)
        return self.client.post(
            "/api/v1/pedidos/",
            {"empresa": (empresa or self.empresa).pk, "items": items},
            format="json",
        )

    def test_crea_pedido_con_total_correcto(self):
        resp = self._crear(
            [
                {"producto_id": self.capuchino.pk, "cantidad": 2},
                {"producto_id": self.chocolate.pk, "cantidad": 1},
            ]
        )
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data["total"], "69.00")  # 2*22 + 1*25
        self.assertEqual(resp.data["estado"], "PENDIENTE_PAGO")  # primero se paga con el QR
        self.assertTrue(resp.data["codigo_retiro"])
        self.assertEqual(len(resp.data["items"]), 2)

    def test_items_copian_precio_al_momento_del_pedido(self):
        sid = self._crear([{"producto_id": self.capuchino.pk, "cantidad": 1}]).data["id"]
        self.capuchino.precio = Decimal("99.00")
        self.capuchino.save()
        item = PedidoItem.objects.get(pedido_id=sid)
        self.assertEqual(item.precio_unitario, Decimal("22.00"))  # no el nuevo precio

    def test_no_se_puede_pedir_vacio(self):
        self.assertEqual(self._crear([]).status_code, 400)

    def test_no_se_puede_mezclar_negocios(self):
        resp = self._crear(
            [
                {"producto_id": self.capuchino.pk, "cantidad": 1},
                {"producto_id": self.ajeno.pk, "cantidad": 1},
            ]
        )
        self.assertEqual(resp.status_code, 400)

    def test_producto_inactivo_no_se_puede_pedir(self):
        self.capuchino.activo = False
        self.capuchino.save()
        self.assertEqual(self._crear([{"producto_id": self.capuchino.pk, "cantidad": 1}]).status_code, 400)

    def test_empresa_inactiva_no_recibe_pedidos(self):
        self.empresa.activo = False
        self.empresa.save()
        self.assertEqual(self._crear([{"producto_id": self.capuchino.pk, "cantidad": 1}]).status_code, 400)

    def test_cantidad_cero_o_negativa_falla(self):
        resp = self._crear([{"producto_id": self.capuchino.pk, "cantidad": 0}])
        self.assertEqual(resp.status_code, 400)

    def test_solo_cliente_puede_crear_pedido(self):
        self.client.force_authenticate(self.negocio)
        resp = self.client.post(
            "/api/v1/pedidos/",
            {"empresa": self.empresa.pk, "items": [{"producto_id": self.capuchino.pk, "cantidad": 1}]},
            format="json",
        )
        self.assertEqual(resp.status_code, 403)

    def test_cliente_solo_ve_sus_propios_pedidos(self):
        self._crear([{"producto_id": self.capuchino.pk, "cantidad": 1}])
        otro_cliente = Usuario.objects.create_user("cli2", password="x", rol=Usuario.Rol.CLIENTE)
        self.client.force_authenticate(otro_cliente)
        self.assertEqual(self.client.get("/api/v1/pedidos/").data["count"], 0)


class PanelNegocioPedidosTests(APITestCase):
    def setUp(self):
        self.empresa = Empresa.objects.create(nombre="Café Aranjuez", email_contacto="cafe@x.com", categoria=_comida())
        self.otra_empresa = Empresa.objects.create(nombre="Tienda Y", email_contacto="y@y.com", categoria=_comida())
        self.producto = Producto.objects.create(empresa=self.empresa, nombre="Capuchino", precio=Decimal("22.00"))
        self.cliente = Usuario.objects.create_user("cli", password="x", rol=Usuario.Rol.CLIENTE)
        self.negocio = Usuario.objects.create_user(
            "neg", password="x", rol=Usuario.Rol.NEGOCIO, empresa=self.empresa
        )
        self.negocio_otro = Usuario.objects.create_user(
            "neg2", password="x", rol=Usuario.Rol.NEGOCIO, empresa=self.otra_empresa
        )
        self.client.force_authenticate(self.cliente)
        self.pedido_id = self.client.post(
            "/api/v1/pedidos/",
            {"empresa": self.empresa.pk, "items": [{"producto_id": self.producto.pk, "cantidad": 1}]},
            format="json",
        ).data["id"]
        services.confirmar_pago(Pedido.objects.get(pk=self.pedido_id).pago_referencia)
        self.pedido = Pedido.objects.get(pk=self.pedido_id)

    def test_negocio_ve_sus_pedidos_entrantes(self):
        self.client.force_authenticate(self.negocio)
        resp = self.client.get("/api/v1/mi-empresa/pedidos/")
        self.assertEqual(resp.data["count"], 1)

    def test_negocio_no_ve_pedidos_de_otra_empresa(self):
        self.client.force_authenticate(self.negocio_otro)
        self.assertEqual(self.client.get("/api/v1/mi-empresa/pedidos/").data["count"], 0)

    def test_negocio_otro_no_puede_avanzar_pedido_ajeno(self):
        self.client.force_authenticate(self.negocio_otro)
        resp = self.client.post(f"/api/v1/mi-empresa/pedidos/{self.pedido_id}/avanzar/")
        self.assertEqual(resp.status_code, 404)

    def test_flujo_completo_de_estados(self):
        self.client.force_authenticate(self.negocio)
        for siguiente in ("CONFIRMADO", "PREPARANDO", "LISTO_PARA_RECOGER"):
            resp = self.client.post(f"/api/v1/mi-empresa/pedidos/{self.pedido_id}/avanzar/")
            self.assertEqual(resp.status_code, 200, resp.data)
            self.assertEqual(resp.data["estado"], siguiente)

    def test_no_se_puede_avanzar_mas_alla_de_listo_para_recoger(self):
        self.client.force_authenticate(self.negocio)
        for _ in range(3):
            self.client.post(f"/api/v1/mi-empresa/pedidos/{self.pedido_id}/avanzar/")
        resp = self.client.post(f"/api/v1/mi-empresa/pedidos/{self.pedido_id}/avanzar/")
        self.assertEqual(resp.status_code, 400)

    def test_cancelar_pedido_recibido(self):
        self.client.force_authenticate(self.negocio)
        resp = self.client.post(f"/api/v1/mi-empresa/pedidos/{self.pedido_id}/cancelar/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["estado"], "CANCELADO")

    def test_no_se_puede_cancelar_pedido_entregado(self):
        self.client.force_authenticate(self.negocio)
        for _ in range(3):
            self.client.post(f"/api/v1/mi-empresa/pedidos/{self.pedido_id}/avanzar/")
        self.client.post(
            "/api/v1/mi-empresa/pedidos/validar-retiro/",
            {"codigo_retiro": self.pedido.codigo_retiro},
            format="json",
        )
        resp = self.client.post(f"/api/v1/mi-empresa/pedidos/{self.pedido_id}/cancelar/")
        self.assertEqual(resp.status_code, 400)


class ValidarRetiroTests(APITestCase):
    def setUp(self):
        self.empresa = Empresa.objects.create(nombre="Café Aranjuez", email_contacto="cafe@x.com", categoria=_comida())
        self.otra_empresa = Empresa.objects.create(nombre="Tienda Y", email_contacto="y@y.com", categoria=_comida())
        self.producto = Producto.objects.create(empresa=self.empresa, nombre="Capuchino", precio=Decimal("22.00"))
        self.cliente = Usuario.objects.create_user("cli", password="x", rol=Usuario.Rol.CLIENTE)
        self.negocio = Usuario.objects.create_user(
            "neg", password="x", rol=Usuario.Rol.NEGOCIO, empresa=self.empresa
        )
        self.negocio_otro = Usuario.objects.create_user(
            "neg2", password="x", rol=Usuario.Rol.NEGOCIO, empresa=self.otra_empresa
        )
        self.client.force_authenticate(self.cliente)
        self.pedido_id = self.client.post(
            "/api/v1/pedidos/",
            {"empresa": self.empresa.pk, "items": [{"producto_id": self.producto.pk, "cantidad": 1}]},
            format="json",
        ).data["id"]
        services.confirmar_pago(Pedido.objects.get(pk=self.pedido_id).pago_referencia)
        self.pedido = Pedido.objects.get(pk=self.pedido_id)

    def _avanzar_hasta_listo(self):
        self.client.force_authenticate(self.negocio)
        for _ in range(3):
            self.client.post(f"/api/v1/mi-empresa/pedidos/{self.pedido_id}/avanzar/")

    def _validar(self, codigo, como=None):
        self.client.force_authenticate(como or self.negocio)
        return self.client.post(
            "/api/v1/mi-empresa/pedidos/validar-retiro/", {"codigo_retiro": codigo}, format="json"
        )

    def test_codigo_incorrecto_rechazado(self):
        self._avanzar_hasta_listo()
        self.assertEqual(self._validar("NOEXISTE").status_code, 400)

    def test_no_se_puede_validar_antes_de_listo_para_recoger(self):
        # El pedido sigue en RECIBIDO, todavía no está listo.
        resp = self._validar(self.pedido.codigo_retiro)
        self.assertEqual(resp.status_code, 400)

    def test_codigo_correcto_marca_entregado(self):
        self._avanzar_hasta_listo()
        resp = self._validar(self.pedido.codigo_retiro)
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data["estado"], "ENTREGADO")
        self.assertIsNotNone(resp.data["entregado_en"])

    def test_no_se_puede_entregar_dos_veces(self):
        self._avanzar_hasta_listo()
        self._validar(self.pedido.codigo_retiro)
        resp = self._validar(self.pedido.codigo_retiro)
        self.assertEqual(resp.status_code, 400)

    def test_codigo_es_insensible_a_mayusculas(self):
        self._avanzar_hasta_listo()
        resp = self._validar(self.pedido.codigo_retiro.lower())
        self.assertEqual(resp.status_code, 200)

    def test_otro_negocio_no_puede_validar_codigo_ajeno(self):
        self._avanzar_hasta_listo()
        resp = self._validar(self.pedido.codigo_retiro, como=self.negocio_otro)
        self.assertEqual(resp.status_code, 400)
        self.pedido.refresh_from_db()
        self.assertEqual(self.pedido.estado, Pedido.Estado.LISTO_PARA_RECOGER)



class PagoQRYRetiroTests(APITestCase):
    """Pago con QR (banco simulado), llegada del cliente y restricción a negocios de comida."""

    def setUp(self):
        self.empresa = Empresa.objects.create(nombre="Waffle King", email_contacto="w@x.com", categoria=_comida())
        self.producto = Producto.objects.create(empresa=self.empresa, nombre="Waffle", precio=Decimal("32.00"))
        self.cliente = Usuario.objects.create_user("cli", password="x", rol=Usuario.Rol.CLIENTE)
        self.negocio = Usuario.objects.create_user("neg", password="x", rol=Usuario.Rol.NEGOCIO, empresa=self.empresa)
        self.client.force_authenticate(self.cliente)
        self.pedido = self.client.post("/api/v1/pedidos/", {
            "empresa": self.empresa.pk, "items": [{"producto_id": self.producto.pk, "cantidad": 2}]}, format="json").data

    def test_qr_de_cobro_y_banco_simulado(self):
        self.assertTrue(self.pedido["pago_qr"].endswith(f"/pago-simulado/{self.pedido['pago_referencia']}/"))
        url = f"/pago-simulado/{self.pedido['pago_referencia']}/"
        self.client.logout()
        self.assertContains(self.client.get(url), "Bs 64")
        self.assertContains(self.client.post(url), "Pago realizado")
        self.assertEqual(Pedido.objects.get(pk=self.pedido["id"]).estado, "RECIBIDO")

    def test_negocio_no_avanza_sin_pago(self):
        self.client.force_authenticate(self.negocio)
        self.assertEqual(self.client.post(f"/api/v1/mi-empresa/pedidos/{self.pedido['id']}/avanzar/").status_code, 400)

    def test_flujo_pago_preparacion_llegada_y_entrega(self):
        pagado = self.client.post(f"/api/v1/pedidos/{self.pedido['id']}/simular-pago/").data
        self.assertEqual(pagado["estado"], "RECIBIDO")
        self.assertIsNotNone(pagado["pagado_en"])
        # Avisar llegada antes de que esté listo no se puede.
        self.assertEqual(self.client.post(f"/api/v1/pedidos/{self.pedido['id']}/llegue/").status_code, 400)
        self.client.force_authenticate(self.negocio)
        for _ in range(3):
            self.client.post(f"/api/v1/mi-empresa/pedidos/{self.pedido['id']}/avanzar/")
        self.client.force_authenticate(self.cliente)
        self.assertEqual(self.client.post(f"/api/v1/pedidos/{self.pedido['id']}/llegue/").data["estado"], "CLIENTE_LLEGO")
        self.client.force_authenticate(self.negocio)
        resp = self.client.post("/api/v1/mi-empresa/pedidos/validar-retiro/",
                                {"codigo_retiro": pagado["codigo_retiro"]}, format="json")
        self.assertEqual(resp.data["estado"], "ENTREGADO")

    def test_qr_vencido_cancela_el_pedido(self):
        from datetime import timedelta
        from django.utils import timezone

        Pedido.objects.filter(pk=self.pedido["id"]).update(pago_vence_en=timezone.now() - timedelta(minutes=1))
        self.assertEqual(self.client.post(f"/api/v1/pedidos/{self.pedido['id']}/simular-pago/").status_code, 400)
        self.assertEqual(self.client.get(f"/api/v1/pedidos/{self.pedido['id']}/").data["estado"], "CANCELADO")

    def test_cancelar_pagado_marca_reembolso(self):
        self.client.post(f"/api/v1/pedidos/{self.pedido['id']}/simular-pago/")
        self.assertEqual(self.client.post(f"/api/v1/pedidos/{self.pedido['id']}/cancelar/").status_code, 400)
        self.client.force_authenticate(self.negocio)
        resp = self.client.post(f"/api/v1/mi-empresa/pedidos/{self.pedido['id']}/cancelar/")
        self.assertEqual(resp.data["estado"], "CANCELADO")
        self.assertIsNotNone(resp.data["reembolsado_en"])

    def test_solo_negocios_de_comida(self):
        tienda = Empresa.objects.create(nombre="TecnoPlus", email_contacto="t@x.com")
        audifonos = Producto.objects.create(empresa=tienda, nombre="Audífonos", precio=Decimal("250"))
        resp = self.client.post("/api/v1/pedidos/", {"empresa": tienda.pk, "items": [
            {"producto_id": audifonos.pk, "cantidad": 1}]}, format="json")
        self.assertEqual(resp.status_code, 400)


class ReservaDeRetiroTests(APITestCase):
    """Comprar ahora y reservar la hora de retiro."""

    def setUp(self):
        self.empresa = Empresa.objects.create(nombre="Waffle King", email_contacto="w@x.com", categoria=_comida())
        self.producto = Producto.objects.create(empresa=self.empresa, nombre="Waffle", precio=Decimal("32.00"))
        self.cliente = Usuario.objects.create_user("cli", password="x", rol=Usuario.Rol.CLIENTE)
        self.client.force_authenticate(self.cliente)

    def _pedir(self, retiro):
        return self.client.post("/api/v1/pedidos/", {
            "empresa": self.empresa.pk, "items": [{"producto_id": self.producto.pk, "cantidad": 1}],
            "retiro_programado": retiro}, format="json")

    def test_reserva_valida(self):
        from datetime import timedelta
        from django.utils import timezone

        hora = (timezone.now() + timedelta(hours=2)).replace(microsecond=0)
        resp = self._pedir(hora.isoformat())
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertIsNotNone(resp.data["retiro_programado"])

    def test_reserva_muy_pronto_o_muy_lejos(self):
        from datetime import timedelta
        from django.utils import timezone

        self.assertEqual(self._pedir((timezone.now() + timedelta(minutes=5)).isoformat()).status_code, 400)
        self.assertEqual(self._pedir((timezone.now() + timedelta(days=5)).isoformat()).status_code, 400)

    def test_lo_antes_posible(self):
        resp = self._pedir(None)
        self.assertEqual(resp.status_code, 201)
        self.assertIsNone(resp.data["retiro_programado"])


class AdminSupervisaPedidosTests(APITestCase):
    def setUp(self):
        self.empresa = Empresa.objects.create(nombre="Waffle King", email_contacto="w@x.com", categoria=_comida())
        self.producto = Producto.objects.create(empresa=self.empresa, nombre="Waffle", precio=Decimal("32.00"))
        self.cliente = Usuario.objects.create_user("cli", email="c@x.bo", password="x", rol=Usuario.Rol.CLIENTE)
        self.admin = Usuario.objects.create_user("adm", password="x", rol=Usuario.Rol.ADMIN)
        self.client.force_authenticate(self.cliente)
        self.client.post("/api/v1/pedidos/", {"empresa": self.empresa.pk, "items": [
            {"producto_id": self.producto.pk, "cantidad": 2}]}, format="json")

    def test_solo_el_admin_ve_todos_los_pedidos(self):
        self.assertEqual(self.client.get("/api/v1/admin/pedidos/").status_code, 403)
        self.client.force_authenticate(self.admin)
        data = self.client.get("/api/v1/admin/pedidos/").data["results"]
        self.assertEqual((len(data), data[0]["empresa_nombre"], data[0]["cliente_email"]), (1, "Waffle King", "c@x.bo"))

    def test_filtros_y_resumen(self):
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.get("/api/v1/admin/pedidos/?estado=ENTREGADO").data["count"], 0)
        self.assertEqual(self.client.get("/api/v1/admin/pedidos/?buscar=waffle").data["count"], 1)
        resumen = self.client.get("/api/v1/admin/pedidos/resumen/").data
        self.assertEqual((resumen["por_estado"]["PENDIENTE_PAGO"], resumen["pedidos"]), (1, 1))


class TotalEsperadoTests(CrearPedidoTests):
    """El QR nunca cobra un monto distinto al que el cliente vio en su carrito."""

    def _crear_con_total(self, total):
        self.client.force_authenticate(self.cliente)
        return self.client.post(
            "/api/v1/pedidos/",
            {"empresa": self.empresa.pk, "items": [{"producto_id": self.capuchino.pk, "cantidad": 2}],
             "total_esperado": total},
            format="json",
        )

    def test_total_igual_crea_el_pedido(self):
        resp = self._crear_con_total("44.00")
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data["total"], "44.00")

    def test_si_el_negocio_cambio_el_precio_no_crea_el_pedido(self):
        from pedidos.models import Pedido

        Producto.objects.filter(pk=self.capuchino.pk).update(precio=Decimal("25.00"))
        resp = self._crear_con_total("44.00")  # el carrito tenía el precio viejo
        self.assertEqual(resp.status_code, 400)
        self.assertIn("precio cambió", str(resp.data))
        self.assertIn("50.00", str(resp.data))
        self.assertFalse(Pedido.objects.exists())
