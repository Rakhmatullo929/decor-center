from datetime import timedelta

import pytest
from django.utils import timezone

from apps.surveys.models import OtpChallenge

from .factories import EmployeeFactory


@pytest.mark.django_db
def test_otp_challenge_is_expired():
    emp = EmployeeFactory()
    fresh = OtpChallenge.objects.create(
        employee=emp, code_hash="x", expires_at=timezone.now() + timedelta(minutes=5)
    )
    stale = OtpChallenge.objects.create(
        employee=emp, code_hash="x", expires_at=timezone.now() - timedelta(seconds=1)
    )
    assert fresh.is_expired() is False
    assert stale.is_expired() is True
