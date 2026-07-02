import pytest

from apps.surveys.models import Answer, Question, SurveySession
from apps.surveys.services import (
    FaceVerificationError,
    SurveyFlowError,
    admin_fill,
    start_survey_session,
    submit_survey_session,
)

from .conftest import png_bytes
from .factories import (
    EmployeeFactory,
    QuestionBlockFactory,
    QuestionFactory,
    TestFactory,
    UserFactory,
)

pytestmark = pytest.mark.django_db


def _survey_with_questions():
    survey = TestFactory()
    block = QuestionBlockFactory(test=survey, order=0)
    q_single = QuestionFactory(
        block=block,
        type=Question.Type.SINGLE,
        order=0,
        options=[{"id": "a", "text": "Yes"}, {"id": "b", "text": "No"}],
    )
    q_text = QuestionFactory(
        block=block, type=Question.Type.TEXTAREA, order=1, options=[]
    )
    return survey, q_single, q_text


def test_start_creates_session_and_freezes_questions():
    emp = EmployeeFactory()
    survey, q_single, q_text = _survey_with_questions()
    session, questions = start_survey_session(
        employee=emp, test=survey, face_image_bytes=png_bytes()
    )
    assert session.face_verified is True
    assert session.face_embedding == emp.face_embedding
    assert session.model_version == "mock-16"
    assert {q.id for q in questions} == {q_single.id, q_text.id}
    # Presented set frozen as empty Answer rows.
    assert Answer.objects.filter(session=session).count() == 2


def test_start_face_failure_creates_no_session():
    emp = EmployeeFactory()
    survey, _, _ = _survey_with_questions()
    with pytest.raises(FaceVerificationError):
        start_survey_session(
            employee=emp, test=survey, face_image_bytes=png_bytes() + b"FAILMATCH"
        )
    assert SurveySession.objects.count() == 0


def test_start_without_embedding_is_flow_error():
    emp = EmployeeFactory(face_embedding=None)
    survey, _, _ = _survey_with_questions()
    with pytest.raises(SurveyFlowError):
        start_survey_session(
            employee=emp, test=survey, face_image_bytes=png_bytes()
        )


def test_submit_persists_answers_and_completes():
    emp = EmployeeFactory()
    survey, q_single, q_text = _survey_with_questions()
    session, _ = start_survey_session(
        employee=emp, test=survey, face_image_bytes=png_bytes()
    )
    session = submit_survey_session(
        session=session,
        answers=[
            {"question": q_single.id, "selectedOptionIds": ["a"], "textValue": ""},
            {"question": q_text.id, "selectedOptionIds": [], "textValue": "Great"},
        ],
    )
    assert session.completed_at is not None
    single_answer = Answer.objects.get(session=session, question=q_single)
    text_answer = Answer.objects.get(session=session, question=q_text)
    assert single_answer.selected_option_ids == ["a"]
    assert text_answer.text_value == "Great"


def test_submit_rejects_already_completed():
    emp = EmployeeFactory()
    survey, q_single, _ = _survey_with_questions()
    session, _ = start_survey_session(
        employee=emp, test=survey, face_image_bytes=png_bytes()
    )
    submit_survey_session(
        session=session,
        answers=[{"question": q_single.id, "selectedOptionIds": ["a"], "textValue": ""}],
    )
    with pytest.raises(SurveyFlowError):
        submit_survey_session(
            session=session,
            answers=[{"question": q_single.id, "selectedOptionIds": ["b"], "textValue": ""}],
        )


def test_submit_rejects_foreign_question():
    emp = EmployeeFactory()
    survey, q_single, _ = _survey_with_questions()
    other = QuestionFactory()
    session, _ = start_survey_session(
        employee=emp, test=survey, face_image_bytes=png_bytes()
    )
    with pytest.raises(SurveyFlowError):
        submit_survey_session(
            session=session,
            answers=[{"question": other.id, "selectedOptionIds": ["a"], "textValue": ""}],
        )


def test_admin_fill_creates_completed_session_without_face():
    emp = EmployeeFactory(face_embedding=None)  # no face needed
    admin = UserFactory()
    survey, q_single, q_text = _survey_with_questions()
    session = admin_fill(
        employee=emp,
        test=survey,
        user=admin,
        answers=[
            {"question": q_single.id, "selectedOptionIds": ["b"], "textValue": ""},
            {"question": q_text.id, "selectedOptionIds": [], "textValue": "ok"},
        ],
    )
    assert session.completed_at is not None
    assert session.created_by == admin
    assert session.face_verified is False
    assert Answer.objects.filter(session=session).count() == 2
