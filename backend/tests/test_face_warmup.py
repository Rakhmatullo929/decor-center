import sys


def test_maybe_warmup_disabled_by_default():
    from apps.integrations.apps import maybe_warmup

    assert maybe_warmup() is False


def test_maybe_warmup_runs_when_enabled(settings, monkeypatch):
    from apps.integrations.apps import maybe_warmup

    settings.DECOR = {**settings.DECOR, "FACE_WARMUP_ON_STARTUP": True}
    monkeypatch.setattr(sys, "argv", ["gunicorn"])  # not a migrate/test invocation
    assert maybe_warmup() is True  # mock warmup() is a no-op → returns True


def test_maybe_warmup_skips_during_migrate(settings, monkeypatch):
    from apps.integrations.apps import maybe_warmup

    settings.DECOR = {**settings.DECOR, "FACE_WARMUP_ON_STARTUP": True}
    monkeypatch.setattr(sys, "argv", ["manage.py", "migrate"])
    assert maybe_warmup() is False
