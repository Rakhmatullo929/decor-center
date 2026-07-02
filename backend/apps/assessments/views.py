import base64
import binascii

from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from apps.accounts.permissions import IsAdmin, IsAdminOrMedicOrSpecialist, IsSpecialist
from apps.core.excel import xlsx_response
from apps.employees.models import Employee
from apps.employees.serializers import EmployeeSerializer
from apps.integrations.registry import get_face_recognition_service

from .filters import TestSessionFilter
from .models import Question, TestSession
from .serializers import (
    QuestionAdminSerializer,
    QuestionPublicSerializer,
    StartTestSessionSerializer,
    SubmitTestSessionSerializer,
    TestSessionDetailSerializer,
    TestSessionSerializer,
)
from .services import (
    DailyAttemptError,
    FaceCaptureRequiredError,
    FaceVerificationError,
    TestFlowError,
    start_test_session,
    submit_test_session,
)


def _decode_face_image(value: str) -> bytes:
    """Decode a base64 (raw or data-URL) camera frame; raise DRF ValidationError on garbage."""
    if value.strip().startswith("data:") and "," in value:
        value = value.split(",", 1)[1]
    value = "".join(value.split())  # strip whitespace/newlines
    try:
        return base64.b64decode(value, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValidationError({"detail": "Invalid image data.", "code": "invalid_image"}) from exc


class QuestionViewSet(viewsets.ModelViewSet):
    """Test bank management — admin only (SRS §5.1, §6.2, §8.1)."""

    queryset = Question.objects.select_related("specialty")
    serializer_class = QuestionAdminSerializer
    permission_classes = [IsAdmin]
    filterset_fields = ["module", "specialty", "status", "source"]
    search_fields = ["text"]
    ordering_fields = ["created_at"]

    @extend_schema(request=None, responses=QuestionAdminSerializer)
    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        """Approve an AI-generated or manual draft question (SRS §5.1.3)."""
        question = self.get_object()
        question.status = Question.Status.APPROVED
        question.save(update_fields=["status", "updated_at"])
        return Response(self.get_serializer(question).data)


class TestSessionViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    """Test taking flow (specialist) and results browsing (admin)."""

    queryset = TestSession.objects.select_related("employee", "specialty")
    serializer_class = TestSessionSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filterset_class = TestSessionFilter
    ordering_fields = ["employee__full_name", "score", "started_at"]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return TestSessionDetailSerializer
        return TestSessionSerializer

    def get_permissions(self):
        # Results browsing is admin-only; specialist sees results only on submit (SRS §3.2).
        # identify is also open to medics so the medical-check flow can resolve a face to an employee.
        if self.action in ("start", "submit"):
            return [IsSpecialist()]
        if self.action == "identify":
            return [IsAdminOrMedicOrSpecialist()]
        return [IsAdmin()]

    @extend_schema(
        request={
            "multipart/form-data": {
                "type": "object",
                "properties": {"face_image": {"type": "string", "format": "binary"}},
                "required": ["face_image"],
            }
        },
        responses={200: EmployeeSerializer},
    )
    @action(detail=False, methods=["post"])
    def identify(self, request):
        """1:N face search — find an employee from a live camera frame (SRS §5.2.1).

        No session is created. Used by the kiosk to identify the person before
        the employee selects a test module and presses "Start test".
        """
        face_image = request.data.get("face_image")
        if not face_image:
            raise ValidationError({"face_image": ["This field is required."]})

        face_image.seek(0)
        face_bytes = face_image.read()

        service = get_face_recognition_service()

        # Build candidate list [(employee_id, embedding), ...]
        employees = Employee.objects.filter(
            is_active=True, face_embedding__isnull=False
        ).only("id", "face_embedding")
        candidates = [(emp.id, emp.face_embedding) for emp in employees]

        if not candidates:
            return Response(
                {"detail": "No employees with face data are registered. Contact the administrator."},
                status=status.HTTP_404_NOT_FOUND,
            )

        best_id, score = service.identify_best_match(candidates, face_bytes)

        if best_id is None:
            return Response(
                {"detail": "Face not recognised. Look directly at the camera and try again."},
                status=status.HTTP_404_NOT_FOUND,
            )

        employee = Employee.objects.select_related("specialty").get(id=best_id)
        return Response({"employee": EmployeeSerializer(employee).data})

    @extend_schema(request=StartTestSessionSerializer)
    @action(detail=False, methods=["post"])
    def start(self, request):
        """Face ID gate + session creation with 10 random approved questions (SRS §5.2)."""
        serializer = StartTestSessionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        face_image = serializer.validated_data["face_image"]
        face_image.seek(0)
        face_bytes = face_image.read()

        try:
            session, questions = start_test_session(
                employee=serializer.validated_data["employee"],
                module=serializer.validated_data["module"],
                face_image_bytes=face_bytes,
            )
        except FaceVerificationError as exc:
            raise PermissionDenied(str(exc)) from exc
        except DailyAttemptError as exc:
            # 409 so the kiosk shows a localized "already tested today" notice.
            return Response(
                {"detail": str(exc), "code": "daily_limit"},
                status=status.HTTP_409_CONFLICT,
            )
        except TestFlowError as exc:
            raise ValidationError({"detail": str(exc)}) from exc

        return Response(
            {
                "session": TestSessionSerializer(session).data,
                "questions": QuestionPublicSerializer(
                    questions, many=True, context={"request": request}
                ).data,
            },
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(request=SubmitTestSessionSerializer, responses=TestSessionSerializer)
    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        """Submit answers (+ optional submit-time face re-verification) and get the result."""
        session = self.get_object()
        serializer = SubmitTestSessionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        face_b64 = serializer.validated_data.get("face_image")
        face_bytes = _decode_face_image(face_b64) if face_b64 else None

        try:
            session = submit_test_session(
                session=session,
                answers=serializer.validated_data["answers"],
                face_image_bytes=face_bytes,
            )
        except FaceCaptureRequiredError as exc:
            return Response(
                {"detail": str(exc), "code": "face_capture_required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except FaceVerificationError as exc:
            return Response(
                {"detail": str(exc), "code": "face_reverify_failed"},
                status=status.HTTP_403_FORBIDDEN,
            )
        except TestFlowError as exc:
            raise ValidationError({"detail": str(exc)}) from exc

        return Response(TestSessionSerializer(session).data)

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action == "retrieve":
            queryset = queryset.prefetch_related("answers__question")
        return queryset

    @extend_schema(responses={(200, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"): bytes})
    @action(detail=False, methods=["get"])
    def export(self, request):
        """Download filtered test results as XLSX (SRS §8.1.6). Admin only."""
        sessions = self.filter_queryset(self.get_queryset())
        rows = (
            [
                session.employee.full_name,
                session.specialty.name if session.specialty else "",
                session.get_module_display(),
                timezone.localtime(session.started_at).strftime("%Y-%m-%d %H:%M"),
                timezone.localtime(session.finished_at).strftime("%Y-%m-%d %H:%M")
                if session.finished_at
                else "",
                session.score if session.score is not None else "",
                session.total,
                {True: "Passed", False: "Failed", None: "In progress"}[session.passed],
            ]
            for session in sessions.iterator()
        )
        return xlsx_response(
            filename=f"test-results-{timezone.localdate():%Y%m%d}.xlsx",
            sheet_title="Test results",
            headers=[
                "Employee",
                "Specialty",
                "Module",
                "Started",
                "Finished",
                "Score",
                "Total",
                "Result",
            ],
            rows=rows,
        )
