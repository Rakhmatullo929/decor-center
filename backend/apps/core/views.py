"""Admin dashboard statistics — survey counters."""
import datetime

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdmin
from apps.employees.models import Employee
from apps.surveys.models import SurveySession, Test


def _parse_date(raw: str | None) -> datetime.date:
    if not raw:
        return timezone.localdate()
    try:
        return datetime.date.fromisoformat(raw)
    except ValueError:
        return timezone.localdate()


class DashboardStatsView(APIView):
    """Daily survey counters. `?date=YYYY-MM-DD` defaults to today."""

    permission_classes = [IsAdmin]

    def get(self, request):
        date = _parse_date(request.query_params.get("date"))

        sessions = SurveySession.objects.filter(started_at__date=date)
        aggregated = sessions.aggregate(
            total=Count("id"),
            completed=Count("id", filter=Q(completed_at__isnull=False)),
            in_progress=Count("id", filter=Q(completed_at__isnull=True)),
        )
        totals = {
            "active_employees": Employee.objects.filter(is_active=True).count(),
            "active_tests": Test.objects.filter(is_active=True).count(),
            "admin_conducted_tests": Test.objects.filter(
                is_active=True, is_admin_conducted=True
            ).count(),
        }
        return Response(
            {
                "date": date.isoformat(),
                "sessions": {
                    "total": aggregated["total"],
                    "completed": aggregated["completed"],
                    "in_progress": aggregated["in_progress"],
                },
                "totals": totals,
            }
        )
