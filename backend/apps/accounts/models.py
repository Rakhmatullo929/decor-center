from django.contrib.auth.models import AbstractUser
from django.db import models


class Roles(models.TextChoices):
    """System roles: admin console + specialist (kiosk device account, shown as "Сотрудник")."""

    ADMIN = "admin", "Administrator"
    SPECIALIST = "specialist", "Сотрудник"


class User(AbstractUser):
    role = models.CharField(max_length=20, choices=Roles.choices, default=Roles.SPECIALIST)

    def __str__(self):
        return f"{self.username} ({self.role})"
