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
    """Decor-center employee."""

    full_name = models.CharField(max_length=255, db_index=True)
    specialty = models.ForeignKey(Specialty, on_delete=models.PROTECT, related_name="employees")
    photo = models.ImageField(upload_to="employees/photos/")
    # "Работает с" — hire date; drives survey scheduling (Plan 2).
    hire_date = models.DateField("Работает с", null=True, blank=True)
    # "Стаж" — manually entered total work experience in years (decoupled from hire_date).
    work_experience = models.PositiveIntegerField("Стаж", null=True, blank=True)
    # Face embedding generated from the reference photo (SRS §4.3); internal only.
    face_embedding = models.JSONField(null=True, blank=True, editable=False)
    is_active = models.BooleanField(default=True)
    # Employee phone for kiosk SMS OTP (E.164, e.g. +998901234567). Nullable for
    # already-imported employees; required by the admin form via the serializer.
    phone = models.CharField(max_length=20, blank=True, default="")
    # Login account provisioned on first successful kiosk OTP verify (see
    # apps.employees.services.get_or_create_employee_user). Lets /scan hand the
    # employee a real JWT session instead of the old opaque kiosk token, so /auth/me
    # (and a future employee cabinet) resolve to this Employee.
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        editable=False,
        on_delete=models.SET_NULL,
        related_name="employee_profile",
    )

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
