import uuid

from rest_framework import serializers

from apps.employees.models import Employee

from .models import Answer, Question, QuestionBlock, SurveySession, Test


def _validate_options_shape(options):
    """Validate/normalize a list of {id, text}; assign a uuid for any missing id."""
    if not isinstance(options, list) or not options:
        raise serializers.ValidationError("Options must be a non-empty list.")
    normalized = []
    for opt in options:
        if not isinstance(opt, dict) or not str(opt.get("text", "")).strip():
            raise serializers.ValidationError(
                "Each option must be an object with non-empty 'text'."
            )
        oid = str(opt.get("id") or uuid.uuid4())
        normalized.append({"id": oid, "text": opt["text"]})
    ids = [opt["id"] for opt in normalized]
    if len(ids) != len(set(ids)):
        raise serializers.ValidationError("Option ids must be unique.")
    return normalized


class QuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = ["id", "block", "type", "order", "text", "options"]

    def validate(self, attrs):
        q_type = attrs.get("type", getattr(self.instance, "type", Question.Type.SINGLE))
        options = attrs.get("options", getattr(self.instance, "options", []))
        if q_type == Question.Type.TEXTAREA:
            if options:
                raise serializers.ValidationError(
                    {"options": "Textarea questions must have no options."}
                )
            attrs["options"] = []
        else:
            try:
                attrs["options"] = _validate_options_shape(options)
            except serializers.ValidationError as exc:
                raise serializers.ValidationError({"options": exc.detail}) from exc
        return attrs


class QuestionPublicSerializer(serializers.ModelSerializer):
    """Question as presented to the kiosk — no correctness data (there is none)."""

    class Meta:
        model = Question
        fields = ["id", "type", "order", "text", "options"]


class QuestionBlockSerializer(serializers.ModelSerializer):
    questions = QuestionPublicSerializer(many=True, read_only=True)

    class Meta:
        model = QuestionBlock
        fields = ["id", "test", "order", "title", "questions"]


class TestSerializer(serializers.ModelSerializer):
    blocks = QuestionBlockSerializer(many=True, read_only=True)

    class Meta:
        model = Test
        fields = [
            "id",
            "title",
            "is_active",
            "is_admin_conducted",
            "is_after_application",
            "after_days",
            "test_days_from",
            "test_days_to",
            "month",
            "blocks",
        ]

    def validate(self, attrs):
        is_after = attrs.get(
            "is_after_application",
            getattr(self.instance, "is_after_application", False),
        )
        after_days = attrs.get(
            "after_days", getattr(self.instance, "after_days", None)
        )
        if is_after and after_days is None:
            raise serializers.ValidationError(
                {"after_days": "Required when is_after_application is true."}
            )
        return attrs


class StartSurveySerializer(serializers.Serializer):
    employee = serializers.PrimaryKeyRelatedField(
        queryset=Employee.objects.filter(is_active=True)
    )
    test = serializers.PrimaryKeyRelatedField(
        queryset=Test.objects.filter(is_active=True)
    )
    face_image = serializers.ImageField()


class AnswerItemSerializer(serializers.Serializer):
    question = serializers.IntegerField()
    selectedOptionIds = serializers.ListField(  # noqa: N815 (client contract camelCase)
        child=serializers.CharField(), required=False, default=list
    )
    textValue = serializers.CharField(  # noqa: N815
        required=False, allow_blank=True, default=""
    )


class SubmitSerializer(serializers.Serializer):
    answers = AnswerItemSerializer(many=True, allow_empty=False)
    # Optional base64 (raw or data-URL) camera frame for submit-time re-verification.
    faceImage = serializers.CharField(required=False, allow_blank=True)  # noqa: N815


class AdminFillSerializer(serializers.Serializer):
    employee = serializers.PrimaryKeyRelatedField(
        queryset=Employee.objects.filter(is_active=True)
    )
    test = serializers.PrimaryKeyRelatedField(queryset=Test.objects.all())
    answers = AnswerItemSerializer(many=True, allow_empty=False)


class AnswerReadSerializer(serializers.ModelSerializer):
    question_text = serializers.CharField(source="question.text", read_only=True)
    question_type = serializers.CharField(source="question.type", read_only=True)

    class Meta:
        model = Answer
        fields = [
            "question",
            "question_text",
            "question_type",
            "selected_option_ids",
            "text_value",
        ]


class SurveySessionSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)
    test_title = serializers.CharField(source="test.title", read_only=True)

    class Meta:
        model = SurveySession
        fields = [
            "id",
            "employee",
            "employee_name",
            "test",
            "test_title",
            "created_by",
            "face_verified",
            "model_version",
            "started_at",
            "completed_at",
        ]
        read_only_fields = fields


class SurveySessionDetailSerializer(SurveySessionSerializer):
    answers = AnswerReadSerializer(many=True, read_only=True)

    class Meta(SurveySessionSerializer.Meta):
        fields = SurveySessionSerializer.Meta.fields + ["answers"]
        read_only_fields = fields
