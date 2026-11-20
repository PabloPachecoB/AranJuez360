from io import StringIO

from django.core.management import call_command
from rest_framework.test import APITestCase

from agente.contexto import construir_contexto, prompt_sistema
from usuarios.models import Usuario
from .management.commands.importar_tiendas_paseo import categoria_de
from .models import Categoria, Empresa


class RubrosTests(APITestCase):
    def test_organizacion_repetible_conserva_tipos_y_cuentas(self):
        tecnologia = Categoria.objects.create(nombre="Tecnología")
        tigo = Empresa.objects.create(nombre="Tigo", categoria=tecnologia)
        oficina = Empresa.objects.create(nombre="Oficina", tipo="OFICINA", categoria=tecnologia)
        emprendimiento = Empresa.objects.create(nombre="Taller", tipo="EMPRENDIMIENTO",
                                               categoria=Categoria.objects.create(nombre="Moda"))
        usuario = Usuario.objects.create(username="demo", empresa=tigo, rol="NEGOCIO")
        call_command("organizar_rubros", stdout=StringIO())
        call_command("organizar_rubros", stdout=StringIO())
        tigo.refresh_from_db()
        oficina.refresh_from_db()
        emprendimiento.refresh_from_db()
        usuario.refresh_from_db()
        self.assertEqual(tigo.categoria.nombre, "Servicios")
        self.assertEqual(oficina.categoria, tecnologia)
        self.assertEqual(emprendimiento.tipo, "EMPRENDIMIENTO")
        self.assertEqual(emprendimiento.categoria.nombre, "Ropa")
        self.assertEqual(usuario.empresa_id, tigo.pk)
        self.assertEqual(categoria_de({"title": "Tigo", "categories": ["telecomunicaciones"]}), "Servicios")

    def test_busqueda_sin_tildes_y_alias(self):
        Empresa.objects.create(nombre="APPLE LAND", categoria=Categoria.objects.create(nombre="Electrónica"))
        for filtro in ("rubro=electronica", "rubro=tecnologia", "buscar=electrónica"):
            respuesta = self.client.get("/api/v1/empresas/?" + filtro)
            self.assertEqual([e["nombre"] for e in respuesta.data["results"]], ["APPLE LAND"])
        self.assertEqual(self.client.get("/api/v1/empresas/?excluir_rubro=electronica").data["count"], 0)

    def test_jarvis_incluye_mas_de_cuarenta_y_separa_tipos(self):
        user = Usuario.objects.create(username="cliente")
        comida = Categoria.objects.create(nombre="Comida")
        Empresa.objects.bulk_create([Empresa(nombre=f"Negocio {i}", categoria=comida) for i in range(70)])
        Empresa.objects.create(nombre="Oficina legal", tipo="OFICINA")
        Empresa.objects.create(nombre="Emprendedor", tipo="EMPRENDIMIENTO", categoria=comida)
        Empresa.objects.create(nombre="Inactivo", activo=False)
        contexto = construir_contexto(user)
        self.assertEqual(len(contexto["directorio"]["Negocio"]["Comida"]), 70)
        texto = prompt_sistema(contexto)
        for nombre in ("Oficina legal", "Emprendedor", "Negocio 69", "Oficina > Otros"):
            self.assertIn(nombre, texto)
        self.assertNotIn("Inactivo", texto)
