"""Survey session domain logic: Face-ID gate, answer persistence. No scoring."""
import logging
from dataclasses import dataclass
from datetime import timedelta

from django.conf import settings as django_settings
from django.db import transaction
from django.utils import timezone

from apps.employees.face_enrollment import backend_model_version
from apps.employees.models import Employee
from apps.integrations.base import NoFaceDetectedError
from apps.integrations.registry import get_face_recognition_service

from .models import Answer, FaceVerificationLog, Question, SurveySession, Test
from .scheduling import is_expired

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


def presented_blocks(session: SurveySession) -> list[dict]:
    """The block/question tree exactly as presented to `session` at start, reconstructed
    from its frozen Answer rows rather than the test's current (possibly since-edited)
    definition.

    A block/question added to the test after the session started has no Answer row here,
    and autosave_answer/submit_survey_session reject anything outside that frozen set — so
    showing it would put a question in front of the employee that can never actually be
    saved or submitted. Reordering/renaming still shows live (blocks carry their current
    `order`/`title`), only the *set* of questions is frozen.
    """
    rows = (
        session.answers.select_related("question__block")
        .order_by("question__block__order", "question__block_id", "question__order", "question__id")
    )
    blocks: dict[int, dict] = {}
    for row in rows:
        question = row.question
        block = question.block
        entry = blocks.setdefault(
            block.id,
            {"id": block.id, "test": block.test_id, "order": block.order, "title": block.title, "questions": []},
        )
        entry["questions"].append(question)
    return list(blocks.values())


def _live_session_cutoff():
    threshold_hours = django_settings.DECOR["SURVEY_SESSION_ABANDONED_AFTER_HOURS"]
    return timezone.now() - timedelta(hours=threshold_hours)


def _live_session(employee: Employee, test: Test) -> SurveySession | None:
    """The employee's own not-completed, not-abandoned SurveySession for this test, if any."""
    return (
        SurveySession.objects.filter(
            employee=employee,
            test=test,
            completed_at__isnull=True,
            started_at__gte=_live_session_cutoff(),
        )
        .order_by("-started_at")
        .first()
    )


def in_progress_sessions(employee: Employee, today=None):
    """The employee's live (not completed, not abandoned) sessions whose survey
    window is still open — powers the cabinet's "continue" list. Sessions whose
    window has closed are omitted (expired surveys are read-only). Answers are
    prefetched so the serializer can report progress without an N+1."""
    today = today or timezone.localdate()
    sessions = (
        SurveySession.objects.filter(
            employee=employee, completed_at__isnull=True, started_at__gte=_live_session_cutoff()
        )
        .select_related("test")
        .prefetch_related("answers__question")
        .order_by("-started_at")
    )
    return [s for s in sessions if not is_expired(s.test, today)]


def start_survey_session(
    *, employee: Employee, test: Test, entry_face_verified: bool,
) -> tuple[SurveySession, list[Question], bool]:
    """Return the employee's live (in-progress, not abandoned) session for this test if
    one exists — otherwise create a new one and freeze the questions.

    Face-ID is verified once, at kiosk entry (identify + OTP) — starting an individual
    test relies on that already-established JWT session, not a fresh camera compare.
    `entry_face_verified` just records whether entry itself was face-based (vs OTP
    fallback), for the admin-facing audit trail.
    """
    existing = _live_session(employee, test)
    if existing is not None:
        questions = [
            answer.question
            for answer in existing.answers.select_related("question").order_by(
                "question__block__order", "question__order", "question__id"
            )
        ]
        return existing, questions, True

    service = get_face_recognition_service()
    questions = _presented_questions(test)
    with transaction.atomic():
        session = SurveySession.objects.create(
            employee=employee,
            test=test,
            face_verified=entry_face_verified,
            face_embedding=employee.face_embedding,
            model_version=backend_model_version(service),
        )
        Answer.objects.bulk_create(
            [Answer(session=session, question=question) for question in questions]
        )
    return session, questions, False


def _apply_answer(row: Answer, item: dict) -> None:
    """Write one polymorphic answer payload onto a frozen Answer row (no correctness)."""
    if row.question.type == Question.Type.SECTION_HEADER:
        return
    if row.question.type in Question.TEXT_ANSWER_TYPES:
        row.text_value = item.get("text_value", "")
        row.selected_option_ids = []
    else:
        row.selected_option_ids = item.get("selected_option_ids", [])
        row.text_value = ""


def autosave_answer(*, session: SurveySession, item: dict) -> Answer:
    """Upsert a single answer without touching completed_at — used for incremental saves
    while the employee is filling in the one-page form (see submit_survey_session for the
    final full-batch write)."""
    if session.completed_at is not None:
        raise SurveyFlowError("This survey session is already completed.")

    row = session.answers.select_related("question").filter(question_id=item["question"]).first()
    if row is None:
        raise SurveyFlowError("Answer must reference a question presented in this session.")

    _apply_answer(row, item)
    row.save(update_fields=["selected_option_ids", "text_value", "updated_at"])
    return row


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
