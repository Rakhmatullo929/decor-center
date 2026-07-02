"""Frontend permission catalog: role -> "<page>:<action>" keys.

The SRS (§3) defines three fixed roles, so permissions are derived from the
role server-side and shipped in the login and /auth/me payloads. The frontend
consumes them via `useCheckPermission` (permission-first UI); DRF permission
classes remain the enforcement source of truth.

Actions: read (list/menu), detail (detail view), write (mutations).
"""
from .models import Roles

ROLE_PERMISSIONS: dict[str, list[str]] = {
    Roles.ADMIN: [
        "dashboard:read",
        "employees:read",
        "employees:write",
        "specialties:read",
        "specialties:write",
        "tests:read",
        "tests:write",
        "questions:read",
        "questions:write",
        "results:read",
        "results:detail",
    ],
    Roles.SPECIALIST: [
        "employees:read",
        "survey:submit",
    ],
}


def permissions_for_role(role: str) -> list[str]:
    return ROLE_PERMISSIONS.get(role, [])
