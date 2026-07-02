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
        "instructions:read",
        "instructions:write",
        "questions:read",
        "questions:write",
        "results:read",
        "results:detail",
        "medical:read",
        "medical:detail",
    ],
    Roles.SPECIALIST: [
        "employees:read",
        "testing:write",
    ],
    Roles.MEDIC: [
        "employees:read",
        "medical:read",
        "medical:detail",
        "medical:write",
    ],
}


def permissions_for_role(role: str) -> list[str]:
    return ROLE_PERMISSIONS.get(role, [])
