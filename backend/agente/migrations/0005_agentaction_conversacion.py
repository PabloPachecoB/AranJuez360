import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("agente", "0004_conversacionjarvis_thread_id"),
    ]

    operations = [
        migrations.AddField(
            model_name="agentaction",
            name="conversacion",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="acciones_agente",
                to="agente.conversacionjarvis",
            ),
        ),
    ]
