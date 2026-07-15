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
