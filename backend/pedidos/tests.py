from decimal import Decimal

from rest_framework.test import APITestCase

from empresas.models import Empresa, Producto
from usuarios.models import Usuario

from .models import Pedido, PedidoItem


class CrearPedidoTests(APITestCase):
    def setUp(self):
        self.empresa = Empresa.objects.create(nombre="Café Aranjuez", email_contacto="cafe@x.com")
        self.otra_empresa = Empresa.objects.create(nombre="Tienda Y", email_contacto="y@y.com")
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
        self.assertEqual(resp.data["estado"], "RECIBIDO")
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
        self.empresa = Empresa.objects.create(nombre="Café Aranjuez", email_contacto="cafe@x.com")
        self.otra_empresa = Empresa.objects.create(nombre="Tienda Y", email_contacto="y@y.com")
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
        self.empresa = Empresa.objects.create(nombre="Café Aranjuez", email_contacto="cafe@x.com")
        self.otra_empresa = Empresa.objects.create(nombre="Tienda Y", email_contacto="y@y.com")
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
