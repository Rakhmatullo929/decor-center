import pytest

from apps.surveys.models import OtpChallenge

from .factories import EmployeeFactory, QuestionFactory


def _verify(api_client, employee_id, fallback=False):
    """Run the real request-otp + verify-otp round trip and bearer-auth the client
    with the returned access token, as /scan does after a successful scan."""
    api_client.post(
        "/api/v1/survey-sessions/request-otp/", {"employee": employee_id}, format="json"
    )
    resp = api_client.post(
        "/api/v1/survey-sessions/verify-otp/",
        {"employee": employee_id, "code": "0000", "fallback": fallback},
        format="json",
    )
    assert resp.status_code == 200, resp.data
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['access']}")
    return api_client


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
    assert ok.data["access"] and ok.data["refresh"]
    assert ok.data["user"]["role"] == "employee"
    assert ok.data["user"]["username"] == f"employee-{emp.id}"


@pytest.mark.django_db
def test_employees_lookup_requires_query(api_client):
    EmployeeFactory(full_name="Zafar Karimov")
    assert api_client.get("/api/v1/survey-sessions/employees-lookup/?q=z").data == []
    hits = api_client.get("/api/v1/survey-sessions/employees-lookup/?q=zafar").data
    assert len(hits) == 1
    assert set(hits[0]) == {"id", "full_name"}


@pytest.mark.django_db
def test_due_requires_employee_login(api_client):
    emp = EmployeeFactory(phone="+998901234567")
    # no employee JWT → rejected (401 unauthenticated, since a JWT authenticator is present)
    assert api_client.get(
        f"/api/v1/survey-sessions/due/?employee={emp.id}"
    ).status_code in (401, 403)


@pytest.mark.django_db
def test_start_after_face_entry_marks_face_verified(api_client):
    """Face-ID happens once at entry (identify + OTP, not fallback) — start just
    inherits that, with no further camera frame."""
    emp = EmployeeFactory(phone="+998901234567")
    q = QuestionFactory()
    test = q.block.test
    resp = _verify(api_client, emp.id, fallback=False).post(
        "/api/v1/survey-sessions/start/",
        {"employee": emp.id, "test": test.id},
        format="json",
    )
    assert resp.status_code == 201, resp.content
    assert resp.data["session"]["face_verified"] is True


@pytest.mark.django_db
def test_start_fallback_without_face_succeeds(api_client):
    emp = EmployeeFactory(phone="+998901234567")
    q = QuestionFactory()
    test = q.block.test
    resp = _verify(api_client, emp.id, fallback=True).post(
        "/api/v1/survey-sessions/start/",
        {"employee": emp.id, "test": test.id},
        format="json",
    )
    assert resp.status_code == 201, resp.content
    assert resp.data["session"]["face_verified"] is False


@pytest.mark.django_db
def test_start_rejects_employee_mismatch(api_client):
    emp = EmployeeFactory(phone="+998901234567")
    other = EmployeeFactory(phone="+998900000000")
    q = QuestionFactory()
    resp = _verify(api_client, other.id).post(
        "/api/v1/survey-sessions/start/",
        {"employee": emp.id, "test": q.block.test.id},
        format="json",
    )
    assert resp.status_code == 403
