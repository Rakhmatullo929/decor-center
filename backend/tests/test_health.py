import pytest
from django.test import Client


@pytest.mark.django_db
def test_health_returns_ok():
    resp = Client().get("/health/")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
