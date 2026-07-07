from rest_framework.test import APIRequestFactory

from apps.surveys.kiosk_token import issue_kiosk_token, read_kiosk_token
from apps.surveys.permissions import IsKioskVerified


def test_issue_then_read_roundtrip():
    token = issue_kiosk_token(42, fallback=True)
    data = read_kiosk_token(token)
    assert data == {"employee_id": 42, "fallback": True}


def test_tampered_token_is_rejected():
    assert read_kiosk_token("not-a-real-token") is None
    good = issue_kiosk_token(1)
    assert read_kiosk_token(good + "x") is None


def test_expired_token_is_rejected(settings):
    settings.DECOR = {**settings.DECOR, "KIOSK_TOKEN_TTL": -1}
    assert read_kiosk_token(issue_kiosk_token(1)) is None


def test_permission_grants_with_valid_header_denies_without():
    factory = APIRequestFactory()
    perm = IsKioskVerified()

    denied = factory.get("/x")
    assert perm.has_permission(denied, view=None) is False

    granted = factory.get("/x", HTTP_X_KIOSK_TOKEN=issue_kiosk_token(7, fallback=False))
    assert perm.has_permission(granted, view=None) is True
    assert granted.kiosk_employee_id == 7
    assert granted.kiosk_fallback is False
