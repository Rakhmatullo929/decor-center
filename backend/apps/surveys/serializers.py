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
        text = str(opt.get("text") or "").strip() if isinstance(opt, dict) else ""
        if not isinstance(opt, dict) or not text:
            raise serializers.ValidationError(
                "Each option must be an object with non-empty 'text'."
            )
        oid = str(opt.get("id") or uuid.uuid4())
        normalized.append({"id": oid, "text": text})
    ids = [opt["id"] for opt in normalized]
    if len(ids) != len(set(ids)):
        raise serializers.ValidationError("Option ids must be unique.")
    return normalized


class QuestionSerializer(serializers.ModelSerializer):
    """Question as edited by the admin builder."""

    class Meta:
        model = Question
        fields = [
            "id", "block", "type", "order", "text", "options", "settings",
            "is_required", "is_mind_dive",
        ]

    def validate(self, attrs):
        q_type = attrs.get("type", getattr(self.instance, "type", Question.Type.SINGLE))
        options = attrs.get("options", getattr(self.instance, "options", []))
        settings_val = dict(
            attrs.get("settings", getattr(self.instance, "settings", None) or {})
        )

        if q_type in (Question.Type.SINGLE, Question.Type.MULTIPLE):
            try:
                attrs["options"] = _validate_options_shape(options)
            except serializers.ValidationError as exc:
                raise serializers.ValidationError({"options": exc.detail}) from exc
        else:
            if options:
                raise serializers.ValidationError(
                    {"options": f"{q_type} questions must have no options."}
                )
            attrs["options"] = []

        if q_type in Question.SCALE_TYPES:
            default_min, default_max = (0, 10) if q_type == Question.Type.NPS else (1, 5)
            settings_val.setdefault("min", default_min)
            settings_val.setdefault("max", default_max)
        attrs["settings"] = settings_val
        return attrs


class QuestionPublicSerializer(serializers.ModelSerializer):
    """Question as presented to the kiosk — no correctness data (there is none)."""

    class Meta:
        model = Question
        fields = [
            "id", "type", "order", "text", "options", "settings",
            "is_required", "is_mind_dive",
        ]


class QuestionBlockSerializer(serializers.ModelSerializer):
    """Block as edited by the admin builder."""

    questions = QuestionSerializer(many=True, read_only=True)

    class Meta:
        model = QuestionBlock
        fields = ["id", "test", "order", "title", "questions"]


class QuestionBlockPublicSerializer(serializers.ModelSerializer):
    """Block as presented to the kiosk."""

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
    status = serializers.ReadOnlyField()
    answered_count = serializers.SerializerMethodField()
    total_count = serializers.SerializerMethodField()

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
            "status",
            "answered_count",
            "total_count",
        ]
        read_only_fields = fields

    def _progress(self, obj):
        """(answered, total) over scorable questions (section headers excluded),
        computed once per object from the prefetched answers."""
        cached = getattr(obj, "_progress_cache", None)
        if cached is not None:
            return cached
        scorable = [
            a for a in obj.answers.all()
            if a.question.type != Question.Type.SECTION_HEADER
        ]
        answered = sum(
            1 for a in scorable if a.selected_option_ids or a.text_value.strip()
        )
        cached = (answered, len(scorable))
        obj._progress_cache = cached
        return cached

    def get_answered_count(self, obj):
        return self._progress(obj)[0]

    def get_total_count(self, obj):
        return self._progress(obj)[1]


class SurveySessionDetailSerializer(SurveySessionSerializer):
    answers = AnswerReadSerializer(many=True, read_only=True)
    blocks = serializers.SerializerMethodField()

    class Meta(SurveySessionSerializer.Meta):
        fields = SurveySessionSerializer.Meta.fields + ["answers", "blocks"]
        read_only_fields = fields

    def get_blocks(self, obj):
        blocks = obj.test.blocks.prefetch_related("questions")
        return QuestionBlockPublicSerializer(blocks, many=True).data


class KioskIdentifiedEmployeeSerializer(serializers.ModelSerializer):
    """Public identify payload: enough for the kiosk banner + a masked phone. No PII leak
    beyond what a matching face already implies; never exposes the raw phone/embedding."""

    specialty_name = serializers.CharField(source="specialty.name", read_only=True)
    phone_masked = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = ["id", "full_name", "specialty_name", "photo", "phone_masked"]

    def get_phone_masked(self, obj) -> str:
        from .otp import mask_phone

        return mask_phone(obj.phone)
