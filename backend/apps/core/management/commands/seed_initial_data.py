"""Seed initial data: 6 specialties (SRS §4.2) and the three role accounts (SRS §3.1).

Idempotent: existing records are left untouched.
Passwords come from DECOR_*_PASSWORD env vars (see .env.example).
"""
import os

from django.core.management.base import BaseCommand

from apps.accounts.models import Roles, User
from apps.employees.models import Specialty

SPECIALTIES = [
    "tokarlik mutaxassisi",
    "harakatlanuvchi tarkibni ta'mirlash chilangari",
    "bino (hudud) qorovuli",
    "hudud farroshi (ishlab chiqarish, xizmat)",
    "elektrovoz mashinisti",
    "lokomotiv (poyezd) brigadalari naryadchisi",
    "mashinist yordamchisi dublyori",
    "elektrovoz mashinisti yordamchisi",
    "teplovoz mashinisti yordamchisi",
    "texnik hujjatlarni yuritish texnigi",
    "brigadiri",
    "kran mashinisti (kranchi)",
    "traktorchisi",
    "avtomobil haydovchisi (yengil)",
    "3-darajali taʼmirlovchi-chilangari",
    "elektrogazpayvandchisi",
    "elektr jihozlarni taʼmirlash chilangar-elektrigi",
    "qozonxona mashinisti",
    "qozonxonaga xizmat ko'rsatish chilangari",
    "avtomobil haydovchisi (yuk tashuvchi)",
    "teplovoz mashinisti",
    "xom-ashyo materiallari buxgalteri",
    "asosiy vositalar buxgalteri",
    "yetakchi muhandisi",
    "mehnat muhofazasi va texnika xavfsizligi muhandisi",
    "mehnatni tashkil etish va me'yorlash muhandisi",
    "bo'lim boshlig'i",
    "energetika muhandisi",
    "psixologi",
    "texnologiya muhandisi",
    "kadrlar bo'yicha muhandisi",
    "kadrlar bo'yicha katta inspektori",
    "kadrlar bo'yicha inspektori",
    "hisob-kitob bank operatsiyalari bo'yicha buxgalteri",
    "texnik hujjatlarni yuritish yetakchi muhandisi",
    "metrologiya muhandisi",
    "laboratoriya mudiri",
    "yoqilg'i-moylash materiallari muhandisi",
    "decor navbatchisi",
    "1-toifali iqtisodchisi",
    "ishlab chiqarish laboronti",
    "eltish hujjatlariga ishlov berish operatori",
    "lokomotiv brigadasi yo'riqchi mashinisti",
    "ishlab chiqarish ustasi",
    "kir yuvuvchisi",
    "omborchisi",
    "dam olish xonasi navbatchisi",
    "marshrut varaqalarini hisoblash muhandisi",
    "katta ustasi",
    "bolg'a va press temirchisi",
    "ishlab chiqarish taʼlimi yo'riqchisi",
    "chilangarlik va dastgox ishlari nazoratchisi",
    "filial boshlig'i",
    "ekspluatatsiya ishlari bo'yicha texnologiya muhandisi",
    "moddiy-texnik taʼminot muhandisi",
    "nuqson aniqlash chilangari",
    "harakatlanuvchi tarkibni ta'mirlash ustasi",
    "operatori",
    "buxgalteri",
    "filial boshlig'i o'rinbosari",
    "avtobus haydovchisi",
    "lokomotiv (poyezd) brigadasi dam olish uyi mudiri",
    "ishlab chiqarish hammomlari ishchisi",
    "bosh buxgalteri",
    "bosh mexanigi",
    "bosh muhandisi",
    "axborot xavfsizligi bo'yicha muhandisi",
]

ACCOUNTS = [
    # (username, role, is_staff, is_superuser, password_env, default_password)
    ("admin", Roles.ADMIN, True, True, "DECOR_ADMIN_PASSWORD", "admin12345!"),
    ("medic", Roles.MEDIC, False, False, "DECOR_MEDIC_PASSWORD", "medic12345!"),
    ("specialist", Roles.SPECIALIST, False, False, "DECOR_SPECIALIST_PASSWORD", "specialist12345!"),
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
