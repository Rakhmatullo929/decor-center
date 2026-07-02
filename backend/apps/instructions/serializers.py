from django.conf import settings
from rest_framework import serializers

from .models import Instruction


class InstructionSerializer(serializers.ModelSerializer):
    specialty_name = serializers.CharField(source="specialty.name", read_only=True)

    class Meta:
        model = Instruction
        fields = [
            "id",
            "specialty",
            "specialty_name",
            "title",
            "file",
            "generation_status",
            "last_generated_at",
            "created_at",
        ]
        read_only_fields = ["generation_status", "last_generated_at", "created_at"]


class GenerateQuestionsSerializer(serializers.Serializer):
    """Parameters for an AI generation run (SRS §5.1.2 — count is configurable)."""

    count = serializers.IntegerField(min_value=1, max_value=100, default=10)
    language = serializers.CharField(max_length=10, required=False)

    def validate_language(self, value):
        return value or settings.DEPO["TESTGEN_LANGUAGE"]
