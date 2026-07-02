import sys

from django.apps import AppConfig

_SKIP_COMMANDS = ("migrate", "makemigrations", "test", "collectstatic")


def maybe_warmup() -> bool:
    """Preload the face model if enabled and not running a management/test command.

    Returns True if warmup ran. Never raises — startup must not be blocked.
    """
    from django.conf import settings

    if not settings.DECOR.get("FACE_WARMUP_ON_STARTUP"):
        return False
    if any(cmd in sys.argv for cmd in _SKIP_COMMANDS):
        return False
    try:
        from .registry import get_face_recognition_service

        get_face_recognition_service().warmup()
        return True
    except Exception:
        return False


class IntegrationsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.integrations"

    def ready(self):
        maybe_warmup()
