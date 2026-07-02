"""Import employees (SRS §4.1) from a JSON roster, linking each to a Specialty.

Each record is ``{"name": <full name>, "speciality": <specialty name>}``. The
specialty string is matched to an existing ``Specialty`` by a normalized key:
apostrophe variants (``' ' ' ʼ ʻ `` etc.) collapse to one, whitespace collapses,
and case is folded — so Latin-Uzbek apostrophe differences ("bo'yicha" vs
"bo'yicha") still resolve to the same specialty. Run ``seed_specialties`` first so
the specialties exist; the command fails fast (no rows written) if any specialty
is missing.

Idempotent: employees are matched by ``full_name`` and existing rows are skipped,
so re-running only adds what's missing. Employees are created without a photo
(``photo=""``) — face templates are enrolled later via the enrollment flow.
Override the source file with ``--file``.
"""
import json
import re
import unicodedata
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.employees.models import Employee, Specialty

DEFAULT_FILE = Path(settings.BASE_DIR) / "fixtures" / "employees_import.json"

# Apostrophe-like glyphs seen in Latin-Uzbek text; all collapse to one key char.
_APOSTROPHES = "'‘’ʼʻ`´ʹ"
_APOS_RE = re.compile(f"[{re.escape(_APOSTROPHES)}]")
_WHITESPACE_RE = re.compile(r"\s+")


def normalize_specialty(name: str) -> str:
    """Canonical key for matching specialty names across apostrophe/space/case variants."""
    name = unicodedata.normalize("NFC", name)
    name = _APOS_RE.sub("'", name)
    name = _WHITESPACE_RE.sub(" ", name).strip()
    return name.casefold()


class Command(BaseCommand):
    help = (
        "Import employees from a JSON roster of {name, speciality} objects, linking each "
        "to an existing Specialty by normalized name. Idempotent on full_name. "
        "Run seed_specialties first."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--file",
            default=str(DEFAULT_FILE),
            help="Path to a UTF-8 JSON file of {name, speciality} objects.",
        )

    def handle(self, *args, **options):
        path = Path(options["file"])
        if not path.exists():
            raise CommandError(f"Employee source file not found: {path}")

        try:
            records = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise CommandError(f"Invalid JSON in {path}: {exc}") from exc
        if not isinstance(records, list):
            raise CommandError("Expected the JSON root to be a list of {name, speciality} objects.")

        # Index existing specialties by their normalized name (the "find by id" lookup).
        specialty_by_key = {
            normalize_specialty(s.name): s for s in Specialty.objects.all()
        }

        # Resolve every record up front; fail fast if any specialty is unknown so we
        # never write a partial roster.
        resolved = []  # list[(full_name, Specialty)]
        unmatched = {}  # raw specialty name -> count
        for index, record in enumerate(records):
            full_name = (record.get("name") or "").strip()
            raw_specialty = (record.get("speciality") or "").strip()
            if not full_name or not raw_specialty:
                raise CommandError(
                    f"Record {index} is missing 'name' or 'speciality': {record!r}"
                )
            specialty = specialty_by_key.get(normalize_specialty(raw_specialty))
            if specialty is None:
                unmatched[raw_specialty] = unmatched.get(raw_specialty, 0) + 1
                continue
            resolved.append((full_name, specialty))

        if unmatched:
            listing = "\n".join(
                f"  {count}× {name}" for name, count in sorted(unmatched.items())
            )
            raise CommandError(
                "These specialties are not in the database — run `seed_specialties` "
                f"first:\n{listing}"
            )

        existing = set(Employee.objects.values_list("full_name", flat=True))
        created = 0
        skipped = 0
        with transaction.atomic():
            for full_name, specialty in resolved:
                if full_name in existing:
                    skipped += 1
                    continue
                Employee.objects.create(full_name=full_name, specialty=specialty, photo="")
                existing.add(full_name)  # guard against duplicates within the file
                created += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. {len(records)} records in file; {created} created, "
                f"{skipped} already existed."
            )
        )
