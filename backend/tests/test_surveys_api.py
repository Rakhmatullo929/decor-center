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


@pytest.fixture
def survey_with_questions(db):
    survey = TestFactory()
    block = QuestionBlockFactory(test=survey, order=0)
    q_single = QuestionFactory(
        block=block, type=Question.Type.SINGLE, order=0,
        options=[{"id": "a", "text": "Yes"}, {"id": "b", "text": "No"}],
    )
    q_text = QuestionFactory(block=block, type=Question.Type.TEXTAREA, order=1, options=[])
    return survey, q_single, q_text


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

def test_start_returns_blocks_and_questions(survey_with_questions, face_image):
    survey, q_single, q_text = survey_with_questions
    emp = EmployeeFactory()
    face_image.seek(0)
    resp = kiosk_client(emp.id).post(
        f"{SESSIONS}start/",
        {"employee": emp.id, "test": survey.id, "face_image": face_image},
        format="multipart",
    )
    assert resp.status_code == 201, resp.data
    assert resp.data["test"]["id"] == survey.id
    questions = resp.data["blocks"][0]["questions"]
    assert {q["id"] for q in questions} == {q_single.id, q_text.id}
    assert resp.data["session"]["face_verified"] is True


def test_start_face_failure_403(survey_with_questions, face_image_fail):
    survey, _, _ = survey_with_questions
    emp = EmployeeFactory()
    face_image_fail.seek(0)
    resp = kiosk_client(emp.id).post(
        f"{SESSIONS}start/",
        {"employee": emp.id, "test": survey.id, "face_image": face_image_fail},
        format="multipart",
    )
    assert resp.status_code == 403
    assert SurveySession.objects.count() == 0


# --- submit -----------------------------------------------------------------

def _start(client, survey, emp, face_image):
    face_image.seek(0)
    return client.post(
        f"{SESSIONS}start/",
        {"employee": emp.id, "test": survey.id, "face_image": face_image},
        format="multipart",
    )


def test_submit_persists_answers(survey_with_questions, face_image):
    survey, q_single, q_text = survey_with_questions
    emp = EmployeeFactory()
    client = kiosk_client(emp.id)
    start = _start(client, survey, emp, face_image)
    session_id = start.data["session"]["id"]
    resp = client.post(
        f"{SESSIONS}{session_id}/submit/",
        {"answers": [
            {"question": q_single.id, "selectedOptionIds": ["a"]},
            {"question": q_text.id, "textValue": "Nice"},
        ]},
        format="json",
    )
    assert resp.status_code == 200, resp.data
    assert resp.data["completed_at"] is not None
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
        "answers": [{"question": q_single.id, "selectedOptionIds": ["b"]}],
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
