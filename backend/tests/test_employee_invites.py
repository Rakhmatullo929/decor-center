import pytest
from django.utils import timezone
from datetime import timedelta

from apps.employees.models import EmployeeInvite
from apps.employees.services import (
    create_employee_invite,
    get_invite_by_token,
    hash_invite_token,
)

from .factories import SpecialtyFactory

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
