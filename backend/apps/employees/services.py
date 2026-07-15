"""Bridges a survey-taking Employee to a login-capable User (SRS: kiosk face+OTP flow)."""
from django.db import transaction

from apps.accounts.models import Roles, User

from .models import Employee


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
