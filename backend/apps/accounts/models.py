from django.contrib.auth.models import AbstractUser
from django.db import models


class Roles(models.TextChoices):
    """System roles: admin console + employee (kiosk device account, shown as "Сотрудник")."""

    ADMIN = "admin", "Administrator"
    EMPLOYEE = "employee", "Сотрудник"


class User(AbstractUser):
    role = models.CharField(max_length=20, choices=Roles.choices, default=Roles.EMPLOYEE)

    def __str__(self):
        return f"{self.username} ({self.role})"
