"""Kiosk SMS one-time-code: generate + send + verify. Static 0000 until Eskiz lands."""
import hashlib
from datetime import timedelta

from django.conf import settings as dj_settings
from django.utils import timezone
from django.utils.crypto import get_random_string

from apps.employees.models import Employee
from apps.integrations.registry import get_sms_sender

from .models import OtpChallenge


class PhoneNotSetError(Exception):
    """The employee has no phone number, so no code can be sent."""


class OtpError(Exception):
    """OTP verification failed. str(exc) is a stable machine code."""


def mask_phone(phone: str) -> str:
    """'+998901234567' -> '+998 *** ** 67'. Empty stays empty."""
    phone = (phone or "").strip()
    if len(phone) < 6:
        return phone
    return f"{phone[:4]} *** ** {phone[-2:]}"


def _hash_code(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def _new_code() -> str:
    static = dj_settings.DECOR["KIOSK_OTP_STATIC_CODE"]
    if static:
        return static
    return get_random_string(4, allowed_chars="0123456789")


def request_otp(employee: Employee) -> str:
    """Create a challenge, send the code by SMS, return the masked phone."""
    if not employee.phone:
        raise PhoneNotSetError("Employee has no phone number on file.")
    code = _new_code()
    ttl = dj_settings.DECOR["KIOSK_OTP_TTL_SECONDS"]
    OtpChallenge.objects.create(
        employee=employee,
        code_hash=_hash_code(code),
        expires_at=timezone.now() + timedelta(seconds=ttl),
    )
    get_sms_sender().send(employee.phone, f"Decor Center kod: {code}")
    return mask_phone(employee.phone)


def verify_otp(employee: Employee, code: str) -> None:
    """Verify the latest unused challenge for the employee. Raise OtpError on failure."""
    challenge = (
        OtpChallenge.objects.filter(employee=employee, is_used=False)
        .order_by("-created_at")
        .first()
    )
    if challenge is None or challenge.is_expired():
        raise OtpError("expired")
    if challenge.attempts >= dj_settings.DECOR["KIOSK_OTP_MAX_ATTEMPTS"]:
        raise OtpError("too_many_attempts")

    challenge.attempts += 1
    if challenge.code_hash != _hash_code(str(code)):
        challenge.save(update_fields=["attempts", "updated_at"])
        raise OtpError("invalid_code")

    challenge.is_used = True
    challenge.save(update_fields=["attempts", "is_used", "updated_at"])
