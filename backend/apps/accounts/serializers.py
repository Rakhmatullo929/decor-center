from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import User
from .permission_catalog import permissions_for_role


class DepoTokenObtainPairSerializer(TokenObtainPairSerializer):
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

    class Meta:
        model = User
        fields = ["id", "username", "role", "first_name", "last_name", "permissions"]
        read_only_fields = fields

    def get_permissions(self, obj) -> list[str]:
        return permissions_for_role(obj.role)
