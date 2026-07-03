"""Seed employee specialties from fixtures/specialties.txt.

Idempotent: names are matched by Specialty.name (unique), so re-running only
creates the rows that are missing. One specialty per non-blank line; lines are
stripped of surrounding whitespace. Override the source file with --file.
"""
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.employees.models import Specialty

DEFAULT_FILE = Path(settings.BASE_DIR) / "fixtures" / "specialties.txt"


class Command(BaseCommand):
    help = "Create employee specialties from a newline-delimited file (idempotent)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--file",
            default=str(DEFAULT_FILE),
            help="Path to a UTF-8 file with one specialty name per line.",
        )

    def handle(self, *args, **options):
        path = Path(options["file"])
        if not path.exists():
            raise CommandError(f"Specialty source file not found: {path}")

        names = []
        seen = set()
        for raw in path.read_text(encoding="utf-8").splitlines():
            name = raw.strip()
            if not name or name in seen:
                continue
            seen.add(name)
            names.append(name)

        created = 0
        with transaction.atomic():
            for name in names:
                _, was_created = Specialty.objects.get_or_create(name=name)
                if was_created:
                    created += 1
                    self.stdout.write(f"Specialty created: {name}")

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. {len(names)} names in file; {created} created, "
                f"{len(names) - created} already existed."
            )
        )
