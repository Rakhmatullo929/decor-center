"""Admin dashboard statistics — survey counters are added in Plan 2 (surveys app)."""
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdmin
from apps.employees.models import Employee, Specialty


class DashboardStatsView(APIView):
    """Minimal totals for the admin dashboard. Extended with survey counters in Plan 2."""

    permission_classes = [IsAdmin]

    def get(self, request):
        return Response(
            {
                "totals": {
                    "active_employees": Employee.objects.filter(is_active=True).count(),
                    "specialties": Specialty.objects.count(),
                }
            }
        )
