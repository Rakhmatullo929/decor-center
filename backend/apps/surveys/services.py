"""Survey session domain logic: Face-ID gate, answer persistence. No scoring."""
import logging
from dataclasses import dataclass

from django.conf import settings as django_settings
from django.db import transaction
from django.utils import timezone

from apps.employees.face_enrollment import backend_model_version
from apps.employees.models import Employee
from apps.integrations.base import NoFaceDetectedError
from apps.integrations.registry import get_face_recognition_service

from .models import Answer, FaceVerificationLog, Question, SurveySession, Test

logger = logging.getLogger(__name__)


def order_matches_objects(objects_by_id: dict, order: list) -> bool:
    """True iff `order` lists exactly the ids in `objects_by_id`, each exactly once.

    A plain `set(order) != set(objects_by_id)` check lets a duplicated id slip
    through (sets collapse the duplicate), silently dropping one of the real ids
    from the applied order — so callers must also compare lengths.
    """
    return len(order) == len(objects_by_id) and set(order) == set(objects_by_id)


def apply_order(objects_by_id: dict, order: list) -> list:
    """Assign 0-based positions from `order` and persist only the rows whose
    position actually changed, via a single bulk_update — not one UPDATE per row.

    `bulk_update` skips auto_now/auto_now_add, so `updated_at` is stamped by hand.
    Shared by the block/question reorder and move endpoints (QuestionBlockViewSet,
    QuestionViewSet in views.py).
    """
    changed = []
    now = timezone.now()
    for index, obj_id in enumerate(order):
        obj = objects_by_id[obj_id]
        if obj.order != index:
            obj.order = index
            obj.updated_at = now
            changed.append(obj)
    if changed:
        type(changed[0])._default_manager.bulk_update(changed, ["order", "updated_at"])
    return changed


class FaceVerificationError(Exception):
    """Face-ID failed — the survey must not start."""


class SurveyFlowError(Exception):
    """Invalid survey flow (missing embedding, resubmit, foreign question, etc.)."""


class FaceCaptureRequiredError(SurveyFlowError):
    """Block-mode submit re-verify required a face capture but none was provided."""


@dataclass
class SubmitFaceResult:
    checked: bool
    matched: bool
    reason: str
    score: float


def verify_submit_face(session: SurveySession, image_bytes: bytes | None) -> SubmitFaceResult:
    """Compare a submit-time frame against the session's frozen snapshot (per DECOR mode).

    A FaceVerificationLog row is written only when a real comparison happens.
    """
    mode = django_settings.DECOR["REVERIFY_ON_SUBMIT"]
    if mode == "off":
        return SubmitFaceResult(False, False, "off", 0.0)
    if not session.face_embedding:
        logger.info("Session %s has no face snapshot; skipping submit re-verify.", session.pk)
        return SubmitFaceResult(False, False, "no_snapshot", 0.0)

    service = get_face_recognition_service()
    active_version = backend_model_version(service)
    if active_version != session.model_version:
        logger.warning(
            "Session %s snapshot version %r != active %r; skipping submit re-verify.",
            session.pk, session.model_version, active_version,
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
        matched, score = service.compare_embeddings(session.face_embedding, live)
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


def _presented_questions(test: Test) -> list[Question]:
    return list(
        Question.objects.filter(block__test=test).order_by("block__order", "order", "id")
    )


def start_survey_session(
    *, employee: Employee, test: Test, face_image_bytes: bytes
) -> tuple[SurveySession, list[Question]]:
    """Verify Face-ID, then create a session and freeze the presented question set."""
    if not employee.face_embedding:
        raise SurveyFlowError(
            "Employee has no reference photo embedding. Contact the administrator."
        )

    service = get_face_recognition_service()
    matched, score = service.compare(employee.face_embedding, face_image_bytes)
    FaceVerificationLog.objects.create(
        employee=employee,
        stage=FaceVerificationLog.Stage.START,
        success=matched,
        similarity_score=score,
    )
    if not matched:
        raise FaceVerificationError("Face-ID check failed: face does not match or not detected.")

    questions = _presented_questions(test)
    with transaction.atomic():
        session = SurveySession.objects.create(
            employee=employee,
            test=test,
            face_verified=True,
            face_embedding=employee.face_embedding,
            model_version=backend_model_version(service),
        )
        Answer.objects.bulk_create(
            [Answer(session=session, question=question) for question in questions]
        )
    return session, questions


def _apply_answer(row: Answer, item: dict) -> None:
    """Write one polymorphic answer payload onto a frozen Answer row (no correctness)."""
    if row.question.type == Question.Type.TEXTAREA:
        row.text_value = item.get("textValue", "")
        row.selected_option_ids = []
    else:
        row.selected_option_ids = item.get("selectedOptionIds", [])
        row.text_value = ""


def submit_survey_session(
    *, session: SurveySession, answers: list[dict], face_image_bytes: bytes | None = None
) -> SurveySession:
    """Persist answers (optional submit re-verify), set completed_at. No score."""
    if session.completed_at is not None:
        raise SurveyFlowError("This survey session is already completed.")

    mode = django_settings.DECOR["REVERIFY_ON_SUBMIT"]
    result = verify_submit_face(session, face_image_bytes)
    if mode == "block":
        if result.reason == "no_capture":
            raise FaceCaptureRequiredError("Face capture is required to submit this survey.")
        if result.checked and not result.matched:
            raise FaceVerificationError(
                "Face re-verification failed: the face does not match."
            )

    rows = {row.question_id: row for row in session.answers.select_related("question")}
    submitted_ids = [item["question"] for item in answers]
    if len(submitted_ids) != len(set(submitted_ids)):
        raise SurveyFlowError("Duplicate answers for the same question.")
    if not set(submitted_ids) <= set(rows):
        raise SurveyFlowError("Answers must reference questions presented in this session.")

    with transaction.atomic():
        for item in answers:
            row = rows[item["question"]]
            _apply_answer(row, item)
        Answer.objects.bulk_update(rows.values(), ["selected_option_ids", "text_value"])
        session.completed_at = timezone.now()
        session.save(update_fields=["completed_at", "updated_at"])
    return session


def admin_fill(
    *, employee: Employee, test: Test, answers: list[dict], user
) -> SurveySession:
    """Create an already-completed session for an admin 1-on-1 (no Face-ID)."""
    questions = {q.id: q for q in _presented_questions(test)}
    submitted_ids = [item["question"] for item in answers]
    if len(submitted_ids) != len(set(submitted_ids)):
        raise SurveyFlowError("Duplicate answers for the same question.")
    if not set(submitted_ids) <= set(questions):
        raise SurveyFlowError("Answers must reference questions of this survey.")

    with transaction.atomic():
        session = SurveySession.objects.create(
            employee=employee,
            test=test,
            created_by=user,
            face_verified=False,
            completed_at=timezone.now(),
        )
        rows = []
        for item in answers:
            row = Answer(session=session, question=questions[item["question"]])
            _apply_answer(row, item)
            rows.append(row)
        Answer.objects.bulk_create(rows)
    return session
