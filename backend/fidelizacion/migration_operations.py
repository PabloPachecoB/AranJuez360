from django.db import migrations
from django.db.migrations.exceptions import IrreversibleError


class CreateSharedRecompensa(migrations.CreateModel):
    """Unite independently published Recompensa migrations without dropping existing data."""
    def state_forwards(self, app_label, state):
        key = (app_label, self.name_lower)
        if key not in state.models:
            return super().state_forwards(app_label, state)
        for name, field in self.fields:
            if name not in state.models[key].fields:
                state.add_field(app_label, self.name_lower, name, field.clone(), True)

    def database_forwards(self, app_label, schema_editor, from_state, to_state):
        model = to_state.apps.get_model(app_label, self.name)
        tables = schema_editor.connection.introspection.table_names()
        if model._meta.db_table not in tables:
            return super().database_forwards(app_label, schema_editor, from_state, to_state)
        for field in model._meta.local_fields:
            with schema_editor.connection.cursor() as cursor:
                columns = {c.name for c in schema_editor.connection.introspection.get_table_description(cursor, model._meta.db_table)}
            if field.column in columns:
                continue
            # SQLite rebuilds a table for some additions. Exclude fields that have
            # not yet been created, so its INSERT cannot copy nonexistent columns.
            partial = to_state.clone()
            for other in model._meta.local_fields:
                if other.column not in columns and other.name != field.name:
                    partial.remove_field(app_label, self.name_lower, other.name)
            partial_model = partial.apps.get_model(app_label, self.name)
            schema_editor.add_field(partial_model, partial_model._meta.get_field(field.name))

    def database_backwards(self, *args, **kwargs):
        raise IrreversibleError("Shared rewards contain data from both branches; restore a backup to roll back.")
