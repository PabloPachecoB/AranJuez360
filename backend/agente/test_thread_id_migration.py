from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase

from usuarios.models import Usuario


class ThreadIdMigrationTests(TransactionTestCase):
    """Comprueba que 0004 rellena UUID distintos para filas ya existentes."""

    migrate_from = [("agente", "0003_conversacionjarvis_mensajejarvis")]
    migrate_to = [("agente", "0004_conversacionjarvis_thread_id")]

    def setUp(self):
        self.executor = MigrationExecutor(connection)
        self.executor.migrate(self.migrate_from)
        apps_0003 = self.executor.loader.project_state(self.migrate_from).apps
        ConversacionJarvis = apps_0003.get_model("agente", "ConversacionJarvis")

        # ``usuarios`` no se retrocede en esta prueba; se crea con el modelo
        # actual para respetar sus columnas obligatorias, y se usa solo su ID
        # en el modelo histórico de ``agente``.
        usuario = Usuario.objects.create(
            username="usuario-migracion",
            email_verificado=False,
        )
        self.primera_id = ConversacionJarvis.objects.create(usuario_id=usuario.pk).pk
        self.segunda_id = ConversacionJarvis.objects.create(usuario_id=usuario.pk).pk

        self.executor = MigrationExecutor(connection)
        self.executor.migrate(self.migrate_to)
        self.apps_0004 = self.executor.loader.project_state(self.migrate_to).apps

    def tearDown(self):
        # Restaura el esquema final para que no afecte otras pruebas.
        executor = MigrationExecutor(connection)
        executor.migrate(executor.loader.graph.leaf_nodes())
        super().tearDown()

    def test_asigna_un_thread_distinto_a_cada_conversacion_existente(self):
        ConversacionJarvis = self.apps_0004.get_model("agente", "ConversacionJarvis")
        primera = ConversacionJarvis.objects.get(pk=self.primera_id)
        segunda = ConversacionJarvis.objects.get(pk=self.segunda_id)

        self.assertIsNotNone(primera.thread_id)
        self.assertIsNotNone(segunda.thread_id)
        self.assertNotEqual(primera.thread_id, segunda.thread_id)
