from django.contrib.auth.models import AbstractUser
from django.db import models


class Roles(models.TextChoices):
    """System roles (SRS §3.1)."""

    ADMIN = "admin", "Administrator"
    SPECIALIST = "specialist", "Specialist"
    MEDIC = "medic", "Medical staff"


class User(AbstractUser):
    role = models.CharField(max_length=20, choices=Roles.choices, default=Roles.SPECIALIST)

    def __str__(self):
        return f"{self.username} ({self.role})"
