"""Test session domain logic: Face ID gate, question selection, scoring."""
import logging
from dataclasses import dataclass

from django.conf import settings as django_settings
from django.db import transaction
from django.utils import timezone

from apps.employees.face_enrollment import backend_model_version
from apps.employees.models import Employee
from apps.integrations.base import NoFaceDetectedError
from apps.integrations.registry import get_face_recognition_service

from .models import (
    FaceVerificationLog,
    Module,
    Question,
    TestAnswer,
    TestSession,
    pass_threshold,
    questions_per_test,
)

logger = logging.getLogger(__name__)


class FaceVerificationError(Exception):
    """Face ID failed or impossible — the test must not start (SRS §5.2.4)."""


class TestFlowError(Exception):
    """Invalid test flow operation (insufficient bank, bad submit, etc.)."""


class DailyAttemptError(Exception):
    """The employee already attempted this module today — one attempt per day (SRS §15.3)."""


class FaceCaptureRequiredError(TestFlowError):
    """Block mode requires a face capture at submit but none was provided."""


@dataclass
class SubmitFaceResult:
    checked: bool
    matched: bool
    reason: str
    score: float


def verify_submit_face(session, image_bytes: bytes | None) -> SubmitFaceResult:
    """Compare a submit-time camera frame against the session's frozen snapshot.

    Returns a SubmitFaceResult. A FaceVerificationLog row is written only when an actual
    comparison happens (reason ok/mismatch/no_face); skip cases are logged via `logger`.
    """
    mode = django_settings.DEPO["REVERIFY_ON_SUBMIT"]
    if mode == "off":
        return SubmitFaceResult(False, False, "off", 0.0)
    if not session.face_embedding_snapshot:
        logger.info("Session %s has no face snapshot; skipping submit re-verify.", session.pk)
        return SubmitFaceResult(False, False, "no_snapshot", 0.0)

    service = get_face_recognition_service()
    active_version = backend_model_version(service)
    if active_version != session.face_embedding_model_version:
        logger.warning(
            "Session %s snapshot version %r != active %r; skipping submit re-verify.",
            session.pk, session.face_embedding_model_version, active_version,
        )
        return SubmitFaceResult(False, False, "model_mismatch", 0.0)

    if image_bytes is None:
        logger.info("Session %s submit had no face capture (mode=%s).", session.pk, mode)
        return SubmitFaceResult(False, False, "no_capture", 0.0)

    try:
        live = service.extract_embedding(image_bytes)
    except NoFaceDetectedError:
        matched, score, reason = False, 0.0, "no_face"
    else:
        matched, score = service.compare_embeddings(session.face_embedding_snapshot, live)
        reason = "ok" if matched else "mismatch"

    FaceVerificationLog.objects.create(
        employee=session.employee,
        session=session,
        stage=FaceVerificationLog.Stage.SUBMIT,
        success=matched,
        similarity_score=score,
        reason=reason,
    )
    return SubmitFaceResult(True, matched, reason, score)


def start_test_session(
    *, employee: Employee, module: str, face_image_bytes: bytes
) -> tuple[TestSession, list[Question]]:
    """Verify Face ID, then create a session with 10 random approved questions.

    Every verification attempt is logged. On failure no session is created.
    """
    # One attempt per module per day: block before Face ID so a locked-out
    # employee never triggers a camera capture or a logged face attempt.
    if TestSession.objects.filter(
        employee=employee, module=module, started_at__date=timezone.localdate()
    ).exists():
        raise DailyAttemptError(
            "This employee has already taken this test today. "
            "Only one attempt per module per day is allowed."
        )

    # Administrative misconfiguration, not a Face ID mismatch: surfaces as 400
    # so the kiosk can show "contact the administrator" instead of a face warning.
    if not employee.face_embedding:
        raise TestFlowError(
            "Employee has no reference photo embedding. Contact the administrator."
        )

    service = get_face_recognition_service()
    matched, score = service.compare(employee.face_embedding, face_image_bytes)
    FaceVerificationLog.objects.create(
        employee=employee, success=matched, similarity_score=score
    )
    if not matched:
        raise FaceVerificationError("Face ID check failed: face does not match or not detected.")

    if module == Module.SPECIALTY:
        queryset = Question.objects.filter(
            status=Question.Status.APPROVED,
            module=Module.SPECIALTY,
            specialty=employee.specialty,
        )
    else:
        # Safety modules each have their own isolated bank (SRS §6.1).
        queryset = Question.objects.filter(
            status=Question.Status.APPROVED,
            module=module,
        )

    count = questions_per_test()
    questions = list(queryset.order_by("?")[:count])
    if len(questions) < count:
        raise TestFlowError(
            f"Not enough approved questions: required {count}, available {len(questions)}."
        )

    with transaction.atomic():
        session = TestSession.objects.create(
            employee=employee,
            module=module,
            specialty=employee.specialty if module == Module.SPECIALTY else None,
            total=count,
            face_verified=True,
            face_embedding_snapshot=employee.face_embedding,
            face_embedding_model_version=backend_model_version(service),
        )
        TestAnswer.objects.bulk_create(
            [TestAnswer(session=session, question=question) for question in questions]
        )
    return session, questions


def submit_test_session(
    *, session: TestSession, answers: list[dict], face_image_bytes: bytes | None = None
) -> TestSession:
    """Re-verify the test-taker's face (per mode), then record answers and compute the result."""
    if session.finished_at is not None:
        raise TestFlowError("This test session is already finished.")

    mode = django_settings.DEPO["REVERIFY_ON_SUBMIT"]
    result = verify_submit_face(session, face_image_bytes)
    if mode == "block":
        if result.reason == "no_capture":
            raise FaceCaptureRequiredError("Face capture is required to submit this test.")
        if result.checked and not result.matched:
            raise FaceVerificationError(
                "Face re-verification failed: the face does not match the test taker."
            )

    answer_rows = {row.question_id: row for row in session.answers.select_related("question")}
    submitted_ids = [item["question"] for item in answers]
    if len(submitted_ids) != len(set(submitted_ids)):
        raise TestFlowError("Duplicate answers for the same question.")
    if set(submitted_ids) != set(answer_rows):
        raise TestFlowError("Answers must cover exactly the questions presented in this session.")

    score = 0
    with transaction.atomic():
        for item in answers:
            row = answer_rows[item["question"]]
            row.selected_option = item["selected_option"]
            row.is_correct = row.selected_option == row.question.correct_option
            score += int(row.is_correct)
        TestAnswer.objects.bulk_update(answer_rows.values(), ["selected_option", "is_correct"])

        session.score = score
        session.passed = score >= pass_threshold()
        session.finished_at = timezone.now()
        update_fields = ["score", "passed", "finished_at", "updated_at"]
        if result.checked:
            session.submit_face_verified = result.matched
            update_fields.append("submit_face_verified")
        session.save(update_fields=update_fields)
    return session
