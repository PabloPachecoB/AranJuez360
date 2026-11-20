import uuid

from django.db import migrations, models


def asignar_thread_ids(apps, schema_editor):
    """Completa conversaciones existentes antes de exigir unicidad y NOT NULL."""
    ConversacionJarvis = apps.get_model("agente", "ConversacionJarvis")
    for conversacion in ConversacionJarvis.objects.filter(thread_id__isnull=True).iterator():
        conversacion.thread_id = uuid.uuid4()
        conversacion.save(update_fields=["thread_id"])


class Migration(migrations.Migration):

    dependencies = [
        ("agente", "0003_conversacionjarvis_mensajejarvis"),
    ]

    operations = [
        # NULL permite añadir la columna sin reutilizar un único default para
        # todas las filas existentes. Los UUID se asignan en la operación
        # posterior, uno por uno.
        migrations.AddField(
            model_name="conversacionjarvis",
            name="thread_id",
            field=models.UUIDField(editable=False, null=True),
        ),
        migrations.RunPython(asignar_thread_ids, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="conversacionjarvis",
            name="thread_id",
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True),
        ),
    ]
