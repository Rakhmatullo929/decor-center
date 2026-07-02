from django.conf import settings as django_settings
from django.db import models
from django.utils import timezone

from apps.core.models import TimeStampedModel
from apps.employees.models import Employee, Specialty


class Module(models.TextChoices):
    """Assessment modules. Module 2 areas are separate values (SRS §6.1)."""

    SPECIALTY = "specialty", "Professional knowledge"
    TECH_SAFETY = "tech_safety", "Technical safety"
    INDUSTRIAL_SAFETY = "industrial_safety", "Industrial safety"


class Question(TimeStampedModel):
    """Test bank question (SRS §5.1, §6.2)."""

    class Source(models.TextChoices):
        AI = "ai", "AI generated"
        MANUAL = "manual", "Manual"

    class Status(models.TextChoices):
        DRAFT = "draft", "Not approved"
        APPROVED = "approved", "Approved"

    module = models.CharField(max_length=20, choices=Module.choices)
    # Required when module == SPECIALTY, must be empty for safety modules.
    specialty = models.ForeignKey(
        Specialty, null=True, blank=True, on_delete=models.PROTECT, related_name="questions"
    )
    text = models.TextField()
    options = models.JSONField(help_text="List of exactly 4 answer options.")
    correct_option = models.PositiveSmallIntegerField(help_text="Index 0-3 of the correct option.")
    source = models.CharField(max_length=10, choices=Source.choices, default=Source.MANUAL)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DRAFT)
    audio = models.FileField(upload_to="question_audio/", null=True, blank=True)
    audio_status = models.CharField(max_length=20, choices=[("not_run", "Not Run"), ("processing", "Processing"), ("ready", "Ready"), ("error", "Error")], default="not_run") # "processing", "ready", "error"; managed by background task, not user-editable
    audio_text_hash = models.CharField(max_length=64, blank=True, default="")

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(correct_option__lte=3),
                name="question_correct_option_range",
            ),
        ]

    def __str__(self):
        return f"[{self.module}] {self.text[:60]}"


class TestSession(TimeStampedModel):
    """One test attempt (SRS §5.2-5.3, §6.3-6.5)."""

    __test__ = False  # not a pytest test class despite the name

    employee = models.ForeignKey(Employee, on_delete=models.PROTECT, related_name="test_sessions")
    module = models.CharField(max_length=20, choices=Module.choices)
    # Snapshot of the employee's specialty for Module 1; null for safety modules.
    specialty = models.ForeignKey(
        Specialty, null=True, blank=True, on_delete=models.PROTECT, related_name="test_sessions"
    )
    started_at = models.DateTimeField(default=timezone.now)
    finished_at = models.DateTimeField(null=True, blank=True)
    score = models.PositiveSmallIntegerField(null=True, blank=True)
    total = models.PositiveSmallIntegerField()
    passed = models.BooleanField(null=True, blank=True)
    face_verified = models.BooleanField(default=False)
    # Immutable face template frozen at start; submit re-verification compares against this
    # (not the live employee centroid) so a mid-exam re-enrollment cannot shift the basis.
    face_embedding_snapshot = models.JSONField(null=True, blank=True, editable=False)
    face_embedding_model_version = models.CharField(max_length=64, blank=True, default="")
    # Submit-time face check: None = not checked, True = matched, False = mismatch (log mode).
    submit_face_verified = models.BooleanField(null=True, blank=True)

    class Meta:
        ordering = ["-started_at"]

    def save(self, *args, **kwargs):
        # Write-once: once a snapshot is set it can never change. Skip the check when the
        # snapshot field isn't part of this save (e.g. the scoring save) to avoid a query.
        update_fields = kwargs.get("update_fields")
        snapshot_touched = update_fields is None or "face_embedding_snapshot" in update_fields
        if self.pk is not None and self.face_embedding_snapshot is not None and snapshot_touched:
            old = (
                type(self)
                .objects.filter(pk=self.pk)
                .values_list("face_embedding_snapshot", flat=True)
                .first()
            )
            if old is not None and old != self.face_embedding_snapshot:
                raise ValueError("face_embedding_snapshot is immutable once set.")
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.employee} — {self.module} ({self.started_at:%Y-%m-%d %H:%M})"


class TestAnswer(models.Model):
    """Per-question record; created empty at session start to freeze the presented set."""

    session = models.ForeignKey(TestSession, on_delete=models.CASCADE, related_name="answers")
    question = models.ForeignKey(Question, on_delete=models.PROTECT, related_name="answers")
    selected_option = models.PositiveSmallIntegerField(null=True, blank=True)
    is_correct = models.BooleanField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["session", "question"], name="unique_session_question"),
        ]


class FaceVerificationLog(models.Model):
    """Every Face ID attempt is logged, successful or not (SRS §5.2.4, §11.2)."""

    class Stage(models.TextChoices):
        START = "start", "Test start"
        SUBMIT = "submit", "Test submit"

    employee = models.ForeignKey(
        Employee, on_delete=models.PROTECT, related_name="face_verification_logs"
    )
    session = models.ForeignKey(
        "TestSession",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="face_verification_logs",
    )
    stage = models.CharField(max_length=10, choices=Stage.choices, default=Stage.START)
    success = models.BooleanField()
    similarity_score = models.FloatField(null=True, blank=True)
    reason = models.CharField(max_length=20, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


def pass_threshold() -> int:
    return django_settings.DEPO["PASS_THRESHOLD"]


def questions_per_test() -> int:
    return django_settings.DEPO["QUESTIONS_PER_TEST"]
