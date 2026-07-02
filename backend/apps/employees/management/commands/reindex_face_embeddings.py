"""Regenerate face embeddings for all employees using the active backend.

Run this whenever you switch DECOR_FACE_BACKEND (e.g. from mock to InsightFace),
because the embedding dimensions and format change between backends.

Usage:
    python manage.py reindex_face_embeddings            # all active employees
    python manage.py reindex_face_embeddings --all      # including inactive
    python manage.py reindex_face_embeddings --id 3 7   # specific employee IDs
    python manage.py reindex_face_embeddings --dry-run  # preview, no DB writes
"""
import sys

from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.employees.face_enrollment import backend_model_version, recompute_centroid
from apps.employees.models import Employee
from apps.integrations.base import NoFaceDetectedError
from apps.integrations.registry import get_face_recognition_service


class Command(BaseCommand):
    help = "Regenerate face_embedding for all employees using the active face-recognition backend."

    def add_arguments(self, parser):
        parser.add_argument(
            "--all",
            action="store_true",
            dest="include_inactive",
            help="Include inactive employees (default: active only).",
        )
        parser.add_argument(
            "--id",
            nargs="+",
            type=int,
            dest="ids",
            metavar="EMPLOYEE_ID",
            help="Reindex specific employee IDs only.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Extract embeddings but do not save to the database.",
        )

    def handle(self, *args, **options):
        service = get_face_recognition_service()
        backend_name = type(service).__name__
        self.stdout.write(f"Backend: {backend_name}")

        qs = Employee.objects.all()
        if options["ids"]:
            qs = qs.filter(id__in=options["ids"])
        elif not options["include_inactive"]:
            qs = qs.filter(is_active=True)

        employees = list(qs.only("id", "full_name", "photo", "face_embedding"))
        total = len(employees)
        self.stdout.write(f"Employees to process: {total}\n")

        ok = 0
        skipped = 0
        failed = 0

        for emp in employees:
            label = f"[{emp.id}] {emp.full_name}"
            samples = list(emp.face_photos.all())

            if samples:
                # All-or-nothing per employee: compute every sample's new embedding first,
                # then persist them and recompute the centroid in a single transaction. A
                # failure on any sample leaves the employee entirely untouched (no half-
                # updated samples, no stale centroid).
                new_embeddings = []
                sample_failed = False
                for sample in samples:
                    try:
                        with default_storage.open(sample.photo.name, "rb") as fh:
                            image_bytes = fh.read()
                        embedding = service.extract_embedding(image_bytes)
                    except NoFaceDetectedError as exc:
                        self.stdout.write(self.style.ERROR(f"  ERROR {label} sample {sample.id} — {exc}"))
                        sample_failed = True
                        break
                    except Exception as exc:
                        self.stdout.write(self.style.ERROR(f"  ERROR {label} sample {sample.id} — {exc}"))
                        sample_failed = True
                        break
                    new_embeddings.append((sample, embedding))
                if sample_failed:
                    failed += 1
                    continue
                if not options["dry_run"]:
                    version = backend_model_version(service)
                    with transaction.atomic():
                        for sample, embedding in new_embeddings:
                            sample.embedding = embedding
                            sample.model_version = version
                            sample.save(update_fields=["embedding", "model_version"])
                        recompute_centroid(emp)
                self.stdout.write(self.style.SUCCESS(f"  OK    {label} — {len(samples)} sample(s) re-embedded"))
                ok += 1
                continue

            # No samples: legacy single-photo fallback (original behavior).
            if not emp.photo:
                self.stdout.write(self.style.WARNING(f"  SKIP  {label} — no photo, no samples"))
                skipped += 1
                continue
            try:
                with default_storage.open(emp.photo.name, "rb") as fh:
                    image_bytes = fh.read()
                embedding = service.extract_embedding(image_bytes)
            except NoFaceDetectedError as exc:
                self.stdout.write(self.style.ERROR(f"  ERROR {label} — {exc}"))
                failed += 1
                continue
            except Exception as exc:
                self.stdout.write(self.style.ERROR(f"  ERROR {label} — unexpected: {exc}"))
                failed += 1
                continue
            if options["dry_run"]:
                self.stdout.write(f"  DRY   {label} — embedding dim={len(embedding)} ✓")
            else:
                emp.face_embedding = embedding
                emp.save(update_fields=["face_embedding"])
                self.stdout.write(self.style.SUCCESS(f"  OK    {label} — dim={len(embedding)} ✓"))
            ok += 1

        self.stdout.write("")
        self.stdout.write(f"Done: {ok} updated, {skipped} skipped, {failed} failed.")
        if failed:
            sys.exit(1)
