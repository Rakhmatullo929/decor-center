import pytest
from rest_framework.throttling import SimpleRateThrottle

from .factories import EmployeeFactory


@pytest.mark.django_db
def test_request_otp_is_throttled(api_client, monkeypatch):
    # DRF binds SimpleRateThrottle.THROTTLE_RATES at import, so overriding the setting
    # has no effect — patch the class attribute directly for a deterministic tiny rate.
    monkeypatch.setattr(
        SimpleRateThrottle,
        "THROTTLE_RATES",
        {"kiosk_identify": "1/min", "kiosk_otp": "1/min", "kiosk_lookup": "1/min"},
    )

    emp = EmployeeFactory(phone="+998901234567")
    first = api_client.post(
        "/api/v1/survey-sessions/request-otp/", {"employee": emp.id}, format="json"
    )
    assert first.status_code == 200
    second = api_client.post(
        "/api/v1/survey-sessions/request-otp/", {"employee": emp.id}, format="json"
    )
    assert second.status_code == 429
