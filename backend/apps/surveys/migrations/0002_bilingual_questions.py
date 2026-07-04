"""Bilingual (uz/ru) question text/titles + expanded question types + per-question settings.

Data-safe: existing plain-text `text`/`title`/`options[].text` values are moved into the
`ru` slot of the new {"uz", "ru"} shape via ORM (not a raw SQL cast), so it works
identically on Postgres and SQLite and never risks an invalid-JSON cast error.
"""
from django.db import migrations, models

import apps.surveys.i18n


class RemoveFieldRestoreNullable(migrations.RemoveField):
    """Like RemoveField, but reversing re-adds the column as nullable.

    The original `title`/`text` columns are NOT NULL with no default, so the
    stock RemoveField.database_backwards (which re-adds the field exactly as
    it was) fails on Postgres for a non-empty table: you cannot add a NOT
    NULL column without a default when rows already exist. Adding it back
    nullable lets `backfill_backward` (run right after, via RunPython) fill
    in real values before the migration finishes rolling back to 0001.
    """

    def database_backwards(self, app_label, schema_editor, from_state, to_state):
        from_model = from_state.apps.get_model(app_label, self.model_name)
        if self.allow_migrate_model(schema_editor.connection.alias, from_model):
            to_model = to_state.apps.get_model(app_label, self.model_name)
            field = to_model._meta.get_field(self.name).clone()
            field.null = True
            field.default = None
            field.set_attributes_from_name(self.name)
            schema_editor.add_field(from_model, field)


def _to_i18n(old_value):
    return {"uz": "", "ru": old_value or ""}


def _display(value):
    if isinstance(value, dict):
        return value.get("ru") or value.get("uz") or ""
    return value or ""


def backfill_forward(apps, schema_editor):
    QuestionBlock = apps.get_model("surveys", "QuestionBlock")
    Question = apps.get_model("surveys", "Question")

    for block in QuestionBlock.objects.all():
        block.title_i18n = _to_i18n(block.title)
        block.save(update_fields=["title_i18n"])

    for question in Question.objects.all():
        question.text_i18n = _to_i18n(question.text)
        new_options = []
        for opt in question.options or []:
            if isinstance(opt, dict):
                new_options.append({"id": opt.get("id"), "text": _to_i18n(opt.get("text"))})
        question.options = new_options
        question.save(update_fields=["text_i18n", "options"])


def backfill_backward(apps, schema_editor):
    QuestionBlock = apps.get_model("surveys", "QuestionBlock")
    Question = apps.get_model("surveys", "Question")

    for block in QuestionBlock.objects.all():
        block.title = _display(block.title_i18n)
        block.save(update_fields=["title"])

    for question in Question.objects.all():
        question.text = _display(question.text_i18n)
        new_options = []
        for opt in question.options or []:
            if isinstance(opt, dict):
                new_options.append({"id": opt.get("id"), "text": _display(opt.get("text"))})
        question.options = new_options
        question.save(update_fields=["text", "options"])


class Migration(migrations.Migration):

    dependencies = [
        ("surveys", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="questionblock",
            name="title_i18n",
            field=models.JSONField(blank=True, default=apps.surveys.i18n.empty_i18n),
        ),
        migrations.AddField(
            model_name="question",
            name="text_i18n",
            field=models.JSONField(default=apps.surveys.i18n.empty_i18n),
        ),
        migrations.AddField(
            model_name="question",
            name="is_required",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="question",
            name="is_mind_dive",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="question",
            name="settings",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AlterField(
            model_name="question",
            name="type",
            field=models.CharField(
                choices=[
                    ("single", "Один вариант (radio)"),
                    ("multiple", "Несколько вариантов (checkbox)"),
                    ("short_text", "Короткий текст"),
                    ("textarea", "Длинный текст / открытый вопрос (MIND DIVE)"),
                    ("nps", "NPS-шкала (0-10)"),
                    ("scale5", "Шкала оценки (1-5)"),
                    ("form_field", "Поле формы (текст/дата)"),
                    ("signature_date", "Подпись + дата"),
                    ("section_header", "Заголовок раздела"),
                    ("dropdown", "Выпадающий список"),
                    ("date", "Дата"),
                    ("number", "Число"),
                    ("matrix", "Матрица/сетка"),
                    ("ranking", "Ранжирование"),
                    ("file_upload", "Загрузка файла"),
                ],
                default="single",
                max_length=20,
            ),
        ),
        migrations.RunPython(backfill_forward, backfill_backward),
        RemoveFieldRestoreNullable(model_name="questionblock", name="title"),
        RemoveFieldRestoreNullable(model_name="question", name="text"),
        migrations.RenameField(model_name="questionblock", old_name="title_i18n", new_name="title"),
        migrations.RenameField(model_name="question", old_name="text_i18n", new_name="text"),
        migrations.AlterField(
            model_name="questionblock",
            name="title",
            field=models.JSONField(blank=True, default=apps.surveys.i18n.empty_i18n),
        ),
        migrations.AlterField(
            model_name="question",
            name="text",
            field=models.JSONField(default=apps.surveys.i18n.empty_i18n),
        ),
    ]
