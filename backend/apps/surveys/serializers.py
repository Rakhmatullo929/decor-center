import uuid

from rest_framework import serializers

from apps.employees.models import Employee

from .i18n import display_text, normalize_i18n
from .models import Answer, Question, QuestionBlock, SurveySession, Test


def _validate_options_shape(options):
    """Validate/normalize a list of {id, text}; assign a uuid for any missing id, and
    upgrade each option's `text` into a canonical {"uz", "ru"} dict."""
    if not isinstance(options, list) or not options:
        raise serializers.ValidationError("Options must be a non-empty list.")
    normalized = []
    for opt in options:
        text = normalize_i18n(opt.get("text")) if isinstance(opt, dict) else {}
        if not isinstance(opt, dict) or not (text["uz"].strip() or text["ru"].strip()):
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
    """Question as edited by the admin builder — full bilingual {uz, ru} shape."""

    class Meta:
        model = Question
        fields = [
            "id", "block", "type", "order", "text", "options", "settings",
            "is_required", "is_mind_dive",
        ]

    def validate_text(self, value):
        return normalize_i18n(value)

    def to_representation(self, instance):
        """Normalize on read too: rows written outside the serializer (seed scripts,
        the Django admin, pre-migration data) may still hold plain strings/legacy
        option shapes — the builder always expects {uz, ru}."""
        data = super().to_representation(instance)
        data["text"] = normalize_i18n(data.get("text"))
        data["options"] = [
            {"id": opt.get("id"), "text": normalize_i18n(opt.get("text"))}
            for opt in data.get("options") or []
        ]
        settings_val = data.get("settings")
        if isinstance(settings_val, dict) and "placeholder" in settings_val:
            settings_val["placeholder"] = normalize_i18n(settings_val.get("placeholder"))
        return data

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
            settings_val["left_label"] = normalize_i18n(settings_val.get("left_label"))
            settings_val["right_label"] = normalize_i18n(settings_val.get("right_label"))
        elif q_type in (Question.Type.SHORT_TEXT, Question.Type.TEXTAREA, Question.Type.FORM_FIELD):
            if "placeholder" in settings_val:
                settings_val["placeholder"] = normalize_i18n(settings_val.get("placeholder"))
        attrs["settings"] = settings_val
        return attrs


class QuestionPublicSerializer(serializers.ModelSerializer):
    """Question as presented to the kiosk — no correctness data (there is none).

    Resolves the bilingual {uz, ru} text into a single display string so the
    current (not-yet-localized) kiosk UI keeps rendering unchanged.
    """

    text = serializers.SerializerMethodField()
    options = serializers.SerializerMethodField()

    class Meta:
        model = Question
        fields = [
            "id", "type", "order", "text", "options", "settings",
            "is_required", "is_mind_dive",
        ]

    def get_text(self, obj):
        return display_text(obj.text)

    def get_options(self, obj):
        return [
            {"id": opt.get("id"), "text": display_text(opt.get("text"))}
            for opt in obj.options or []
        ]


class QuestionBlockSerializer(serializers.ModelSerializer):
    """Block as edited by the admin builder — full bilingual {uz, ru} title."""

    questions = QuestionSerializer(many=True, read_only=True)

    class Meta:
        model = QuestionBlock
        fields = ["id", "test", "order", "title", "questions"]

    def validate_title(self, value):
        return normalize_i18n(value)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["title"] = normalize_i18n(data.get("title"))
        return data


class QuestionBlockPublicSerializer(serializers.ModelSerializer):
    """Block as presented to the kiosk — title resolved to a display string."""

    title = serializers.SerializerMethodField()
    questions = QuestionPublicSerializer(many=True, read_only=True)

    class Meta:
        model = QuestionBlock
        fields = ["id", "test", "order", "title", "questions"]

    def get_title(self, obj):
        return display_text(obj.title)


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
    question_text = serializers.SerializerMethodField()
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

    def get_question_text(self, obj):
        return display_text(obj.question.text)


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
