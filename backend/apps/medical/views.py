from django.db import transaction
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, viewsets
from rest_framework.decorators import action

from apps.accounts.permissions import IsAdmin, IsAdminOrMedic, IsMedic
from apps.core.excel import xlsx_response

from .filters import MedicalCheckFilter
from .models import MedicalCheck
from .serializers import MedicalCheckSerializer
from .services import record_created, record_updated, snapshot_medical_check


class MedicalCheckViewSet(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    """Medical examination records (SRS §7).

    - create/list/retrieve: medic and admin;
    - update: admin only — a saved conclusion cannot be edited by the medic (SRS §7.3);
    - delete: not exposed (records are permanent).
    Every create/update is written to the append-only audit table.
    """

    queryset = MedicalCheck.objects.select_related("employee", "medic")
    serializer_class = MedicalCheckSerializer
    filterset_class = MedicalCheckFilter
    ordering_fields = ["created_at"]

    def get_permissions(self):
        if self.action == "create":
            return [IsMedic()]
        if self.action in ("update", "partial_update"):
            return [IsAdmin()]
        return [IsAdminOrMedic()]

    def perform_create(self, serializer):
        # Record + audit atomically: a check must never exist without its audit row (SRS §7.3).
        with transaction.atomic():
            check = serializer.save(medic=self.request.user)
            record_created(check, self.request.user)

    def perform_update(self, serializer):
        old = snapshot_medical_check(serializer.instance)
        with transaction.atomic():
            check = serializer.save()
            record_updated(check, self.request.user, old)

    @extend_schema(responses={(200, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"): bytes})
    @action(detail=False, methods=["get"])
    def export(self, request):
        """Download the filtered examination journal as XLSX (SRS §8.1.6)."""
        checks = self.filter_queryset(self.get_queryset())
        rows = (
            [
                timezone.localtime(check.created_at).strftime("%Y-%m-%d %H:%M"),
                check.employee.full_name,
                f"{check.bp_systolic}/{check.bp_diastolic}",
                check.pulse,
                check.saturation,
                str(check.alcohol_value) if check.alcohol_value is not None else "",
                "Positive" if check.alcohol_positive else "Negative",
                str(check.hours_worked),
                str(check.hours_rested),
                check.get_conclusion_display(),
                check.note,
                check.medic.username,
            ]
            for check in checks.iterator()
        )
        return xlsx_response(
            filename=f"medical-checks-{timezone.localdate():%Y%m%d}.xlsx",
            sheet_title="Medical checks",
            headers=[
                "Date/time",
                "Employee",
                "BP",
                "Pulse",
                "SpO2 %",
                "Alcohol value",
                "Alcohol result",
                "Hours worked",
                "Hours rested",
                "Conclusion",
                "Note",
                "Entered by",
            ],
            rows=rows,
        )
