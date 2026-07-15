import datetime

import pytest
from rest_framework.test import APIClient

from apps.accounts.tokens import issue_token_pair
from apps.employees.models import Employee
from apps.employees.services import get_or_create_employee_user
from apps.surveys.models import Answer, Question, SurveySession

from .factories import (
    EmployeeFactory,
    QuestionBlockFactory,
    QuestionFactory,
    TestFactory,
)

pytestmark = pytest.mark.django_db

SESSIONS = "/api/v1/survey-sessions/"
TESTS = "/api/v1/tests/"


def kiosk_client(employee_id, *, fallback=False):
    """A client authenticated as the given employee, as verify-otp would leave it post-OTP."""
    user = get_or_create_employee_user(Employee.objects.get(pk=employee_id))
    tokens = issue_token_pair(user, extra_claims={"kiosk_fallback": fallback})
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    return client


# --- RBAC on CRUD -----------------------------------------------------------

def test_tests_list_not_readable_by_employee(employee_client):
    # The admin builder's Test/QuestionBlock/Question serializers include full
    # bilingual question content ahead of time — employees must not read it here;
    # they get survey content only via SurveySessionViewSet.start's public serializer.
    assert employee_client.get(TESTS).status_code == 403


def test_tests_write_admin_only(employee_client, admin_client):
    payload = {"title": "New"}
    assert employee_client.post(TESTS, payload, format="json").status_code == 403
    assert admin_client.post(TESTS, payload, format="json").status_code == 201


def test_question_write_requires_admin(employee_client, admin_client):
    block = QuestionBlockFactory()
    payload = {"block": block.id, "type": "textarea", "text": "Q", "options": []}
    assert employee_client.post("/api/v1/questions/", payload, format="json").status_code == 403
    assert admin_client.post("/api/v1/questions/", payload, format="json").status_code == 201


# --- identify ---------------------------------------------------------------

def test_identify_returns_employee(employee_client, face_image):
    emp = EmployeeFactory()
    face_image.seek(0)
    resp = employee_client.post(
        f"{SESSIONS}identify/", {"face_image": face_image}, format="multipart"
    )
    assert resp.status_code == 200, resp.data
    assert resp.data["employee"]["id"] == emp.id


def test_identify_unknown_face_404(employee_client, face_image_fail):
    EmployeeFactory()
    face_image_fail.seek(0)
    resp = employee_client.post(
        f"{SESSIONS}identify/", {"face_image": face_image_fail}, format="multipart"
    )
    assert resp.status_code == 404


# --- due --------------------------------------------------------------------

def test_due_lists_scheduled_surveys():
    emp = EmployeeFactory(hire_date=datetime.date(2026, 6, 1))
    survey = TestFactory(is_after_application=True, after_days=1)
    resp = kiosk_client(emp.id).get(f"{SESSIONS}due/?employee={emp.id}")
    assert resp.status_code == 200
    assert survey.id in [t["id"] for t in resp.data]


# --- start ------------------------------------------------------------------

def _start(client, survey, emp):
    return client.post(
        f"{SESSIONS}start/", {"employee": emp.id, "test": survey.id}, format="json"
    )


def test_start_returns_blocks_and_questions(survey_with_questions):
    survey, q_single, q_text = survey_with_questions
    emp = EmployeeFactory()
    resp = _start(kiosk_client(emp.id), survey, emp)
    assert resp.status_code == 201, resp.data
    assert resp.data["test"]["id"] == survey.id
    questions = resp.data["blocks"][0]["questions"]
    assert {q["id"] for q in questions} == {q_single.id, q_text.id}
    assert resp.data["session"]["status"] == "in_progress"


def test_start_does_not_require_a_camera_frame(survey_with_questions):
    """Face-ID happens once at kiosk entry (identify + OTP); starting an individual
    test relies on the JWT session and never asks for another frame."""
    survey, _, _ = survey_with_questions
    emp = EmployeeFactory(face_embedding=None)  # no reference photo at all
    resp = _start(kiosk_client(emp.id), survey, emp)
    assert resp.status_code == 201, resp.data


def test_start_is_idempotent_over_api(survey_with_questions):
    """Calling start twice for the same (employee, test) resumes the same session —
    no duplicate SurveySession, second call returns 200 instead of 201."""
    survey, _, _ = survey_with_questions
    emp = EmployeeFactory()
    client = kiosk_client(emp.id)
    first = _start(client, survey, emp)
    second = _start(client, survey, emp)
    assert first.status_code == 201
    assert second.status_code == 200
    assert second.data["session"]["id"] == first.data["session"]["id"]
    assert SurveySession.objects.filter(employee=emp, test=survey).count() == 1


# --- answer (autosave) -------------------------------------------------------

def test_answer_autosaves_without_completing(survey_with_questions):
    survey, q_single, _ = survey_with_questions
    emp = EmployeeFactory()
    client = kiosk_client(emp.id)
    session_id = _start(client, survey, emp).data["session"]["id"]

    resp = client.post(
        f"{SESSIONS}{session_id}/answer/",
        {"question": q_single.id, "selected_option_ids": ["a"]},
        format="json",
    )
    assert resp.status_code == 200, resp.data
    assert Answer.objects.get(session_id=session_id, question=q_single).selected_option_ids == ["a"]
    assert SurveySession.objects.get(pk=session_id).completed_at is None


def test_answer_rejects_employee_mismatch(survey_with_questions):
    survey, q_single, _ = survey_with_questions
    emp = EmployeeFactory()
    other = EmployeeFactory()
    session_id = _start(kiosk_client(emp.id), survey, emp).data["session"]["id"]
    resp = kiosk_client(other.id).post(
        f"{SESSIONS}{session_id}/answer/",
        {"question": q_single.id, "selected_option_ids": ["a"]},
        format="json",
    )
    assert resp.status_code == 403


# --- in-progress --------------------------------------------------------------

def test_in_progress_lists_only_own_unfinished_sessions(survey_with_questions):
    survey, _, _ = survey_with_questions
    emp = EmployeeFactory()
    other = EmployeeFactory()
    client = kiosk_client(emp.id)
    started = _start(client, survey, emp).data["session"]["id"]
    _start(kiosk_client(other.id), survey, other)

    resp = client.get(f"{SESSIONS}in-progress/?employee={emp.id}")
    assert resp.status_code == 200, resp.data
    assert [s["id"] for s in resp.data] == [started]


# --- retrieve (resume) -------------------------------------------------------

def test_retrieve_own_session_includes_blocks_for_resume(survey_with_questions):
    survey, q_single, q_text = survey_with_questions
    emp = EmployeeFactory()
    client = kiosk_client(emp.id)
    session_id = _start(client, survey, emp).data["session"]["id"]
    client.post(
        f"{SESSIONS}{session_id}/answer/",
        {"question": q_single.id, "selected_option_ids": ["a"]},
        format="json",
    )

    resp = client.get(f"{SESSIONS}{session_id}/")
    assert resp.status_code == 200, resp.data
    assert {q["id"] for q in resp.data["blocks"][0]["questions"]} == {q_single.id, q_text.id}
    assert {a["question"] for a in resp.data["answers"]} == {q_single.id, q_text.id}


def test_resume_ignores_question_added_to_test_after_session_started(survey_with_questions):
    """An admin editing the test (adding a question) after an employee's session has
    already started must not strand that session — resume must keep showing exactly
    the frozen question set, not the test's live definition."""
    survey, q_single, q_text = survey_with_questions
    emp = EmployeeFactory()
    client = kiosk_client(emp.id)
    session_id = _start(client, survey, emp).data["session"]["id"]

    # Admin adds a third question to the same block after the session started.
    new_question = QuestionFactory(block=q_single.block, type=Question.Type.SHORT_TEXT, order=2)

    resume = client.get(f"{SESSIONS}{session_id}/")
    assert resume.status_code == 200, resume.data
    resumed_ids = {q["id"] for q in resume.data["blocks"][0]["questions"]}
    assert resumed_ids == {q_single.id, q_text.id}
    assert new_question.id not in resumed_ids

    restart = _start(client, survey, emp)
    assert restart.status_code == 200, restart.data
    restarted_ids = {q["id"] for q in restart.data["blocks"][0]["questions"]}
    assert restarted_ids == {q_single.id, q_text.id}


def test_submit_succeeds_after_question_added_mid_session(survey_with_questions):
    """The employee must still be able to finish and submit a session that was started
    before an admin added a new question to the test."""
    survey, q_single, q_text = survey_with_questions
    emp = EmployeeFactory()
    client = kiosk_client(emp.id)
    session_id = _start(client, survey, emp).data["session"]["id"]

    QuestionFactory(block=q_single.block, type=Question.Type.SHORT_TEXT, order=2)

    resp = client.post(
        f"{SESSIONS}{session_id}/submit/",
        {"answers": [
            {"question": q_single.id, "selected_option_ids": ["a"]},
            {"question": q_text.id, "text_value": "Nice"},
        ]},
        format="json",
    )
    assert resp.status_code == 200, resp.data
    assert resp.data["status"] == "completed"


def test_retrieve_other_employees_session_is_forbidden(survey_with_questions):
    survey, _, _ = survey_with_questions
    emp = EmployeeFactory()
    other = EmployeeFactory()
    session_id = _start(kiosk_client(emp.id), survey, emp).data["session"]["id"]
    resp = kiosk_client(other.id).get(f"{SESSIONS}{session_id}/")
    assert resp.status_code == 403


# --- submit -----------------------------------------------------------------

def test_submit_persists_answers(survey_with_questions):
    survey, q_single, q_text = survey_with_questions
    emp = EmployeeFactory()
    client = kiosk_client(emp.id)
    start = _start(client, survey, emp)
    session_id = start.data["session"]["id"]
    resp = client.post(
        f"{SESSIONS}{session_id}/submit/",
        {"answers": [
            {"question": q_single.id, "selected_option_ids": ["a"]},
            {"question": q_text.id, "text_value": "Nice"},
        ]},
        format="json",
    )
    assert resp.status_code == 200, resp.data
    assert resp.data["completed_at"] is not None
    assert resp.data["status"] == "completed"
    assert Answer.objects.get(session=session_id, question=q_single).selected_option_ids == ["a"]
    assert Answer.objects.get(session=session_id, question=q_text).text_value == "Nice"


# --- admin-fill -------------------------------------------------------------

def test_admin_fill_requires_admin(employee_client, admin_client, survey_with_questions):
    survey, q_single, _ = survey_with_questions
    survey.is_admin_conducted = True
    survey.save()
    emp = EmployeeFactory(face_embedding=None)
    payload = {
        "employee": emp.id,
        "test": survey.id,
        "answers": [{"question": q_single.id, "selected_option_ids": ["b"]}],
    }
    assert employee_client.post(f"{SESSIONS}admin-fill/", payload, format="json").status_code == 403
    resp = admin_client.post(f"{SESSIONS}admin-fill/", payload, format="json")
    assert resp.status_code == 201, resp.data
    assert resp.data["face_verified"] is False


# --- results / export -------------------------------------------------------

def test_results_and_export_admin_only(employee_client, admin_client, survey_with_questions):
    survey, _, _ = survey_with_questions
    assert employee_client.get(f"{SESSIONS}results/?test={survey.id}").status_code == 403
    assert admin_client.get(f"{SESSIONS}results/?test={survey.id}").status_code == 200
    export = admin_client.get(f"{SESSIONS}export/?test={survey.id}")
    assert export.status_code == 200
    assert export["Content-Type"].startswith(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
