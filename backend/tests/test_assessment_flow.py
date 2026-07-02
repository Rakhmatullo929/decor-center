import pytest

from apps.assessments.models import FaceVerificationLog, Question, TestSession

from .factories import EmployeeFactory, QuestionFactory, SpecialtyFactory

pytestmark = pytest.mark.django_db

SESSIONS_URL = "/api/v1/test-sessions/"


@pytest.fixture
def employee_with_bank(db):
    specialty = SpecialtyFactory()
    employee = EmployeeFactory(specialty=specialty)
    QuestionFactory.create_batch(12, specialty=specialty)
    return employee


def _start(client, employee, face_image, module="specialty"):
    # The multipart encoder consumes the upload buffer, so a test that calls
    # _start more than once with the same fixture must rewind it first —
    # otherwise the second POST sends an empty file (ImageField → 400).
    face_image.seek(0)
    return client.post(
        f"{SESSIONS_URL}start/",
        {"employee": employee.id, "module": module, "face_image": face_image},
        format="multipart",
    )


def test_start_session_after_face_id(specialist_client, employee_with_bank, face_image):
    response = _start(specialist_client, employee_with_bank, face_image)
    assert response.status_code == 201, response.data

    assert len(response.data["questions"]) == 10
    assert response.data["session"]["face_verified"] is True
    assert response.data["session"]["total"] == 10
    # Correct answers must never leak to the test taker.
    assert "correct_option" not in response.data["questions"][0]

    log = FaceVerificationLog.objects.get(employee=employee_with_bank)
    assert log.success is True


def test_face_id_failure_blocks_test_and_is_logged(
    specialist_client, employee_with_bank, face_image_fail
):
    response = _start(specialist_client, employee_with_bank, face_image_fail)
    assert response.status_code == 403
    assert TestSession.objects.count() == 0
    log = FaceVerificationLog.objects.get(employee=employee_with_bank)
    assert log.success is False


def test_insufficient_question_bank_rejected(specialist_client, face_image):
    employee = EmployeeFactory()  # no questions for this specialty
    response = _start(specialist_client, employee, face_image)
    assert response.status_code == 400
    assert TestSession.objects.count() == 0


def test_employee_without_reference_photo_is_misconfiguration_not_face_failure(
    specialist_client, face_image
):
    """Missing embedding is an admin problem (400), not a Face ID mismatch (403)."""
    employee = EmployeeFactory(face_embedding=None)
    response = _start(specialist_client, employee, face_image)
    assert response.status_code == 400
    assert TestSession.objects.count() == 0


def test_submit_computes_score_and_pass(specialist_client, employee_with_bank, face_image):
    start = _start(specialist_client, employee_with_bank, face_image)
    session_id = start.data["session"]["id"]
    questions = start.data["questions"]

    correct = {q.id: q.correct_option for q in Question.objects.all()}
    # 8 correct answers, 2 wrong -> passed with default threshold 8.
    answers = []
    for index, question in enumerate(questions):
        right = correct[question["id"]]
        answers.append(
            {"question": question["id"], "selected_option": right if index < 8 else (right + 1) % 4}
        )

    response = specialist_client.post(
        f"{SESSIONS_URL}{session_id}/submit/", {"answers": answers}, format="json"
    )
    assert response.status_code == 200, response.data
    assert response.data["score"] == 8
    assert response.data["passed"] is True
    assert response.data["finished_at"] is not None


def test_submit_below_threshold_fails(specialist_client, employee_with_bank, face_image):
    start = _start(specialist_client, employee_with_bank, face_image)
    session_id = start.data["session"]["id"]
    questions = start.data["questions"]

    correct = {q.id: q.correct_option for q in Question.objects.all()}
    answers = [
        {"question": q["id"], "selected_option": (correct[q["id"]] + 1) % 4} for q in questions
    ]
    response = specialist_client.post(
        f"{SESSIONS_URL}{session_id}/submit/", {"answers": answers}, format="json"
    )
    assert response.status_code == 200
    assert response.data["score"] == 0
    assert response.data["passed"] is False


def test_resubmission_is_rejected(specialist_client, employee_with_bank, face_image):
    start = _start(specialist_client, employee_with_bank, face_image)
    session_id = start.data["session"]["id"]
    answers = [{"question": q["id"], "selected_option": 0} for q in start.data["questions"]]

    first = specialist_client.post(
        f"{SESSIONS_URL}{session_id}/submit/", {"answers": answers}, format="json"
    )
    assert first.status_code == 200
    second = specialist_client.post(
        f"{SESSIONS_URL}{session_id}/submit/", {"answers": answers}, format="json"
    )
    assert second.status_code == 400


def test_submit_must_cover_presented_questions(specialist_client, employee_with_bank, face_image):
    start = _start(specialist_client, employee_with_bank, face_image)
    session_id = start.data["session"]["id"]
    answers = [
        {"question": q["id"], "selected_option": 0} for q in start.data["questions"][:5]
    ]
    response = specialist_client.post(
        f"{SESSIONS_URL}{session_id}/submit/", {"answers": answers}, format="json"
    )
    assert response.status_code == 400


def test_only_approved_questions_are_used(specialist_client, face_image):
    specialty = SpecialtyFactory()
    employee = EmployeeFactory(specialty=specialty)
    QuestionFactory.create_batch(10, specialty=specialty)
    QuestionFactory.create_batch(5, specialty=specialty, status=Question.Status.DRAFT)

    response = _start(specialist_client, employee, face_image)
    assert response.status_code == 201
    returned_ids = {q["id"] for q in response.data["questions"]}
    draft_ids = set(
        Question.objects.filter(status=Question.Status.DRAFT).values_list("id", flat=True)
    )
    assert not returned_ids & draft_ids


def test_safety_module_uses_safety_bank(specialist_client, face_image):
    employee = EmployeeFactory()
    # Mixed bank: specialty questions for this employee AND safety questions of both areas.
    QuestionFactory.create_batch(10, specialty=employee.specialty)
    QuestionFactory.create_batch(10, module="tech_safety", specialty=None)
    QuestionFactory.create_batch(10, module="industrial_safety", specialty=None)

    response = _start(specialist_client, employee, face_image, module="tech_safety")
    assert response.status_code == 201
    assert response.data["session"]["module"] == "tech_safety"
    assert response.data["session"]["specialty"] is None

    # Only tech_safety questions may be selected — no leakage from other banks.
    returned_ids = {q["id"] for q in response.data["questions"]}
    tech_safety_ids = set(
        Question.objects.filter(module="tech_safety").values_list("id", flat=True)
    )
    assert returned_ids <= tech_safety_ids
    assert all(q["module"] == "tech_safety" for q in response.data["questions"])


def test_results_browsing_is_admin_only(specialist_client, medic_client, admin_client):
    assert specialist_client.get(SESSIONS_URL).status_code == 403
    assert medic_client.get(SESSIONS_URL).status_code == 403
    assert admin_client.get(SESSIONS_URL).status_code == 200


def test_session_detail_is_admin_only(
    specialist_client, admin_client, employee_with_bank, face_image
):
    """SRS §3.2: specialist result visibility is limited to the post-test screen."""
    start = _start(specialist_client, employee_with_bank, face_image)
    session_id = start.data["session"]["id"]
    answers = [{"question": q["id"], "selected_option": 0} for q in start.data["questions"]]
    specialist_client.post(f"{SESSIONS_URL}{session_id}/submit/", {"answers": answers}, format="json")

    assert specialist_client.get(f"{SESSIONS_URL}{session_id}/").status_code == 403

    detail = admin_client.get(f"{SESSIONS_URL}{session_id}/")
    assert detail.status_code == 200
    assert len(detail.data["answers"]) == 10
    assert all("is_correct" in answer for answer in detail.data["answers"])


def test_second_attempt_same_module_same_day_is_blocked(
    specialist_client, employee_with_bank, face_image, face_image_fail
):
    """One attempt per module per day (SRS §15.3): a started session locks the module."""
    first = _start(specialist_client, employee_with_bank, face_image)
    assert first.status_code == 201

    second = _start(specialist_client, employee_with_bank, face_image)
    assert second.status_code == 409
    assert second.data["code"] == "daily_limit"
    # No new session and no extra Face ID attempt: the daily gate runs before Face ID.
    assert TestSession.objects.filter(employee=employee_with_bank).count() == 1
    assert FaceVerificationLog.objects.filter(employee=employee_with_bank).count() == 1


def test_daily_limit_is_per_module(specialist_client, face_image):
    """A used-up module must not lock the other modules for the same employee."""
    employee = EmployeeFactory()
    QuestionFactory.create_batch(10, specialty=employee.specialty)
    QuestionFactory.create_batch(10, module="tech_safety", specialty=None)

    assert _start(specialist_client, employee, face_image, module="specialty").status_code == 201
    # Same employee, different module on the same day is still allowed.
    assert _start(specialist_client, employee, face_image, module="tech_safety").status_code == 201
    # ...but the specialty module is now locked for today.
    assert _start(specialist_client, employee, face_image, module="specialty").status_code == 409


def test_medic_cannot_start_test(medic_client, employee_with_bank, face_image):
    response = _start(medic_client, employee_with_bank, face_image)
    assert response.status_code == 403
