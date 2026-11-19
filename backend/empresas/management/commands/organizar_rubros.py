"""Normaliza rubros sin cambiar tipos, cuentas ni información de las fichas."""
from django.core.management.base import BaseCommand
from django.db import transaction
from empresas.models import Categoria, Empresa
from empresas.rubros import RUBROS, rubro_comercial


class Command(BaseCommand):
    help = "Organiza negocios y emprendimientos en los ocho rubros comerciales."

    @transaction.atomic
    def handle(self, *args, **options):
        categorias = {n: Categoria.objects.get_or_create(nombre=n)[0] for n in RUBROS}
        cambios = 0
        for empresa in Empresa.objects.exclude(tipo=Empresa.Tipo.OFICINA).select_related("categoria"):
            nombre = empresa.categoria.nombre if empresa.categoria else ""
            categoria = categorias[rubro_comercial(nombre, empresa.nombre)]
            if empresa.categoria_id != categoria.pk:
                empresa.categoria = categoria
                empresa.save(update_fields=["categoria"])
                cambios += 1
        self.stdout.write(self.style.SUCCESS(f"Rubros organizados: {cambios} fichas actualizadas."))
