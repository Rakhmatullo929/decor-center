from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel


class Specialty(TimeStampedModel):
    """Employee specialty (SRS §4.2) — extendable by the administrator."""

    name = models.CharField(max_length=255, unique=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "specialties"

    def __str__(self):
        return self.name


class Employee(TimeStampedModel):
    """Decort employee (SRS §4.1)."""

    full_name = models.CharField(max_length=255, db_index=True)
    specialty = models.ForeignKey(Specialty, on_delete=models.PROTECT, related_name="employees")
    photo = models.ImageField(upload_to="employees/photos/")
    # Face embedding generated from the reference photo (SRS §4.3); internal only.
    face_embedding = models.JSONField(null=True, blank=True, editable=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["full_name"]

    def __str__(self):
        return self.full_name


class EmployeeFacePhoto(TimeStampedModel):
    """One reference face sample for an employee (SRS §4.3, multi-photo enrollment).

    Employee.face_embedding is the mean of all samples' embeddings (the active template).
    The embedding is internal — never serialized to the API.
    """

    employee = models.ForeignKey(
        Employee, related_name="face_photos", on_delete=models.CASCADE
    )
    photo = models.ImageField(upload_to="employees/face_photos/")
    embedding = models.JSONField(editable=False)
    model_version = models.CharField(max_length=64, blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"FacePhoto<employee={self.employee_id}>"
