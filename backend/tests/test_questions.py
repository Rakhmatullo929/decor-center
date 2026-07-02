import pytest

from apps.assessments.models import Question

from .factories import QuestionFactory, SpecialtyFactory

pytestmark = pytest.mark.django_db

QUESTIONS_URL = "/api/v1/questions/"


def _payload(specialty_id=None, **overrides):
    payload = {
        "module": "specialty",
        "specialty": specialty_id,
        "text": "What is the maximum permitted speed?",
        "options": ["60 km/h", "80 km/h", "100 km/h", "120 km/h"],
        "correct_option": 1,
    }
    payload.update(overrides)
    return payload


def test_admin_creates_manual_question(admin_client):
    specialty = SpecialtyFactory()
    response = admin_client.post(QUESTIONS_URL, _payload(specialty.id), format="json")
    assert response.status_code == 201, response.data
    question = Question.objects.get(id=response.data["id"])
    assert question.source == Question.Source.MANUAL
    assert question.status == Question.Status.DRAFT


def test_options_must_be_exactly_four(admin_client):
    specialty = SpecialtyFactory()
    response = admin_client.post(
        QUESTIONS_URL, _payload(specialty.id, options=["A", "B", "C"]), format="json"
    )
    assert response.status_code == 400
    assert "options" in response.data


def test_specialty_required_for_professional_module(admin_client):
    response = admin_client.post(QUESTIONS_URL, _payload(None), format="json")
    assert response.status_code == 400
    assert "specialty" in response.data


def test_safety_question_must_not_have_specialty(admin_client):
    specialty = SpecialtyFactory()
    response = admin_client.post(
        QUESTIONS_URL, _payload(specialty.id, module="tech_safety"), format="json"
    )
    assert response.status_code == 400
    assert "specialty" in response.data


def test_safety_question_without_specialty_is_valid(admin_client):
    response = admin_client.post(
        QUESTIONS_URL, _payload(None, module="industrial_safety"), format="json"
    )
    assert response.status_code == 201, response.data


def test_approve_action(admin_client):
    question = QuestionFactory(status=Question.Status.DRAFT)
    response = admin_client.post(f"{QUESTIONS_URL}{question.id}/approve/")
    assert response.status_code == 200
    question.refresh_from_db()
    assert question.status == Question.Status.APPROVED


def test_question_bank_is_admin_only(specialist_client, medic_client):
    QuestionFactory()
    assert specialist_client.get(QUESTIONS_URL).status_code == 403
    assert medic_client.get(QUESTIONS_URL).status_code == 403
