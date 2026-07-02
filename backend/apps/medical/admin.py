from django.contrib import admin

from .models import MedicalCheck, MedicalCheckAudit


@admin.register(MedicalCheck)
class MedicalCheckAdmin(admin.ModelAdmin):
    list_display = [
        "employee",
        "bp_systolic",
        "bp_diastolic",
        "pulse",
        "saturation",
        "alcohol_positive",
        "conclusion",
        "medic",
        "created_at",
    ]
    list_filter = ["conclusion", "alcohol_positive"]
    search_fields = ["employee__full_name"]


@admin.register(MedicalCheckAudit)
class MedicalCheckAuditAdmin(admin.ModelAdmin):
    list_display = ["medical_check", "action", "performed_by", "created_at"]
    list_filter = ["action"]
    readonly_fields = ["medical_check", "action", "performed_by", "snapshot", "created_at"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
