import base64

import pytest

from apps.assessments.models import FaceVerificationLog, TestSession
from apps.integrations.mocks import MockFaceRecognitionService

from .conftest import png_bytes
from .factories import EmployeeFactory, QuestionFactory, SpecialtyFactory

pytestmark = pytest.mark.django_db

SESSIONS_URL = "/api/v1/test-sessions/"


def _session(employee, **extra):
    defaults = dict(employee=employee, module="specialty", total=10)
    defaults.update(extra)
    return TestSession.objects.create(**defaults)


# --------------------------------------------------------------------------- #
# Task 2: model fields, write-once guard, log stage/reason/session
# --------------------------------------------------------------------------- #


def test_session_snapshot_fields_exist():
    emp = EmployeeFactory()
    session = _session(
        emp,
        face_embedding_snapshot=[0.1] * 16,
        face_embedding_model_version="mock-16",
    )
    session.refresh_from_db()
    assert session.face_embedding_snapshot == [0.1] * 16
    assert session.face_embedding_model_version == "mock-16"
    assert session.submit_face_verified is None  # not checked yet


def test_snapshot_is_write_once():
    emp = EmployeeFactory()
    session = _session(emp, face_embedding_snapshot=[0.1] * 16, face_embedding_model_version="mock-16")
    session.face_embedding_snapshot = [0.9] * 16
    with pytest.raises(ValueError, match="immutable"):
        session.save()


def test_scoring_save_does_not_trip_the_snapshot_guard():
    """Saving unrelated fields (score/passed) must not raise even with a snapshot set."""
    emp = EmployeeFactory()
    session = _session(emp, face_embedding_snapshot=[0.1] * 16, face_embedding_model_version="mock-16")
    session.score = 7
    session.save(update_fields=["score", "updated_at"])  # must not raise
    session.refresh_from_db()
    assert session.score == 7


def test_face_log_stage_reason_session_defaults():
    emp = EmployeeFactory()
    log = FaceVerificationLog.objects.create(employee=emp, success=True)
    assert log.stage == FaceVerificationLog.Stage.START
    assert log.reason == ""
    assert log.session is None


# --------------------------------------------------------------------------- #
# Task 3: snapshot frozen at start
# --------------------------------------------------------------------------- #


def test_start_freezes_snapshot(specialist_client):
    from django.core.files.uploadedfile import SimpleUploadedFile

    specialty = SpecialtyFactory()
    employee = EmployeeFactory(specialty=specialty)
    QuestionFactory.create_batch(10, specialty=specialty)

    frame = SimpleUploadedFile("frame.png", png_bytes(), content_type="image/png")
    resp = specialist_client.post(
        f"{SESSIONS_URL}start/",
        {"employee": employee.id, "module": "specialty", "face_image": frame},
        format="multipart",
    )
    assert resp.status_code == 201, resp.data

    session = TestSession.objects.get(id=resp.data["session"]["id"])
    employee.refresh_from_db()
    assert session.face_embedding_snapshot == employee.face_embedding
    assert session.face_embedding_model_version == "mock-16"


# --------------------------------------------------------------------------- #
# Task 4: verify_submit_face helper
# --------------------------------------------------------------------------- #


def _snapshot_for(frame_bytes):
    """The mock matches only identical embeddings; snapshot = embedding of the match frame."""
    return MockFaceRecognitionService().extract_embedding(frame_bytes)


def _verified_session(employee):
    match_bytes = png_bytes()
    return TestSession.objects.create(
        employee=employee,
        module="specialty",
        total=10,
        face_embedding_snapshot=_snapshot_for(match_bytes),
        face_embedding_model_version="mock-16",
    )


def test_verify_submit_face_off_skips(settings):
    settings.DEPO = {**settings.DEPO, "REVERIFY_ON_SUBMIT": "off"}
    from apps.assessments.services import verify_submit_face

    emp = EmployeeFactory()
    session = _verified_session(emp)
    result = verify_submit_face(session, png_bytes())
    assert result.checked is False
    assert result.reason == "off"
    assert FaceVerificationLog.objects.filter(stage="submit").count() == 0


def test_verify_submit_face_match(settings):
    settings.DEPO = {**settings.DEPO, "REVERIFY_ON_SUBMIT": "log"}
    from apps.assessments.services import verify_submit_face

    emp = EmployeeFactory()
    session = _verified_session(emp)
    result = verify_submit_face(session, png_bytes())  # same bytes as snapshot -> match
    assert result.checked is True and result.matched is True
    assert result.reason == "ok"
    log = FaceVerificationLog.objects.get(stage="submit")
    assert log.success is True and log.session_id == session.id


def test_verify_submit_face_mismatch(settings):
    settings.DEPO = {**settings.DEPO, "REVERIFY_ON_SUBMIT": "log"}
    from apps.assessments.services import verify_submit_face

    emp = EmployeeFactory()
    session = _verified_session(emp)
    result = verify_submit_face(session, png_bytes() + b"FAILMATCH")
    assert result.checked is True and result.matched is False
    assert result.reason == "mismatch"


def test_verify_submit_face_no_face(settings):
    settings.DEPO = {**settings.DEPO, "REVERIFY_ON_SUBMIT": "log"}
    from apps.assessments.services import verify_submit_face

    emp = EmployeeFactory()
    session = _verified_session(emp)
    result = verify_submit_face(session, png_bytes() + b"NOFACE")
    assert result.checked is True and result.matched is False
    assert result.reason == "no_face"


def test_verify_submit_face_no_snapshot_skips(settings):
    settings.DEPO = {**settings.DEPO, "REVERIFY_ON_SUBMIT": "block"}
    from apps.assessments.services import verify_submit_face

    emp = EmployeeFactory()
    session = TestSession.objects.create(employee=emp, module="specialty", total=10)
    result = verify_submit_face(session, png_bytes())
    assert result.checked is False and result.reason == "no_snapshot"


def test_verify_submit_face_model_version_mismatch_skips(settings):
    settings.DEPO = {**settings.DEPO, "REVERIFY_ON_SUBMIT": "block"}
    from apps.assessments.services import verify_submit_face

    emp = EmployeeFactory()
    session = TestSession.objects.create(
        employee=emp, module="specialty", total=10,
        face_embedding_snapshot=[0.1] * 512, face_embedding_model_version="arcface-buffalo_sc-512",
    )
    result = verify_submit_face(session, png_bytes())  # active backend is mock-16
    assert result.checked is False and result.reason == "model_mismatch"


# --------------------------------------------------------------------------- #
# Task 5: serializer behaviour
# --------------------------------------------------------------------------- #


def test_session_serializer_exposes_reverify_flag(settings):
    from apps.assessments.serializers import TestSessionSerializer

    settings.DEPO = {**settings.DEPO, "REVERIFY_ON_SUBMIT": "block"}
    emp = EmployeeFactory()
    session = TestSession.objects.create(employee=emp, module="specialty", total=10)
    data = TestSessionSerializer(session).data
    assert data["requires_submit_reverify"] is True
    assert data["submit_face_verified"] is None

    settings.DEPO = {**settings.DEPO, "REVERIFY_ON_SUBMIT": "off"}
    assert TestSessionSerializer(session).data["requires_submit_reverify"] is False


def test_submit_serializer_accepts_optional_face_image():
    from apps.assessments.serializers import SubmitTestSessionSerializer

    s = SubmitTestSessionSerializer(
        data={"answers": [{"question": 1, "selected_option": 0}], "face_image": "AAAA"}
    )
    assert s.is_valid(), s.errors
    assert s.validated_data["face_image"] == "AAAA"

    s2 = SubmitTestSessionSerializer(data={"answers": [{"question": 1, "selected_option": 0}]})
    assert s2.is_valid(), s2.errors  # face_image optional


# --------------------------------------------------------------------------- #
# Task 6: submit API matrix
# --------------------------------------------------------------------------- #


@pytest.fixture
def employee_with_bank(db):
    specialty = SpecialtyFactory()
    employee = EmployeeFactory(specialty=specialty)
    QuestionFactory.create_batch(12, specialty=specialty)
    return employee


def _start(client, employee):
    from django.core.files.uploadedfile import SimpleUploadedFile

    frame = SimpleUploadedFile("frame.png", png_bytes(), content_type="image/png")
    return client.post(
        f"{SESSIONS_URL}start/",
        {"employee": employee.id, "module": "specialty", "face_image": frame},
        format="multipart",
    )


def _answers(questions):
    return [{"question": q["id"], "selected_option": 0} for q in questions]


def _b64(frame_bytes):
    return base64.b64encode(frame_bytes).decode()


def _submit(client, session_id, questions, face_b64=None):
    payload = {"answers": _answers(questions)}
    if face_b64 is not None:
        payload["face_image"] = face_b64
    return client.post(f"{SESSIONS_URL}{session_id}/submit/", payload, format="json")


def test_submit_block_match_succeeds(specialist_client, employee_with_bank, settings):
    settings.DEPO = {**settings.DEPO, "REVERIFY_ON_SUBMIT": "block"}
    start = _start(specialist_client, employee_with_bank)
    sid, questions = start.data["session"]["id"], start.data["questions"]
    resp = _submit(specialist_client, sid, questions, _b64(png_bytes()))
    assert resp.status_code == 200, resp.data
    assert resp.data["submit_face_verified"] is True


def test_submit_block_mismatch_403_keeps_session_open(specialist_client, employee_with_bank, settings):
    settings.DEPO = {**settings.DEPO, "REVERIFY_ON_SUBMIT": "block"}
    start = _start(specialist_client, employee_with_bank)
    sid, questions = start.data["session"]["id"], start.data["questions"]

    resp = _submit(specialist_client, sid, questions, _b64(png_bytes() + b"FAILMATCH"))
    assert resp.status_code == 403
    assert resp.data["code"] == "face_reverify_failed"
    session = TestSession.objects.get(id=sid)
    assert session.finished_at is None and session.score is None  # untouched

    # Retry with a matching frame succeeds.
    ok = _submit(specialist_client, sid, questions, _b64(png_bytes()))
    assert ok.status_code == 200


def test_submit_block_missing_capture_400(specialist_client, employee_with_bank, settings):
    settings.DEPO = {**settings.DEPO, "REVERIFY_ON_SUBMIT": "block"}
    start = _start(specialist_client, employee_with_bank)
    sid, questions = start.data["session"]["id"], start.data["questions"]
    resp = _submit(specialist_client, sid, questions, face_b64=None)
    assert resp.status_code == 400
    assert resp.data["code"] == "face_capture_required"


def test_submit_log_mismatch_scores_but_flags(specialist_client, employee_with_bank, settings):
    settings.DEPO = {**settings.DEPO, "REVERIFY_ON_SUBMIT": "log"}
    start = _start(specialist_client, employee_with_bank)
    sid, questions = start.data["session"]["id"], start.data["questions"]
    resp = _submit(specialist_client, sid, questions, _b64(png_bytes() + b"FAILMATCH"))
    assert resp.status_code == 200
    assert resp.data["submit_face_verified"] is False
    assert resp.data["finished_at"] is not None


def test_submit_off_ignores_image(specialist_client, employee_with_bank, settings):
    settings.DEPO = {**settings.DEPO, "REVERIFY_ON_SUBMIT": "off"}
    start = _start(specialist_client, employee_with_bank)
    sid, questions = start.data["session"]["id"], start.data["questions"]
    resp = _submit(specialist_client, sid, questions, face_b64=None)
    assert resp.status_code == 200
    assert FaceVerificationLog.objects.filter(stage="submit").count() == 0


def test_submit_invalid_base64_400(specialist_client, employee_with_bank, settings):
    settings.DEPO = {**settings.DEPO, "REVERIFY_ON_SUBMIT": "block"}
    start = _start(specialist_client, employee_with_bank)
    sid, questions = start.data["session"]["id"], start.data["questions"]
    resp = _submit(specialist_client, sid, questions, face_b64="!!!not-base64!!!")
    assert resp.status_code == 400
    assert resp.data["code"] == "invalid_image"
