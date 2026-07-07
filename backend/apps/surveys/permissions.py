"""Kiosk authorisation: a valid X-Kiosk-Token (issued after OTP) instead of a login."""
from rest_framework.permissions import BasePermission

from .kiosk_token import read_kiosk_token


class IsKioskVerified(BasePermission):
    """Grant access to a kiosk-token bearer; attach the token's employee to the request."""

    message = {"detail": "Kiosk verification required.", "code": "kiosk_unverified"}

    def has_permission(self, request, view):
        token = request.headers.get("X-Kiosk-Token", "")
        data = read_kiosk_token(token) if token else None
        if not data:
            return False
        request.kiosk_employee_id = data["employee_id"]
        request.kiosk_fallback = data["fallback"]
        return True
