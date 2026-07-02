from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from apps.core.models import TimeStampedModel
from apps.employees.models import Employee


class MedicalCheck(TimeStampedModel):
    """Daily medical examination record (SRS §7.1).

    Date/time is recorded automatically (created_at). The medic who entered
    the record is recorded automatically (SRS §7.2). Editing after save is
    prohibited for medics; admin-only edits are audited (SRS §7.3).
    """

    class Conclusion(models.TextChoices):
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    employee = models.ForeignKey(Employee, on_delete=models.PROTECT, related_name="medical_checks")
    bp_systolic = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(40), MaxValueValidator(300)]
    )
    bp_diastolic = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(20), MaxValueValidator(200)]
    )
    pulse = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(20), MaxValueValidator(250)]
    )
    saturation = models.PositiveSmallIntegerField(
        "Oxygen saturation, %", validators=[MinValueValidator(50), MaxValueValidator(100)]
    )
    # SRS §15.5 agreed default: numeric value + positive/negative flag.
    alcohol_value = models.DecimalField(
        max_digits=5, decimal_places=3, null=True, blank=True,
        validators=[MinValueValidator(0)],
    )
    alcohol_positive = models.BooleanField(default=False)
    hours_worked = models.DecimalField(
        max_digits=4, decimal_places=1,
        validators=[MinValueValidator(0), MaxValueValidator(24)],
    )
    hours_rested = models.DecimalField(
        max_digits=5, decimal_places=1,
        validators=[MinValueValidator(0), MaxValueValidator(168)],
    )
    conclusion = models.CharField(max_length=10, choices=Conclusion.choices)
    note = models.TextField(blank=True)
    medic = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="medical_checks_entered"
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.employee} — {self.conclusion} ({self.created_at:%Y-%m-%d %H:%M})"


class MedicalCheckAudit(models.Model):
    """Append-only change history for medical checks (SRS §7.3)."""

    class Action(models.TextChoices):
        CREATED = "created", "Created"
        UPDATED = "updated", "Updated"

    medical_check = models.ForeignKey(
        MedicalCheck, on_delete=models.PROTECT, related_name="audits"
    )
    action = models.CharField(max_length=10, choices=Action.choices)
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+"
    )
    snapshot = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
