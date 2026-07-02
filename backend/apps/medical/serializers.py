from rest_framework import serializers

from .models import MedicalCheck


class MedicalCheckSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)
    medic_username = serializers.CharField(source="medic.username", read_only=True)

    class Meta:
        model = MedicalCheck
        fields = [
            "id",
            "employee",
            "employee_name",
            "bp_systolic",
            "bp_diastolic",
            "pulse",
            "saturation",
            "alcohol_value",
            "alcohol_positive",
            "hours_worked",
            "hours_rested",
            "conclusion",
            "note",
            "medic",
            "medic_username",
            "created_at",
        ]
        # Medic and date/time are recorded automatically (SRS §7.1-7.2).
        read_only_fields = ["medic", "created_at"]
