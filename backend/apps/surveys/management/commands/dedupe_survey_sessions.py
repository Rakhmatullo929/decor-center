"""One-time cleanup for duplicate incomplete SurveySession rows left over from before
`start_survey_session` became idempotent — for each (employee, test), keeps only the
most recently started incomplete session and deletes the rest. Completed sessions are
never touched. Safe to run repeatedly (no-op once there's at most one incomplete
session per employee/test)."""
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Count

from apps.surveys.models import SurveySession


class Command(BaseCommand):
    help = __doc__

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report what would be deleted without deleting anything.",
        )

    def handle(self, *args, dry_run: bool = False, **options):
        duplicate_groups = (
            SurveySession.objects.filter(completed_at__isnull=True)
            .values("employee_id", "test_id")
            .annotate(count=Count("id"))
            .filter(count__gt=1)
        )

        total_deleted = 0
        for group in duplicate_groups:
            sessions = list(
                SurveySession.objects.filter(
                    employee_id=group["employee_id"],
                    test_id=group["test_id"],
                    completed_at__isnull=True,
                ).order_by("-started_at")
            )
            keep, drop = sessions[0], sessions[1:]
            self.stdout.write(
                f"employee={group['employee_id']} test={group['test_id']}: "
                f"keeping session {keep.id} ({keep.started_at}), "
                f"dropping {len(drop)} older duplicate(s): {[s.id for s in drop]}"
            )
            total_deleted += len(drop)
            if not dry_run:
                with transaction.atomic():
                    SurveySession.objects.filter(id__in=[s.id for s in drop]).delete()

        if total_deleted == 0:
            self.stdout.write(self.style.SUCCESS("No duplicate in-progress sessions found."))
        elif dry_run:
            self.stdout.write(
                self.style.WARNING(f"Dry run: would delete {total_deleted} duplicate session(s).")
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(f"Deleted {total_deleted} duplicate session(s).")
            )
