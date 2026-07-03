"""Role-based permission classes (SRS §3.2, §11.2 — enforced server-side)."""
from rest_framework.permissions import SAFE_METHODS, BasePermission

from .models import Roles


class HasAnyRole(BasePermission):
    """Allow only authenticated users whose role is in `allowed_roles`."""

    allowed_roles: frozenset = frozenset()

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role in self.allowed_roles)


class IsAdmin(HasAnyRole):
    allowed_roles = frozenset({Roles.ADMIN})


class IsEmployee(HasAnyRole):
    allowed_roles = frozenset({Roles.EMPLOYEE})


class IsAdminOrEmployee(HasAnyRole):
    allowed_roles = frozenset({Roles.ADMIN, Roles.EMPLOYEE})


class IsAdminOrReadOnly(BasePermission):
    """Authenticated users may read; only admins may write."""

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if request.method in SAFE_METHODS:
            return True
        return user.role == Roles.ADMIN
