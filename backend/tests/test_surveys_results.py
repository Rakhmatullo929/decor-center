import pytest

from apps.surveys.models import Question

from .factories import EmployeeFactory, QuestionBlockFactory, QuestionFactory, TestFactory

pytestmark = pytest.mark.django_db

SESSIONS = "/api/v1/survey-sessions/"


@pytest.fixture
def filled_survey(admin_client):
    survey = TestFactory(is_admin_conducted=True)
    block = QuestionBlockFactory(test=survey, title="Feedback", order=0)
    q_single = QuestionFactory(
        block=block, type=Question.Type.SINGLE, order=0,
        options=[{"id": "a", "text": "Yes"}, {"id": "b", "text": "No"}],
    )
    q_text = QuestionFactory(block=block, type=Question.Type.TEXTAREA, order=1, options=[])
    # Two employees answer via admin-fill (no Face-ID).
    for choice, comment in (("a", "Loved it"), ("a", "")):
        emp = EmployeeFactory(face_embedding=None)
        admin_client.post(
            f"{SESSIONS}admin-fill/",
            {
                "employee": emp.id,
                "test": survey.id,
                "answers": [
                    {"question": q_single.id, "selectedOptionIds": [choice]},
                    {"question": q_text.id, "textValue": comment},
                ],
            },
            format="json",
        )
    return survey, q_single, q_text


def test_results_option_counts(admin_client, filled_survey):
    survey, q_single, _ = filled_survey
    resp = admin_client.get(f"{SESSIONS}results/?test={survey.id}")
    assert resp.status_code == 200
    question = resp.data["blocks"][0]["questions"][0]
    counts = {opt["id"]: opt["count"] for opt in question["options"]}
    assert counts == {"a": 2, "b": 0}


def test_results_textarea_list(admin_client, filled_survey):
    survey, _, q_text = filled_survey
    resp = admin_client.get(f"{SESSIONS}results/?test={survey.id}")
    text_question = resp.data["blocks"][0]["questions"][1]
    assert text_question["type"] == "textarea"
    assert text_question["textValues"] == ["Loved it"]  # empty comment excluded
    assert text_question["responseCount"] == 1


def test_results_requires_test_param(admin_client):
    assert admin_client.get(f"{SESSIONS}results/").status_code == 400
