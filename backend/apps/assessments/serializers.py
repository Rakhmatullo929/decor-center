from django.conf import settings as django_settings
from rest_framework import serializers

from apps.employees.models import Employee

from .models import Module, Question, TestAnswer, TestSession


class QuestionAdminSerializer(serializers.ModelSerializer):
    """Full question representation — admin only (includes the correct answer)."""

    specialty_name = serializers.CharField(source="specialty.name", read_only=True, default=None)

    class Meta:
        model = Question
        fields = [
            "id",
            "module",
            "specialty",
            "specialty_name",
            "text",
            "options",
            "correct_option",
            "source",
            "status",
            "audio",
            "audio_status",
            "created_at",
        ]
        read_only_fields = ["source", "created_at", "audio", "audio_status"]

    def validate_options(self, value):
        if (
            not isinstance(value, list)
            or len(value) != 4
            or not all(isinstance(option, str) and option.strip() for option in value)
        ):
            raise serializers.ValidationError("Options must be a list of exactly 4 non-empty strings.")
        return value

    def validate_correct_option(self, value):
        if not 0 <= value <= 3:
            raise serializers.ValidationError("correct_option must be between 0 and 3.")
        return value

    def validate(self, attrs):
        module = attrs.get("module", getattr(self.instance, "module", None))
        specialty = attrs.get("specialty", getattr(self.instance, "specialty", None))
        if module == Module.SPECIALTY and specialty is None:
            raise serializers.ValidationError(
                {"specialty": "Specialty is required for professional knowledge questions."}
            )
        if module in (Module.TECH_SAFETY, Module.INDUSTRIAL_SAFETY) and specialty is not None:
            raise serializers.ValidationError(
                {"specialty": "Specialty must be empty for occupational safety questions."}
            )
        return attrs


class QuestionPublicSerializer(serializers.ModelSerializer):
    """Question as shown to the employee during a test — no correct answer."""

    audio_url = serializers.SerializerMethodField()

    class Meta:
        model = Question
        fields = ["id", "module", "text", "options", "audio_url"]

    def get_audio_url(self, obj):
        if not obj.audio:
            return None
        request = self.context.get("request")
        url = obj.audio.url
        return request.build_absolute_uri(url) if request else url


class StartTestSessionSerializer(serializers.Serializer):
    employee = serializers.PrimaryKeyRelatedField(
        queryset=Employee.objects.filter(is_active=True)
    )
    module = serializers.ChoiceField(choices=Module.choices)
    face_image = serializers.ImageField()


class AnswerItemSerializer(serializers.Serializer):
    question = serializers.IntegerField()
    selected_option = serializers.IntegerField(min_value=0, max_value=3)


class SubmitTestSessionSerializer(serializers.Serializer):
    answers = AnswerItemSerializer(many=True, allow_empty=False)
    # Optional base64 (raw or data-URL) camera frame for submit-time re-verification.
    face_image = serializers.CharField(required=False, allow_blank=True)


class TestAnswerSerializer(serializers.ModelSerializer):
    """Answer breakdown for the admin results detail (includes the correct answer)."""

    question_text = serializers.CharField(source="question.text", read_only=True)
    question_options = serializers.JSONField(source="question.options", read_only=True)
    correct_option = serializers.IntegerField(source="question.correct_option", read_only=True)

    class Meta:
        model = TestAnswer
        fields = [
            "question",
            "question_text",
            "question_options",
            "selected_option",
            "correct_option",
            "is_correct",
        ]


class TestSessionSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)
    specialty_name = serializers.CharField(source="specialty.name", read_only=True, default=None)
    requires_submit_reverify = serializers.SerializerMethodField()

    class Meta:
        model = TestSession
        fields = [
            "id",
            "employee",
            "employee_name",
            "module",
            "specialty",
            "specialty_name",
            "started_at",
            "finished_at",
            "score",
            "total",
            "passed",
            "face_verified",
            "submit_face_verified",
            "requires_submit_reverify",
        ]
        read_only_fields = fields

    def get_requires_submit_reverify(self, obj) -> bool:
        return django_settings.DEPO["REVERIFY_ON_SUBMIT"] in ("log", "block")


class TestSessionDetailSerializer(TestSessionSerializer):
    answers = TestAnswerSerializer(many=True, read_only=True)

    class Meta(TestSessionSerializer.Meta):
        fields = TestSessionSerializer.Meta.fields + ["answers"]
        read_only_fields = fields
