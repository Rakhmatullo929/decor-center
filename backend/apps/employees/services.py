"""Bridges a survey-taking Employee to a login-capable User (SRS: kiosk face+OTP flow)."""
import hashlib
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.utils.crypto import get_random_string

from apps.accounts.models import Roles, User

from .models import Employee, EmployeeInvite


def get_or_create_employee_user(employee: Employee) -> User:
    """Return the employee's login account, provisioning it on first kiosk verify.

    Employees never authenticate with a password (only face/OTP), so the account is
    created with an unusable password. `first_name` is kept in sync with `full_name`
    so a future employee cabinet has a display name without a second lookup.
    """
    if employee.user_id is not None:
        user = employee.user
        if user.first_name != employee.full_name or user.role != Roles.EMPLOYEE:
            user.first_name = employee.full_name
            user.role = Roles.EMPLOYEE
            user.save(update_fields=["first_name", "role"])
        return user

    user = User.objects.create(
        username=f"employee-{employee.id}",
        first_name=employee.full_name,
        role=Roles.EMPLOYEE,
    )
    user.set_unusable_password()
    user.save(update_fields=["password"])
    employee.user = user
    employee.save(update_fields=["user"])
    return user


@transaction.atomic
def delete_employee_with_related(employee: Employee) -> None:
    """Hard-delete an employee together with all their survey history.

    The surveys app references Employee with ``on_delete=PROTECT`` (SurveySession,
    FaceVerificationLog, OtpChallenge), so a plain ``employee.delete()`` raises
    ProtectedError. We clear those protected reverse relations first — via the reverse
    accessors, so this module never imports surveys models — then delete the employee.
    Deleting the sessions cascades to their Answers; deleting the employee cascades to
    EmployeeFacePhoto. The whole operation is atomic.

    The employee's linked login ``User`` (OneToOne, SET_NULL) and stored media files are
    intentionally left in place — they are harmless artifacts, not survey history.
    """
    employee.survey_sessions.all().delete()
    employee.survey_face_logs.all().delete()
    employee.otp_challenges.all().delete()
    employee.delete()


def hash_invite_token(raw_token: str) -> str:
    """sha256 of the raw invite token (the only form stored in the DB)."""
    return hashlib.sha256(raw_token.encode()).hexdigest()


def create_employee_invite(specialty, created_by=None):
    """Mint a one-time invite. Returns (invite, raw_token). Store only the hash."""
    raw_token = get_random_string(48)
    ttl_days = settings.DECOR["EMPLOYEE_INVITE_TTL_DAYS"]
    invite = EmployeeInvite.objects.create(
        token_hash=hash_invite_token(raw_token),
        specialty=specialty,
        expires_at=timezone.now() + timedelta(days=ttl_days),
        created_by=created_by,
    )
    return invite, raw_token


def get_invite_by_token(raw_token: str):
    """Look up an invite by raw token (any state). Returns None if unknown/blank."""
    if not raw_token:
        return None
    try:
        return EmployeeInvite.objects.select_related("specialty").get(
            token_hash=hash_invite_token(raw_token)
        )
    except EmployeeInvite.DoesNotExist:
        return None
