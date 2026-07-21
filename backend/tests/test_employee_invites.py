from datetime import timedelta

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from apps.employees.models import Employee, EmployeeInvite
from apps.employees.services import (
    create_employee_invite,
    get_invite_by_token,
    hash_invite_token,
)

from .conftest import png_bytes
from .factories import EmployeeFactory, SpecialtyFactory

pytestmark = pytest.mark.django_db


def test_create_invite_stores_hashed_token_and_returns_raw():
    specialty = SpecialtyFactory()
    invite, raw = create_employee_invite(specialty=specialty)
    assert len(raw) >= 32
    # Raw token is never stored; only its hash.
    assert invite.token_hash == hash_invite_token(raw)
    assert EmployeeInvite.objects.filter(token_hash=hash_invite_token(raw)).exists()
    assert not EmployeeInvite.objects.filter(token_hash=raw).exists()
    assert invite.is_valid() is True


def test_get_invite_by_token_roundtrip_and_unknown():
    specialty = SpecialtyFactory()
    invite, raw = create_employee_invite(specialty=specialty)
    assert get_invite_by_token(raw) == invite
    assert get_invite_by_token("nope") is None
    assert get_invite_by_token("") is None


def test_is_valid_reflects_used_and_expired():
    specialty = SpecialtyFactory()
    invite, _ = create_employee_invite(specialty=specialty)

    invite.is_used = True
    assert invite.is_valid() is False

    invite.is_used = False
    invite.expires_at = timezone.now() - timedelta(seconds=1)
    assert invite.is_expired() is True
    assert invite.is_valid() is False


INVITES_URL = "/api/v1/employee-invites/"


def test_admin_creates_invite_returns_token_and_expiry(admin_client):
    specialty = SpecialtyFactory()
    resp = admin_client.post(INVITES_URL, {"specialty": specialty.id}, format="json")
    assert resp.status_code == 201, resp.data
    assert resp.data["token"]
    assert resp.data["expires_at"]
    # Token in the response must not be what is stored (only its hash is).
    assert not EmployeeInvite.objects.filter(token_hash=resp.data["token"]).exists()
    assert EmployeeInvite.objects.filter(token_hash=hash_invite_token(resp.data["token"])).exists()


def test_non_admin_cannot_create_invite(employee_client):
    specialty = SpecialtyFactory()
    resp = employee_client.post(INVITES_URL, {"specialty": specialty.id}, format="json")
    assert resp.status_code == 403


def test_anonymous_cannot_create_invite(api_client):
    specialty = SpecialtyFactory()
    resp = api_client.post(INVITES_URL, {"specialty": specialty.id}, format="json")
    assert resp.status_code in (401, 403)


VALIDATE_URL = "/api/v1/employee-invites/validate/"


def test_validate_public_valid_token(api_client):
    specialty = SpecialtyFactory(name="Дизайнер")
    _, raw = create_employee_invite(specialty=specialty)
    resp = api_client.get(VALIDATE_URL, {"token": raw})
    assert resp.status_code == 200
    assert resp.data == {"valid": True, "reason": "ok", "specialty_name": "Дизайнер"}


def test_validate_unknown_used_and_expired(api_client):
    specialty = SpecialtyFactory()
    assert api_client.get(VALIDATE_URL, {"token": "nope"}).data == {
        "valid": False,
        "reason": "not_found",
    }

    invite, raw = create_employee_invite(specialty=specialty)
    invite.is_used = True
    invite.save(update_fields=["is_used"])
    assert api_client.get(VALIDATE_URL, {"token": raw}).data["reason"] == "used"

    invite2, raw2 = create_employee_invite(specialty=specialty)
    invite2.expires_at = timezone.now() - timedelta(seconds=1)
    invite2.save(update_fields=["expires_at"])
    assert api_client.get(VALIDATE_URL, {"token": raw2}).data["reason"] == "expired"


REGISTER_URL = "/api/v1/employee-invites/register/"


def _reg_photo():
    return SimpleUploadedFile("face.png", png_bytes(), content_type="image/png")


def test_register_creates_inactive_employee_and_consumes_invite(api_client):
    specialty = SpecialtyFactory()
    invite, raw = create_employee_invite(specialty=specialty)

    resp = api_client.post(
        REGISTER_URL,
        {
            "token": raw,
            "full_name": "Yangi Xodim",
            "phone": "+998901112233",
            "work_experience": 4,
            "photo": _reg_photo(),
        },
        format="multipart",
    )
    assert resp.status_code == 201, resp.data
    assert resp.data == {"status": "pending"}

    employee = Employee.objects.get(full_name="Yangi Xodim")
    assert employee.is_active is False
    assert employee.hire_date is None
    assert employee.specialty_id == specialty.id
    assert employee.work_experience == 4
    assert employee.face_embedding is not None  # seeded from the photo

    invite.refresh_from_db()
    assert invite.is_used is True
    assert invite.used_at is not None
    assert invite.employee_id == employee.id


def test_register_second_use_of_same_token_is_rejected(api_client):
    specialty = SpecialtyFactory()
    _, raw = create_employee_invite(specialty=specialty)
    first = api_client.post(
        REGISTER_URL,
        {"token": raw, "full_name": "A", "phone": "+998901112233",
         "work_experience": 1, "photo": _reg_photo()},
        format="multipart",
    )
    assert first.status_code == 201
    second = api_client.post(
        REGISTER_URL,
        {"token": raw, "full_name": "B", "phone": "+998901112244",
         "work_experience": 1, "photo": _reg_photo()},
        format="multipart",
    )
    assert second.status_code == 400
    assert second.data["code"] == "invite_invalid"
    assert Employee.objects.filter(full_name="B").count() == 0


def test_register_unknown_token_rejected(api_client):
    resp = api_client.post(
        REGISTER_URL,
        {"token": "nope", "full_name": "X", "phone": "+998901112233",
         "work_experience": 1, "photo": _reg_photo()},
        format="multipart",
    )
    assert resp.status_code == 400
    assert resp.data["code"] == "invite_invalid"


def test_register_missing_photo_is_rejected(api_client):
    specialty = SpecialtyFactory()
    _, raw = create_employee_invite(specialty=specialty)
    resp = api_client.post(
        REGISTER_URL,
        {"token": raw, "full_name": "X", "phone": "+998901112233", "work_experience": 1},
        format="multipart",
    )
    assert resp.status_code == 400
    assert not EmployeeInvite.objects.get(token_hash=hash_invite_token(raw)).is_used


def test_inactive_self_registered_employee_is_not_identifiable(api_client, face_image):
    # Register via invite -> inactive employee with a face embedding.
    specialty = SpecialtyFactory()
    _, raw = create_employee_invite(specialty=specialty)
    api_client.post(
        REGISTER_URL,
        {"token": raw, "full_name": "Ghost", "phone": "+998901112233",
         "work_experience": 1, "photo": SimpleUploadedFile("f.png", png_bytes(), content_type="image/png")},
        format="multipart",
    )
    # Kiosk identify only searches active employees -> 404.
    resp = api_client.post(
        "/api/v1/survey-sessions/identify/", {"face_image": face_image}, format="multipart"
    )
    assert resp.status_code == 404


def test_activation_stamps_hire_date_when_missing(admin_client, api_client):
    specialty = SpecialtyFactory()
    _, raw = create_employee_invite(specialty=specialty)
    api_client.post(
        REGISTER_URL,
        {"token": raw, "full_name": "Pending Person", "phone": "+998901112233",
         "work_experience": 2, "photo": _reg_photo()},
        format="multipart",
    )
    employee = Employee.objects.get(full_name="Pending Person")
    assert employee.hire_date is None

    resp = admin_client.patch(
        f"/api/v1/employees/{employee.id}/", {"is_active": True}, format="json"
    )
    assert resp.status_code == 200, resp.data
    employee.refresh_from_db()
    assert employee.is_active is True
    assert employee.hire_date == timezone.localdate()


def test_activation_does_not_overwrite_existing_hire_date(admin_client):
    specialty = SpecialtyFactory()
    employee = EmployeeFactory(specialty=specialty, is_active=False, hire_date="2020-01-01")
    resp = admin_client.patch(
        f"/api/v1/employees/{employee.id}/", {"is_active": True}, format="json"
    )
    assert resp.status_code == 200
    employee.refresh_from_db()
    assert str(employee.hire_date) == "2020-01-01"


def test_is_self_registered_flag(admin_client, api_client):
    specialty = SpecialtyFactory()
    _, raw = create_employee_invite(specialty=specialty)
    api_client.post(
        REGISTER_URL,
        {"token": raw, "full_name": "Self Reg", "phone": "+998901112233",
         "work_experience": 1, "photo": _reg_photo()},
        format="multipart",
    )
    admin_made = EmployeeFactory(specialty=specialty, full_name="Admin Made")

    resp = admin_client.get("/api/v1/employees/", {"is_active": "false", "search": "Self Reg"})
    assert resp.data["results"][0]["is_self_registered"] is True

    resp2 = admin_client.get(f"/api/v1/employees/{admin_made.id}/")
    assert resp2.data["is_self_registered"] is False
