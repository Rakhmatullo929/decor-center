import pytest

from apps.surveys.models import OtpChallenge

from .factories import EmployeeFactory


@pytest.mark.django_db
def test_identify_is_public_and_returns_masked_phone(api_client, face_image):
    emp = EmployeeFactory(phone="+998901234567")  # embedding matches face_image (mock)
    resp = api_client.post(
        "/api/v1/survey-sessions/identify/", {"face_image": face_image}, format="multipart"
    )
    assert resp.status_code == 200, resp.content
    body = resp.data["employee"]
    assert body["id"] == emp.id
    assert body["phone_masked"] == "+998 *** ** 67"
    assert "phone" not in body and "face_embedding" not in body


@pytest.mark.django_db
def test_request_otp_public(api_client):
    emp = EmployeeFactory(phone="+998901234567")
    resp = api_client.post(
        "/api/v1/survey-sessions/request-otp/", {"employee": emp.id}, format="json"
    )
    assert resp.status_code == 200
    assert resp.data["phone_masked"] == "+998 *** ** 67"
    assert OtpChallenge.objects.filter(employee=emp).count() == 1


@pytest.mark.django_db
def test_request_otp_phone_not_set(api_client):
    emp = EmployeeFactory(phone="")
    resp = api_client.post(
        "/api/v1/survey-sessions/request-otp/", {"employee": emp.id}, format="json"
    )
    assert resp.status_code == 400
    assert resp.data["code"] == "phone_not_set"


@pytest.mark.django_db
def test_verify_otp_wrong_then_right(api_client):
    emp = EmployeeFactory(phone="+998901234567")
    api_client.post("/api/v1/survey-sessions/request-otp/", {"employee": emp.id}, format="json")

    bad = api_client.post(
        "/api/v1/survey-sessions/verify-otp/",
        {"employee": emp.id, "code": "9999"}, format="json",
    )
    assert bad.status_code == 400
    assert bad.data["code"] == "invalid_code"

    ok = api_client.post(
        "/api/v1/survey-sessions/verify-otp/",
        {"employee": emp.id, "code": "0000"}, format="json",
    )
    assert ok.status_code == 200
    assert ok.data["kiosk_token"]


@pytest.mark.django_db
def test_employees_lookup_requires_query(api_client):
    EmployeeFactory(full_name="Zafar Karimov")
    assert api_client.get("/api/v1/survey-sessions/employees-lookup/?q=z").data == []
    hits = api_client.get("/api/v1/survey-sessions/employees-lookup/?q=zafar").data
    assert len(hits) == 1
    assert set(hits[0]) == {"id", "full_name"}
