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
                    {"question": q_single.id, "selected_option_ids": [choice]},
                    {"question": q_text.id, "text_value": comment},
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


@pytest.fixture
def rated_survey(admin_client):
    """A survey covering every non-choice question type the results page must
    render: nps, scale5, short_text, form_field, signature_date, section_header."""
    survey = TestFactory(is_admin_conducted=True)
    block = QuestionBlockFactory(test=survey, title="Rating", order=0)
    q_header = QuestionFactory(block=block, type=Question.Type.SECTION_HEADER, order=0, options=[])
    q_nps = QuestionFactory(block=block, type=Question.Type.NPS, order=1, options=[])
    q_scale5 = QuestionFactory(block=block, type=Question.Type.SCALE5, order=2, options=[])
    q_short = QuestionFactory(block=block, type=Question.Type.SHORT_TEXT, order=3, options=[])
    q_form = QuestionFactory(block=block, type=Question.Type.FORM_FIELD, order=4, options=[])
    q_sig = QuestionFactory(block=block, type=Question.Type.SIGNATURE_DATE, order=5, options=[])

    def _fill(nps, scale5, short_text, form_field, name, date):
        emp = EmployeeFactory(face_embedding=None)
        admin_client.post(
            f"{SESSIONS}admin-fill/",
            {
                "employee": emp.id,
                "test": survey.id,
                "answers": [
                    {"question": q_nps.id, "text_value": str(nps)},
                    {"question": q_scale5.id, "text_value": str(scale5)},
                    {"question": q_short.id, "text_value": short_text},
                    {"question": q_form.id, "text_value": form_field},
                    {"question": q_sig.id, "text_value": f'{{"name": "{name}", "date": "{date}"}}'},
                ],
            },
            format="json",
        )

    _fill(9, 4, "Great tools", "Line cook", "Aziz", "2026-01-05")
    _fill(7, 4, "Bit slow at lunch", "Line cook", "Malika", "2026-01-06")
    return survey, q_header, q_nps, q_scale5, q_short, q_form, q_sig


def test_results_section_header_omitted(admin_client, rated_survey):
    survey, q_header, *_ = rated_survey
    resp = admin_client.get(f"{SESSIONS}results/?test={survey.id}")
    ids = {q["id"] for q in resp.data["blocks"][0]["questions"]}
    assert q_header.id not in ids


def test_results_nps_scale_distribution(admin_client, rated_survey):
    survey, _, q_nps, *_ = rated_survey
    resp = admin_client.get(f"{SESSIONS}results/?test={survey.id}")
    question = next(q for q in resp.data["blocks"][0]["questions"] if q["id"] == q_nps.id)
    scale = question["scale"]
    assert scale["min"] == 0 and scale["max"] == 10
    assert scale["counts"]["9"] == 1
    assert scale["counts"]["7"] == 1
    assert scale["responseCount"] == 2
    assert scale["average"] == 8.0


def test_results_short_text_and_form_field_are_listed(admin_client, rated_survey):
    survey, _, _, _, q_short, q_form, _ = rated_survey
    resp = admin_client.get(f"{SESSIONS}results/?test={survey.id}")
    questions = {q["id"]: q for q in resp.data["blocks"][0]["questions"]}
    assert set(questions[q_short.id]["textValues"]) == {"Great tools", "Bit slow at lunch"}
    assert questions[q_form.id]["textValues"] == ["Line cook", "Line cook"]


def test_results_signature_date_is_formatted(admin_client, rated_survey):
    survey, *_, q_sig = rated_survey
    resp = admin_client.get(f"{SESSIONS}results/?test={survey.id}")
    question = next(q for q in resp.data["blocks"][0]["questions"] if q["id"] == q_sig.id)
    assert set(question["textValues"]) == {"Aziz — 2026-01-05", "Malika — 2026-01-06"}


def test_export_includes_scale_and_text_rows(admin_client, rated_survey):
    survey, *_ = rated_survey
    resp = admin_client.get(f"{SESSIONS}export/?test={survey.id}")
    assert resp.status_code == 200
    assert resp["Content-Type"] == (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
