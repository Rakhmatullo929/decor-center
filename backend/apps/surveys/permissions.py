"""Kiosk authorisation: an employee JWT (issued by verify-otp) instead of a login form."""
from rest_framework.permissions import BasePermission

from apps.accounts.models import Roles


class IsSurveyEmployee(BasePermission):
    """Grant access to an employee who completed the kiosk face+OTP flow.

    `verify-otp` mints a normal employee JWT (apps.accounts.tokens.issue_token_pair)
    carrying a `kiosk_fallback` claim (Face-ID bypassed via manual pick). Attaches
    `kiosk_employee_id`/`kiosk_fallback` to the request so due/start/submit — written
    against the old X-Kiosk-Token scheme — need no further changes.
    """

    message = {"detail": "Employee login required.", "code": "employee_unverified"}

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated and user.role == Roles.EMPLOYEE):
            return False
        employee = getattr(user, "employee_profile", None)
        if employee is None:
            return False
        request.kiosk_employee_id = employee.id
        request.kiosk_fallback = bool(request.auth.get("kiosk_fallback", False)) if request.auth else False
        return True
