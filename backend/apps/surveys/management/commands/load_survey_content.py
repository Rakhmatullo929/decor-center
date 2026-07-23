"""Load the curated survey content fixture (fixtures/surveys_content.json).

The fixture holds the survey *definitions* only — Test + QuestionBlock + Question for
the standard surveys and the demo survey, exactly as they stand in the reference
(local) database. It carries no employees, accounts or survey responses.

Idempotent by design: the fixture is loaded ONLY when the database holds no surveys
yet, so running this on every deploy never re-imports over — and never clobbers —
survey content edited later in the admin. Once prod holds any survey, this is a no-op.
"""
from pathlib import Path

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand

from apps.surveys.models import Test

FIXTURE = Path(settings.BASE_DIR) / "fixtures" / "surveys_content.json"


class Command(BaseCommand):
    help = "Load survey content fixture if the database holds no surveys yet (idempotent)."

    def handle(self, *args, **options):
        existing = Test.objects.count()
        if existing:
            self.stdout.write(
                self.style.WARNING(
                    f"Surveys already present ({existing}); skipping fixture load "
                    "to preserve admin edits."
                )
            )
            return

        if not FIXTURE.exists():
            self.stdout.write(self.style.ERROR(f"Fixture not found: {FIXTURE}"))
            return

        call_command("loaddata", str(FIXTURE), verbosity=options["verbosity"])
        self.stdout.write(
            self.style.SUCCESS(f"Survey content loaded: {Test.objects.count()} surveys.")
        )
