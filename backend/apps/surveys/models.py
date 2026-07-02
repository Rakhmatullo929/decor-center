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
        SINGLE = "single", "По одному (radio)"
        MULTIPLE = "multiple", "Несколько (checkbox)"
        TEXTAREA = "textarea", "Свободный текст"

    block = models.ForeignKey(
        QuestionBlock, on_delete=models.CASCADE, related_name="questions"
    )
    type = models.CharField(max_length=16, choices=Type.choices, default=Type.SINGLE)
    order = models.PositiveIntegerField(default=0)
    text = models.TextField()
    # Stable option IDs so analytics survive reordering: [{"id": "<uuid>", "text": "..."}].
    options = models.JSONField(default=list, blank=True)  # [] for textarea

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
