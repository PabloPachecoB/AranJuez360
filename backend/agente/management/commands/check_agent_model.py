"""Verifica que la configuración del LLM sea válida y el modelo responda."""

from django.core.management.base import BaseCommand

from agente.config import LLMSettings


class Command(BaseCommand):
    help = "Valida LLMSettings desde el entorno."

    def handle(self, *args, **options):
        settings = LLMSettings.from_env()
        self.stdout.write(
            self.style.SUCCESS(
                f"LLM OK: provider={settings.provider} model={settings.model}"
            )
        )
