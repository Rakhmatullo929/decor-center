import pytest

from apps.accounts import permissions as perms
from apps.accounts.models import Roles
from apps.accounts.permission_catalog import permissions_for_role


def test_roles_are_admin_and_specialist_only():
    values = {r.value for r in Roles}
    assert values == {"admin", "specialist"}
    assert Roles.SPECIALIST.label == "Сотрудник"


def test_medic_permission_classes_are_gone():
    assert not hasattr(perms, "IsMedic")
    assert not hasattr(perms, "IsAdminOrMedic")
    assert not hasattr(perms, "IsAdminOrMedicOrSpecialist")
    for name in ("HasAnyRole", "IsAdmin", "IsSpecialist", "IsAdminOrSpecialist", "IsAdminOrReadOnly"):
        assert hasattr(perms, name)


def test_permission_catalog():
    admin = permissions_for_role("admin")
    assert "employees:write" in admin
    assert "tests:write" in admin
    assert "results:read" in admin
    assert "dashboard:read" in admin
    assert permissions_for_role("specialist") == ["employees:read", "survey:submit"]
    assert permissions_for_role("medic") == []
