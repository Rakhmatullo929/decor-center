import base64
import binascii

from django.db import transaction
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from apps.accounts.permissions import IsAdmin, IsAdminOrEmployee, IsAdminOrReadOnly
from apps.core.excel import xlsx_response
from apps.employees.models import Employee
from apps.employees.serializers import EmployeeSerializer
from apps.integrations.registry import get_face_recognition_service

from .filters import SurveySessionFilter
from .i18n import display_text
from .models import Answer, Question, QuestionBlock, SurveySession, Test  # noqa: F401
from .scheduling import due_surveys
from .serializers import (
    AdminFillSerializer,
    QuestionBlockPublicSerializer,
    QuestionBlockSerializer,
    QuestionSerializer,
    StartSurveySerializer,
    SubmitSerializer,
    SurveySessionDetailSerializer,
    SurveySessionSerializer,
    TestSerializer,
)
from .services import (
    FaceCaptureRequiredError,
    FaceVerificationError,
    SurveyFlowError,
    admin_fill,
    apply_order,
    start_survey_session,
    submit_survey_session,
)


def _decode_face_image(value: str) -> bytes:
    """Decode a base64 (raw or data-URL) camera frame; raise ValidationError on garbage."""
    if value.strip().startswith("data:") and "," in value:
        value = value.split(",", 1)[1]
    value = "".join(value.split())
    try:
        return base64.b64decode(value, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValidationError({"detail": "Invalid image data.", "code": "invalid_image"}) from exc


class TestViewSet(viewsets.ModelViewSet):
    queryset = Test.objects.prefetch_related("blocks__questions")
    serializer_class = TestSerializer
    permission_classes = [IsAdminOrReadOnly]


class QuestionBlockViewSet(viewsets.ModelViewSet):
    queryset = QuestionBlock.objects.prefetch_related("questions")
    serializer_class = QuestionBlockSerializer
    permission_classes = [IsAdminOrReadOnly]
    filterset_fields = ["test"]

    @extend_schema(
        request={
            "application/json": {
                "type": "object",
                "properties": {
                    "test": {"type": "integer"},
                    "order": {"type": "array", "items": {"type": "integer"}},
                },
                "required": ["test", "order"],
            }
        },
        responses={200: QuestionBlockSerializer(many=True)},
    )
    @action(detail=False, methods=["post"])
    def reorder(self, request):
        """Drag&drop reorder: atomically set `order` for every block of a test."""
        test_id = request.data.get("test")
        order = request.data.get("order")
        if not test_id or not isinstance(order, list) or not order:
            raise ValidationError({"detail": "'test' and a non-empty 'order' array are required."})

        blocks = {b.id: b for b in QuestionBlock.objects.filter(test_id=test_id)}
        if set(order) != set(blocks):
            raise ValidationError(
                {"order": "Must list exactly the block ids belonging to this test."}
            )

        with transaction.atomic():
            apply_order(blocks, order)

        updated = QuestionBlock.objects.filter(test_id=test_id).prefetch_related("questions")
        return Response(QuestionBlockSerializer(updated, many=True).data)


class QuestionViewSet(viewsets.ModelViewSet):
    queryset = Question.objects.all()
    serializer_class = QuestionSerializer
    permission_classes = [IsAdminOrReadOnly]
    filterset_fields = ["block"]

    @extend_schema(
        request={
            "application/json": {
                "type": "object",
                "properties": {
                    "block": {"type": "integer"},
                    "order": {"type": "array", "items": {"type": "integer"}},
                },
                "required": ["block", "order"],
            }
        },
        responses={200: QuestionSerializer(many=True)},
    )
    @action(detail=False, methods=["post"])
    def reorder(self, request):
        """Drag&drop reorder within a single block: atomically set `order`."""
        block_id = request.data.get("block")
        order = request.data.get("order")
        if not block_id or not isinstance(order, list) or not order:
            raise ValidationError({"detail": "'block' and a non-empty 'order' array are required."})

        questions = {q.id: q for q in Question.objects.filter(block_id=block_id)}
        if set(order) != set(questions):
            raise ValidationError(
                {"order": "Must list exactly the question ids belonging to this block."}
            )

        with transaction.atomic():
            apply_order(questions, order)

        updated = Question.objects.filter(block_id=block_id)
        return Response(QuestionSerializer(updated, many=True).data)

    @extend_schema(
        request={
            "application/json": {
                "type": "object",
                "properties": {
                    "question": {"type": "integer"},
                    "target_block": {"type": "integer"},
                    "order": {"type": "array", "items": {"type": "integer"}},
                },
                "required": ["question", "target_block", "order"],
            }
        },
        responses={200: QuestionSerializer(many=True)},
    )
    @action(detail=False, methods=["post"])
    def move(self, request):
        """Drag&drop a question into a (possibly different) block, then atomically
        reorder the target block's full question list (which must include it)."""
        question_id = request.data.get("question")
        target_block_id = request.data.get("target_block")
        order = request.data.get("order")
        if not question_id or not target_block_id or not isinstance(order, list) or not order:
            raise ValidationError(
                {"detail": "'question', 'target_block' and a non-empty 'order' array are required."}
            )

        question = Question.objects.select_related("block__test").filter(pk=question_id).first()
        if question is None:
            raise ValidationError({"question": "Not found."})
        target_block = QuestionBlock.objects.filter(pk=target_block_id).first()
        if target_block is None:
            raise ValidationError({"target_block": "Not found."})
        if question.block.test_id != target_block.test_id:
            raise ValidationError(
                {"target_block": "Cannot move a question to a block of a different survey."}
            )

        with transaction.atomic():
            if question.block_id != target_block_id:
                question.block = target_block
                question.save(update_fields=["block", "updated_at"])

            target_questions = {
                q.id: q for q in Question.objects.filter(block_id=target_block_id)
            }
            if set(order) != set(target_questions):
                raise ValidationError(
                    {"order": "Must list exactly the question ids of the target block after the move."}
                )
            apply_order(target_questions, order)

        updated = Question.objects.filter(block_id=target_block_id)
        return Response(QuestionSerializer(updated, many=True).data)


class SurveySessionViewSet(viewsets.ReadOnlyModelViewSet):
    """Survey taking flow (kiosk) + results browsing (admin)."""

    queryset = SurveySession.objects.select_related("employee", "test")
    serializer_class = SurveySessionSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filterset_class = SurveySessionFilter
    ordering_fields = ["employee__full_name", "started_at", "completed_at"]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return SurveySessionDetailSerializer
        return SurveySessionSerializer

    def get_permissions(self):
        if self.action in ("identify", "due", "start", "submit"):
            return [IsAdminOrEmployee()]
        return [IsAdmin()]

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action == "retrieve":
            queryset = queryset.prefetch_related("answers__question")
        return queryset

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
        """1:N face search — resolve a live camera frame to an employee."""
        face_image = request.data.get("face_image")
        if not face_image:
            raise ValidationError({"face_image": ["This field is required."]})
        face_image.seek(0)
        face_bytes = face_image.read()

        service = get_face_recognition_service()
        employees = Employee.objects.filter(
            is_active=True, face_embedding__isnull=False
        ).only("id", "face_embedding")
        candidates = [(emp.id, emp.face_embedding) for emp in employees]
        if not candidates:
            return Response(
                {"detail": "No employees with face data are registered."},
                status=status.HTTP_404_NOT_FOUND,
            )

        best_id, score = service.identify_best_match(candidates, face_bytes)
        if best_id is None:
            return Response(
                {"detail": "Face not recognised. Look at the camera and try again."},
                status=status.HTTP_404_NOT_FOUND,
            )
        employee = Employee.objects.select_related("specialty").get(id=best_id)
        return Response({"employee": EmployeeSerializer(employee).data})

    @extend_schema(responses={200: TestSerializer(many=True)})
    @action(detail=False, methods=["get"])
    def due(self, request):
        """List surveys currently due for an employee (kiosk)."""
        employee_id = request.query_params.get("employee")
        if not employee_id:
            raise ValidationError({"employee": ["This query parameter is required."]})
        employee = Employee.objects.filter(pk=employee_id, is_active=True).first()
        if employee is None:
            return Response({"detail": "Employee not found."}, status=status.HTTP_404_NOT_FOUND)
        surveys = due_surveys(employee, timezone.localdate())
        return Response(TestSerializer(surveys, many=True).data)

    @extend_schema(request=StartSurveySerializer)
    @action(detail=False, methods=["post"])
    def start(self, request):
        """Face-ID gate + session creation with a frozen question set."""
        serializer = StartSurveySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        face_image = serializer.validated_data["face_image"]
        face_image.seek(0)
        face_bytes = face_image.read()
        survey = serializer.validated_data["test"]

        try:
            session, _questions = start_survey_session(
                employee=serializer.validated_data["employee"],
                test=survey,
                face_image_bytes=face_bytes,
            )
        except FaceVerificationError as exc:
            raise PermissionDenied({"detail": str(exc), "code": "face_verify_failed"}) from exc
        except SurveyFlowError as exc:
            raise ValidationError({"detail": str(exc)}) from exc

        blocks = QuestionBlock.objects.filter(test=survey).prefetch_related("questions")
        return Response(
            {
                "session": SurveySessionSerializer(session).data,
                "test": {"id": survey.id, "title": survey.title},
                "blocks": QuestionBlockPublicSerializer(blocks, many=True).data,
            },
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(request=SubmitSerializer, responses=SurveySessionSerializer)
    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        """Persist answers (optional submit re-verify) and complete the session."""
        session = self.get_object()
        serializer = SubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        face_b64 = serializer.validated_data.get("faceImage")
        face_bytes = _decode_face_image(face_b64) if face_b64 else None

        try:
            session = submit_survey_session(
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
        except SurveyFlowError as exc:
            raise ValidationError({"detail": str(exc)}) from exc
        return Response(SurveySessionSerializer(session).data)

    @extend_schema(request=AdminFillSerializer, responses=SurveySessionSerializer)
    @action(detail=False, methods=["post"], url_path="admin-fill")
    def admin_fill(self, request):
        """Create a completed session for an admin 1-on-1 (no Face-ID). Admin only."""
        serializer = AdminFillSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            session = admin_fill(
                employee=serializer.validated_data["employee"],
                test=serializer.validated_data["test"],
                answers=serializer.validated_data["answers"],
                user=request.user,
            )
        except SurveyFlowError as exc:
            raise ValidationError({"detail": str(exc)}) from exc
        return Response(
            SurveySessionSerializer(session).data, status=status.HTTP_201_CREATED
        )

    @action(detail=False, methods=["get"])
    def results(self, request):
        """Aggregate completed answers for a survey (option counts + textarea list)."""
        survey = self._require_test(request)
        return Response(_aggregate_results(survey))

    @extend_schema(
        responses={
            (200, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"): bytes
        }
    )
    @action(detail=False, methods=["get"])
    def export(self, request):
        """Download survey aggregation as XLSX. Admin only."""
        survey = self._require_test(request)
        aggregate = _aggregate_results(survey)
        rows = []
        for block in aggregate["blocks"]:
            for question in block["questions"]:
                if question["type"] == Question.Type.TEXTAREA:
                    for text in question["textValues"]:
                        rows.append([block["title"], question["text"], "textarea", text, ""])
                else:
                    for option in question["options"]:
                        rows.append(
                            [block["title"], question["text"], question["type"],
                             option["text"], option["count"]]
                        )
        return xlsx_response(
            filename=f"survey-results-{timezone.localdate():%Y%m%d}.xlsx",
            sheet_title="Survey results",
            headers=["Block", "Question", "Type", "Answer", "Count"],
            rows=rows,
        )

    def _require_test(self, request) -> Test:
        test_id = request.query_params.get("test")
        if not test_id:
            raise ValidationError({"test": ["This query parameter is required."]})
        survey = Test.objects.filter(pk=test_id).first()
        if survey is None:
            raise ValidationError({"test": ["Survey not found."]})
        return survey


def _aggregate_results(survey: Test) -> dict:
    """Build scoreless aggregation: per-option counts + textarea response list."""
    blocks_out = []
    blocks = survey.blocks.prefetch_related("questions__answers__session")
    for block in blocks:
        questions_out = []
        for question in block.questions.all():
            answers = [
                a for a in question.answers.all()
                if a.session.completed_at is not None
            ]
            if question.type == Question.Type.TEXTAREA:
                texts = [a.text_value for a in answers if a.text_value]
                questions_out.append(
                    {
                        "id": question.id,
                        "text": display_text(question.text),
                        "type": question.type,
                        "textValues": texts,
                        "responseCount": len(texts),
                    }
                )
            else:
                counts = {opt["id"]: 0 for opt in question.options}
                for answer in answers:
                    for oid in answer.selected_option_ids:
                        if oid in counts:
                            counts[oid] += 1
                questions_out.append(
                    {
                        "id": question.id,
                        "text": display_text(question.text),
                        "type": question.type,
                        "options": [
                            {
                                "id": opt["id"],
                                "text": display_text(opt.get("text")),
                                "count": counts[opt["id"]],
                            }
                            for opt in question.options
                        ],
                    }
                )
        blocks_out.append(
            {"id": block.id, "title": display_text(block.title), "questions": questions_out}
        )
    return {"test": {"id": survey.id, "title": survey.title}, "blocks": blocks_out}
