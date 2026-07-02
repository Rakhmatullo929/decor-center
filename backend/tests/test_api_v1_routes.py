import pytest

pytestmark = pytest.mark.django_db


def test_dropped_routes_are_gone(admin_client):
    for path in ("/api/v1/questions/", "/api/v1/test-sessions/",
                 "/api/v1/instructions/", "/api/v1/medical-checks/"):
        assert admin_client.get(path).status_code == 404


def test_kept_routes_resolve(admin_client):
    assert admin_client.get("/api/v1/employees/").status_code == 200
    assert admin_client.get("/api/v1/specialties/").status_code == 200


def test_dashboard_returns_totals(admin_client):
    resp = admin_client.get("/api/v1/dashboard/stats/")
    assert resp.status_code == 200
    assert "active_employees" in resp.data["totals"]
    assert "specialties" in resp.data["totals"]
