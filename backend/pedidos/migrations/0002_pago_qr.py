import secrets

from django.db import migrations, models

import pedidos.models


def referencias_unicas(apps, schema_editor):
    """Cada pedido que ya existía recibe su propia referencia de cobro (y queda como pagado)."""
    Pedido = apps.get_model("pedidos", "Pedido")
    for pedido in Pedido.objects.all():
        pedido.pago_referencia = f"PY{secrets.token_hex(5).upper()}"
        pedido.pagado_en = pedido.creado_en
        pedido.save(update_fields=["pago_referencia", "pagado_en"])


class Migration(migrations.Migration):
    dependencies = [("pedidos", "0001_initial")]

    operations = [
        migrations.AddField(
            model_name="pedido", name="pago_referencia", field=models.CharField(max_length=16, null=True, editable=False),
        ),
        migrations.AddField(model_name="pedido", name="pago_vence_en", field=models.DateTimeField(blank=True, null=True)),
        migrations.AddField(model_name="pedido", name="pagado_en", field=models.DateTimeField(blank=True, null=True)),
        migrations.AddField(
            model_name="pedido", name="reembolsado_en",
            field=models.DateTimeField(blank=True, null=True, help_text="Si el negocio cancela un pedido pagado."),
        ),
        migrations.AddField(
            model_name="pedido", name="llego_en",
            field=models.DateTimeField(blank=True, null=True, help_text="Cuando el cliente avisa que está en el Paseo."),
        ),
        migrations.RunPython(referencias_unicas, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="pedido", name="pago_referencia",
            field=models.CharField(default=pedidos.models._nueva_referencia_pago, editable=False, max_length=16, unique=True),
        ),
        migrations.AlterField(
            model_name="pedido", name="estado",
            field=models.CharField(
                choices=[
                    ("PENDIENTE_PAGO", "Esperando pago"), ("RECIBIDO", "Pagado · recibido"), ("CONFIRMADO", "Confirmado"),
                    ("PREPARANDO", "Preparando"), ("LISTO_PARA_RECOGER", "Listo para recoger"),
                    ("CLIENTE_LLEGO", "Cliente en el Paseo"), ("ENTREGADO", "Entregado"), ("CANCELADO", "Cancelado"),
                ],
                default="PENDIENTE_PAGO", max_length=20,
            ),
        ),
    ]
