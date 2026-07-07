from datetime import timedelta

import pytest
from django.utils import timezone

from apps.surveys.models import OtpChallenge
from apps.surveys.otp import (
    OtpError,
    PhoneNotSetError,
    mask_phone,
    request_otp,
    verify_otp,
)

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


def test_mask_phone():
    assert mask_phone("+998901234567") == "+998 *** ** 67"
    assert mask_phone("") == ""


@pytest.mark.django_db
def test_request_otp_returns_masked_and_creates_challenge():
    emp = EmployeeFactory(phone="+998901234567")
    masked = request_otp(emp)
    assert masked == "+998 *** ** 67"
    assert OtpChallenge.objects.filter(employee=emp, is_used=False).count() == 1


@pytest.mark.django_db
def test_request_otp_without_phone_raises():
    emp = EmployeeFactory(phone="")
    with pytest.raises(PhoneNotSetError):
        request_otp(emp)


@pytest.mark.django_db
def test_verify_otp_happy_path_static_code():
    emp = EmployeeFactory(phone="+998901234567")
    request_otp(emp)
    verify_otp(emp, "0000")  # static default; no exception
    assert OtpChallenge.objects.get(employee=emp).is_used is True


@pytest.mark.django_db
def test_verify_otp_wrong_code_raises_and_counts_attempt():
    emp = EmployeeFactory(phone="+998901234567")
    request_otp(emp)
    with pytest.raises(OtpError) as exc:
        verify_otp(emp, "9999")
    assert str(exc.value) == "invalid_code"
    assert OtpChallenge.objects.get(employee=emp).attempts == 1


@pytest.mark.django_db
def test_verify_otp_expired_raises(settings):
    settings.DECOR = {**settings.DECOR, "KIOSK_OTP_TTL_SECONDS": -1}
    emp = EmployeeFactory(phone="+998901234567")
    request_otp(emp)
    with pytest.raises(OtpError) as exc:
        verify_otp(emp, "0000")
    assert str(exc.value) == "expired"


@pytest.mark.django_db
def test_verify_otp_too_many_attempts(settings):
    settings.DECOR = {**settings.DECOR, "KIOSK_OTP_MAX_ATTEMPTS": 2}
    emp = EmployeeFactory(phone="+998901234567")
    request_otp(emp)
    with pytest.raises(OtpError):
        verify_otp(emp, "1111")
    with pytest.raises(OtpError):
        verify_otp(emp, "1111")
    with pytest.raises(OtpError) as exc:
        verify_otp(emp, "0000")
    assert str(exc.value) == "too_many_attempts"
