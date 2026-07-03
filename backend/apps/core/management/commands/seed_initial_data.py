"""Seed initial data: specialties and the two role accounts (admin + employee/kiosk).

Idempotent: existing records are left untouched.
Passwords come from DECOR_*_PASSWORD env vars (see .env.example).
"""
import os

from django.core.management.base import BaseCommand

from apps.accounts.models import Roles, User
from apps.employees.models import Specialty

# Decor-center specialties (interior decoration / furnishing salon).
SPECIALTIES = [
    "Дизайнер интерьера",
    "Декоратор",
    "Флорист",
    "Менеджер салона",
    "Менеджер по продажам",
    "Столяр-краснодеревщик",
    "Обойщик мебели",
    "Швея по текстилю и шторам",
    "Монтажник декора",
    "Кладовщик",
    "Администратор",
    "Бухгалтер",
    "Маркетолог",
    "Закупщик",
]

ACCOUNTS = [
    # (username, role, is_staff, is_superuser, password_env, default_password)
    ("admin", Roles.ADMIN, True, True, "DECOR_ADMIN_PASSWORD", "admin12345!"),
    ("employee", Roles.EMPLOYEE, False, False, "DECOR_EMPLOYEE_PASSWORD", "employee12345!"),
]


class Command(BaseCommand):
    help = "Seed specialties and role accounts (idempotent)."

    def handle(self, *args, **options):
        for name in SPECIALTIES:
            _, created = Specialty.objects.get_or_create(name=name)
            if created:
                self.stdout.write(f"Specialty created: {name}")

        for username, role, is_staff, is_superuser, env_var, default in ACCOUNTS:
            if User.objects.filter(username=username).exists():
                continue
            password = os.environ.get(env_var, default)
            user = User(username=username, role=role, is_staff=is_staff, is_superuser=is_superuser)
            user.set_password(password)
            user.save()
            self.stdout.write(
                self.style.WARNING(
                    f"User created: {username} (role={role}). "
                    f"Password from ${env_var} or default — change it in production!"
                )
            )

        self.stdout.write(self.style.SUCCESS("Seed completed."))
