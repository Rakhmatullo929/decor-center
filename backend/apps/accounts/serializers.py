from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import Roles, User
from .permission_catalog import permissions_for_role


class DecorTokenObtainPairSerializer(TokenObtainPairSerializer):
    """JWT login: embeds the role claim and returns user info alongside tokens."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["username"] = user.username
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = MeSerializer(self.user).data
        return data


class MeSerializer(serializers.ModelSerializer):
    permissions = serializers.SerializerMethodField()
    employee_id = serializers.SerializerMethodField()
    phone = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "role",
            "first_name",
            "last_name",
            "permissions",
            "employee_id",
            "phone",
        ]
        read_only_fields = fields

    def get_permissions(self, obj) -> list[str]:
        return permissions_for_role(obj.role)

    def _employee(self, obj):
        # Admins have no linked Employee row; keep employee_id/phone null for them.
        if obj.role != Roles.EMPLOYEE:
            return None
        return getattr(obj, "employee_profile", None)

    def get_employee_id(self, obj) -> int | None:
        employee = self._employee(obj)
        return employee.id if employee else None

    def get_phone(self, obj) -> str | None:
        employee = self._employee(obj)
        return employee.phone or None if employee else None
