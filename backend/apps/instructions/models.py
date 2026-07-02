from django.core.validators import FileExtensionValidator
from django.db import models

from apps.core.models import TimeStampedModel
from apps.employees.models import Specialty


class Instruction(TimeStampedModel):
    """Official depot instruction used for AI test generation (SRS §5.1.1)."""

    class GenerationStatus(models.TextChoices):
        NOT_STARTED = "not_started", "Not started"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    specialty = models.ForeignKey(Specialty, on_delete=models.PROTECT, related_name="instructions")
    title = models.CharField(max_length=255)
    file = models.FileField(
        upload_to="instructions/",
        validators=[FileExtensionValidator(["pdf", "docx", "txt", "md"])],
    )
    generation_status = models.CharField(
        max_length=20, choices=GenerationStatus.choices, default=GenerationStatus.NOT_STARTED
    )
    last_generated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title
