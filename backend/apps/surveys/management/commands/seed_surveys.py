"""Seed the standard survey presets (spec §4.3). Idempotent by Test.title."""
from django.core.management.base import BaseCommand

from apps.surveys.models import Test

PRESETS = [
    {
        "title": "Через 30 дней после найма",
        "is_after_application": True,
        "after_days": 30,
        "is_admin_conducted": False,
    },
    {
        "title": "Через 90 дней после найма",
        "is_after_application": True,
        "after_days": 90,
        "is_admin_conducted": False,
    },
    {
        "title": "1в1 ежемесячно (беседа)",
        "is_after_application": False,
        "month": [],
        "is_admin_conducted": True,
    },
    {
        "title": "Краткий пульс",
        "is_after_application": False,
        "month": [1, 4, 7, 10],
        "test_days_from": 1,
        "test_days_to": 7,
        "is_admin_conducted": False,
    },
    {
        "title": "Глубокий опрос",
        "is_after_application": False,
        "month": [1, 7],
        "test_days_from": 1,
        "test_days_to": 14,
        "is_admin_conducted": False,
    },
]


class Command(BaseCommand):
    help = "Create the standard survey presets (idempotent by title)."

    def handle(self, *args, **options):
        created = 0
        for preset in PRESETS:
            _obj, was_created = Test.objects.get_or_create(
                title=preset["title"], defaults=preset
            )
            created += int(was_created)
        self.stdout.write(
            self.style.SUCCESS(f"seed_surveys: {created} created, {len(PRESETS) - created} existed.")
        )
