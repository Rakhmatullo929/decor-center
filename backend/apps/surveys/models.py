from django.db import models

from apps.core.models import TimeStampedModel


class Test(TimeStampedModel):
    """Opinion-survey definition (no scoring, no correct answers)."""

    __test__ = False  # not a pytest test class despite the name

    title = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)
    # Filled in by an admin during a 1-on-1 conversation; never appears in the kiosk list.
    is_admin_conducted = models.BooleanField(default=False)

    # Mode A: one-shot, N days after hire.
    is_after_application = models.BooleanField(default=False)
    after_days = models.PositiveIntegerField(null=True, blank=True)

    # Mode B: periodic, within a day-of-month window inside the listed months.
    test_days_from = models.PositiveSmallIntegerField(null=True, blank=True)  # 1..31
    test_days_to = models.PositiveSmallIntegerField(null=True, blank=True)  # 1..31
    month = models.JSONField(default=list, blank=True)  # e.g. [1,4,7,10]; [] => every month

    class Meta:
        ordering = ["title"]
        constraints = [
            models.CheckConstraint(
                name="after_days_required_when_after_application",
                condition=(
                    models.Q(is_after_application=False)
                    | models.Q(after_days__isnull=False)
                ),
            ),
        ]

    def __str__(self):
        return self.title


class QuestionBlock(TimeStampedModel):
    test = models.ForeignKey(Test, on_delete=models.CASCADE, related_name="blocks")
    order = models.PositiveIntegerField(default=0)
    title = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return self.title or f"Block<{self.pk}>"


class Question(TimeStampedModel):
    class Type(models.TextChoices):
        SINGLE = "single", "Один вариант (radio)"
        MULTIPLE = "multiple", "Несколько вариантов (checkbox)"
        SHORT_TEXT = "short_text", "Короткий текст"
        TEXTAREA = "textarea", "Длинный текст / открытый вопрос (MIND DIVE)"
        NPS = "nps", "NPS-шкала (0-10)"
        SCALE5 = "scale5", "Шкала оценки (1-5)"
        FORM_FIELD = "form_field", "Поле формы (текст/дата)"
        SIGNATURE_DATE = "signature_date", "Подпись + дата"
        SECTION_HEADER = "section_header", "Заголовок раздела"
        # Reserved for future use — not yet rendered by the builder or the kiosk.
        DROPDOWN = "dropdown", "Выпадающий список"
        DATE = "date", "Дата"
        NUMBER = "number", "Число"
        MATRIX = "matrix", "Матрица/сетка"
        RANKING = "ranking", "Ранжирование"
        FILE_UPLOAD = "file_upload", "Загрузка файла"

    # Types that never carry an `options` list.
    NO_OPTIONS_TYPES = frozenset(
        {
            Type.SHORT_TEXT,
            Type.TEXTAREA,
            Type.NPS,
            Type.SCALE5,
            Type.FORM_FIELD,
            Type.SIGNATURE_DATE,
            Type.SECTION_HEADER,
            Type.DATE,
            Type.NUMBER,
            Type.FILE_UPLOAD,
        }
    )
    SCALE_TYPES = frozenset({Type.NPS, Type.SCALE5})

    block = models.ForeignKey(
        QuestionBlock, on_delete=models.CASCADE, related_name="questions"
    )
    type = models.CharField(max_length=20, choices=Type.choices, default=Type.SINGLE)
    order = models.PositiveIntegerField(default=0)
    text = models.TextField(blank=True)
    # Stable option IDs so analytics survive reordering: [{"id": "<uuid>", "text": "..."}].
    options = models.JSONField(default=list, blank=True)  # [] when NO_OPTIONS_TYPES
    # Type-specific config: scale min/max + edge labels, placeholders, etc.
    settings = models.JSONField(default=dict, blank=True)
    is_required = models.BooleanField(default=False)
    # Flags an open question for deeper qualitative analysis (spec: "MIND DIVE").
    is_mind_dive = models.BooleanField(default=False)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return self.text[:60]


class SurveySession(TimeStampedModel):
    """One survey run by an employee. Face-ID gated (except admin-conducted). No scoring."""

    test = models.ForeignKey(Test, on_delete=models.PROTECT, related_name="sessions")
    employee = models.ForeignKey(
        "employees.Employee", on_delete=models.PROTECT, related_name="survey_sessions"
    )
    # Set when filled by an admin (1-on-1) — then Face-ID is not required.
    created_by = models.ForeignKey(
        "accounts.User",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    # Face-ID snapshot frozen at start (mirrors the assessments session freeze).
    face_verified = models.BooleanField(default=False)
    face_embedding = models.JSONField(null=True, blank=True, editable=False)
    model_version = models.CharField(max_length=64, blank=True)
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-started_at"]

    def __str__(self):
        return f"{self.employee_id} — {self.test_id} ({self.started_at:%Y-%m-%d %H:%M})"


class Answer(TimeStampedModel):
    session = models.ForeignKey(
        SurveySession, on_delete=models.CASCADE, related_name="answers"
    )
    question = models.ForeignKey(
        Question, on_delete=models.PROTECT, related_name="answers"
    )
    # Polymorphic response payload (no correctness).
    selected_option_ids = models.JSONField(default=list, blank=True)  # list[str]
    text_value = models.TextField(blank=True)  # textarea

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["session", "question"], name="unique_session_question"
            ),
        ]


class FaceVerificationLog(models.Model):
    """Audit of every kiosk Face-ID attempt (ported from assessments)."""

    class Stage(models.TextChoices):
        START = "start", "Survey start"
        SUBMIT = "submit", "Survey submit"

    employee = models.ForeignKey(
        "employees.Employee",
        on_delete=models.PROTECT,
        related_name="survey_face_logs",
    )
    session = models.ForeignKey(
        SurveySession,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="face_logs",
    )
    stage = models.CharField(max_length=10, choices=Stage.choices, default=Stage.START)
    success = models.BooleanField()
    similarity_score = models.FloatField(null=True, blank=True)
    reason = models.CharField(max_length=20, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class OtpChallenge(TimeStampedModel):
    """One SMS one-time-code challenge for kiosk login (post face/manual identify)."""

    employee = models.ForeignKey(
        "employees.Employee", on_delete=models.PROTECT, related_name="otp_challenges"
    )
    code_hash = models.CharField(max_length=64)
    attempts = models.PositiveSmallIntegerField(default=0)
    is_used = models.BooleanField(default=False)
    expires_at = models.DateTimeField()

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["employee", "created_at"])]

    def is_expired(self) -> bool:
        from django.utils import timezone

        return timezone.now() >= self.expires_at
