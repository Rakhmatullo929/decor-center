"""Admin dashboard statistics (SRS §9 — daily tests and medical examinations)."""
import datetime

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdmin
from apps.assessments.models import Question, TestSession
from apps.employees.models import Employee
from apps.instructions.models import Instruction
from apps.medical.models import MedicalCheck


def _parse_date(raw: str | None) -> datetime.date:
    if not raw:
        return timezone.localdate()
    try:
        return datetime.date.fromisoformat(raw)
    except ValueError:
        return timezone.localdate()


class DashboardStatsView(APIView):
    """Daily counters for the admin dashboard. `?date=YYYY-MM-DD` defaults to today."""

    permission_classes = [IsAdmin]

    def get(self, request):
        date = _parse_date(request.query_params.get("date"))

        sessions = TestSession.objects.filter(started_at__date=date)
        # Aliases must not shadow the `passed` model field used inside filter=Q(...).
        aggregated = sessions.aggregate(
            total=Count("id"),
            passed_count=Count("id", filter=Q(passed=True)),
            failed_count=Count("id", filter=Q(passed=False)),
            in_progress_count=Count("id", filter=Q(passed__isnull=True)),
        )
        tests = {
            "total": aggregated["total"],
            "passed": aggregated["passed_count"],
            "failed": aggregated["failed_count"],
            "in_progress": aggregated["in_progress_count"],
        }
        by_module = [
            {
                "module": module_row["module"],
                "total": module_row["total"],
                "passed": module_row["passed_count"],
            }
            for module_row in sessions.values("module")
            .annotate(total=Count("id"), passed_count=Count("id", filter=Q(passed=True)))
            .order_by("module")
        ]

        checks = MedicalCheck.objects.filter(created_at__date=date)
        medical = checks.aggregate(
            total=Count("id"),
            approved=Count("id", filter=Q(conclusion=MedicalCheck.Conclusion.APPROVED)),
            rejected=Count("id", filter=Q(conclusion=MedicalCheck.Conclusion.REJECTED)),
        )

        totals = {
            "active_employees": Employee.objects.filter(is_active=True).count(),
            "approved_questions": Question.objects.filter(
                status=Question.Status.APPROVED
            ).count(),
            "draft_questions": Question.objects.filter(status=Question.Status.DRAFT).count(),
            "instructions": Instruction.objects.count(),
        }

        return Response(
            {
                "date": date.isoformat(),
                "tests": {**tests, "by_module": by_module},
                "medical": medical,
                "totals": totals,
            }
        )
