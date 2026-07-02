from django.apps import AppConfig


class AssessmentsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.assessments"

    def ready(self):
        from . import signals  # noqa: F401  (registers post_save receiver)
