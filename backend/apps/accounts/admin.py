from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class DecorUserAdmin(UserAdmin):
    list_display = ["username", "role", "is_active", "last_login"]
    list_filter = ["role", "is_active"]
    fieldsets = UserAdmin.fieldsets + (("Role", {"fields": ("role",)}),)
    add_fieldsets = UserAdmin.add_fieldsets + (("Role", {"fields": ("role",)}),)
