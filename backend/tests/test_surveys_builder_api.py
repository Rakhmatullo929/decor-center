import pytest

from apps.surveys.models import Question

from .factories import EmployeeFactory, QuestionBlockFactory, QuestionFactory, TestFactory

pytestmark = pytest.mark.django_db

BLOCKS = "/api/v1/question-blocks/"
QUESTIONS = "/api/v1/questions/"


# --- block reorder -----------------------------------------------------------

def test_block_reorder_admin_only(employee_client, admin_client):
    survey = TestFactory()
    b1 = QuestionBlockFactory(test=survey, order=0)
    b2 = QuestionBlockFactory(test=survey, order=1)
    payload = {"test": survey.id, "order": [b2.id, b1.id]}
    assert employee_client.post(f"{BLOCKS}reorder/", payload, format="json").status_code == 403

    resp = admin_client.post(f"{BLOCKS}reorder/", payload, format="json")
    assert resp.status_code == 200, resp.data
    b1.refresh_from_db()
    b2.refresh_from_db()
    assert (b2.order, b1.order) == (0, 1)


def test_block_reorder_rejects_mismatched_ids(admin_client):
    survey = TestFactory()
    b1 = QuestionBlockFactory(test=survey, order=0)
    other = QuestionBlockFactory(order=0)  # belongs to a different test
    resp = admin_client.post(
        f"{BLOCKS}reorder/", {"test": survey.id, "order": [b1.id, other.id]}, format="json"
    )
    assert resp.status_code == 400


def test_block_reorder_rejects_duplicate_ids(admin_client):
    survey = TestFactory()
    b1 = QuestionBlockFactory(test=survey, order=0)
    b2 = QuestionBlockFactory(test=survey, order=1)
    # Same length as the real block count, but b2 is missing and b1 is duplicated —
    # a bare set() comparison would collapse the duplicate and miss this.
    resp = admin_client.post(
        f"{BLOCKS}reorder/", {"test": survey.id, "order": [b1.id, b1.id]}, format="json"
    )
    assert resp.status_code == 400
    b1.refresh_from_db()
    b2.refresh_from_db()
    assert (b1.order, b2.order) == (0, 1)


# --- question reorder within a block -----------------------------------------

def test_question_reorder_within_block(admin_client):
    block = QuestionBlockFactory()
    q1 = QuestionFactory(block=block, order=0)
    q2 = QuestionFactory(block=block, order=1)
    resp = admin_client.post(
        f"{QUESTIONS}reorder/", {"block": block.id, "order": [q2.id, q1.id]}, format="json"
    )
    assert resp.status_code == 200, resp.data
    q1.refresh_from_db()
    q2.refresh_from_db()
    assert (q2.order, q1.order) == (0, 1)


def test_question_reorder_rejects_duplicate_ids(admin_client):
    block = QuestionBlockFactory()
    q1 = QuestionFactory(block=block, order=0)
    q2 = QuestionFactory(block=block, order=1)
    resp = admin_client.post(
        f"{QUESTIONS}reorder/", {"block": block.id, "order": [q1.id, q1.id]}, format="json"
    )
    assert resp.status_code == 400
    q1.refresh_from_db()
    q2.refresh_from_db()
    assert (q1.order, q2.order) == (0, 1)


# --- question move across blocks ---------------------------------------------

def test_question_move_across_blocks(admin_client):
    survey = TestFactory()
    block_a = QuestionBlockFactory(test=survey, order=0)
    block_b = QuestionBlockFactory(test=survey, order=1)
    moving = QuestionFactory(block=block_a, order=0)
    staying_a = QuestionFactory(block=block_a, order=1)
    existing_b = QuestionFactory(block=block_b, order=0)

    resp = admin_client.post(
        f"{QUESTIONS}move/",
        {
            "question": moving.id,
            "target_block": block_b.id,
            "order": [moving.id, existing_b.id],
        },
        format="json",
    )
    assert resp.status_code == 200, resp.data

    moving.refresh_from_db()
    existing_b.refresh_from_db()
    staying_a.refresh_from_db()
    assert moving.block_id == block_b.id
    assert moving.order == 0
    assert existing_b.order == 1
    assert staying_a.block_id == block_a.id
    # The source block must not keep a gap where the moved question used to sit.
    assert staying_a.order == 0


def test_question_move_rejects_duplicate_ids(admin_client):
    survey = TestFactory()
    block_a = QuestionBlockFactory(test=survey, order=0)
    block_b = QuestionBlockFactory(test=survey, order=1)
    moving = QuestionFactory(block=block_a, order=0)
    existing_b = QuestionFactory(block=block_b, order=0)

    resp = admin_client.post(
        f"{QUESTIONS}move/",
        {"question": moving.id, "target_block": block_b.id, "order": [moving.id, moving.id]},
        format="json",
    )
    assert resp.status_code == 400
    moving.refresh_from_db()
    existing_b.refresh_from_db()
    # The rejected request must not have reassigned the question's block either.
    assert moving.block_id == block_a.id
    assert existing_b.order == 0


def test_question_move_cross_survey_rejected(admin_client):
    block_a = QuestionBlockFactory()  # its own Test
    other_survey_block = QuestionBlockFactory()  # a different Test
    moving = QuestionFactory(block=block_a, order=0)
    resp = admin_client.post(
        f"{QUESTIONS}move/",
        {"question": moving.id, "target_block": other_survey_block.id, "order": [moving.id]},
        format="json",
    )
    assert resp.status_code == 400


# --- text round-trip -----------------------------------------------------------

def test_question_text_round_trips_plain_string(admin_client):
    block = QuestionBlockFactory()
    payload = {
        "block": block.id,
        "type": "short_text",
        "text": "Текст вопроса",
        "options": [],
    }
    resp = admin_client.post(QUESTIONS, payload, format="json")
    assert resp.status_code == 201, resp.data
    assert resp.data["text"] == "Текст вопроса"


def test_block_title_round_trips_plain_string(admin_client):
    survey = TestFactory()
    payload = {"test": survey.id, "order": 0, "title": "Раздел"}
    resp = admin_client.post(BLOCKS, payload, format="json")
    assert resp.status_code == 201, resp.data
    assert resp.data["title"] == "Раздел"


# --- new question types -------------------------------------------------------

def test_nps_question_gets_default_scale_settings(admin_client):
    block = QuestionBlockFactory()
    payload = {
        "block": block.id,
        "type": Question.Type.NPS,
        "text": "Порекомендуете?",
        "options": [],
    }
    resp = admin_client.post(QUESTIONS, payload, format="json")
    assert resp.status_code == 201, resp.data
    assert resp.data["settings"]["min"] == 0
    assert resp.data["settings"]["max"] == 10


def test_scale5_question_gets_default_scale_settings(admin_client):
    block = QuestionBlockFactory()
    payload = {
        "block": block.id,
        "type": Question.Type.SCALE5,
        "text": "Satisfaction",
        "options": [],
        "settings": {"left_label": "Плохо", "right_label": "Отлично"},
    }
    resp = admin_client.post(QUESTIONS, payload, format="json")
    assert resp.status_code == 201, resp.data
    assert resp.data["settings"]["min"] == 1
    assert resp.data["settings"]["max"] == 5
    assert resp.data["settings"]["left_label"] == "Плохо"


def test_section_header_rejects_options(admin_client):
    block = QuestionBlockFactory()
    payload = {
        "block": block.id,
        "type": Question.Type.SECTION_HEADER,
        "text": "II. LOYALTY",
        "options": [{"id": "a", "text": "no"}],
    }
    resp = admin_client.post(QUESTIONS, payload, format="json")
    assert resp.status_code == 400
    assert "options" in resp.data


def test_is_required_and_mind_dive_flags_roundtrip(admin_client):
    block = QuestionBlockFactory()
    payload = {
        "block": block.id,
        "type": Question.Type.TEXTAREA,
        "text": "What would you change?",
        "options": [],
        "is_required": True,
        "is_mind_dive": True,
    }
    resp = admin_client.post(QUESTIONS, payload, format="json")
    assert resp.status_code == 201, resp.data
    assert resp.data["is_required"] is True
    assert resp.data["is_mind_dive"] is True


# --- kiosk-facing shape stays a flat string -----------------------------------

def test_kiosk_start_returns_flat_text(face_image):
    from rest_framework.test import APIClient

    from apps.accounts.tokens import issue_token_pair
    from apps.employees.services import get_or_create_employee_user

    survey = TestFactory()
    block = QuestionBlockFactory(test=survey, title="Блок")
    QuestionFactory(
        block=block,
        type=Question.Type.SINGLE,
        text="Вопрос?",
        options=[{"id": "a", "text": "Да"}, {"id": "b", "text": "Нет"}],
    )
    emp = EmployeeFactory()
    face_image.seek(0)
    client = APIClient()
    tokens = issue_token_pair(get_or_create_employee_user(emp))
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    resp = client.post(
        "/api/v1/survey-sessions/start/",
        {"employee": emp.id, "test": survey.id, "face_image": face_image},
        format="multipart",
    )
    assert resp.status_code == 201, resp.data
    block_out = resp.data["blocks"][0]
    assert block_out["title"] == "Блок"
    question_out = block_out["questions"][0]
    assert question_out["text"] == "Вопрос?"
    assert {opt["text"] for opt in question_out["options"]} == {"Да", "Нет"}
