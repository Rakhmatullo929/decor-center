import pytest
from django.db import IntegrityError

from apps.surveys.models import Answer, Question, SurveySession, Test

from .factories import (
    QuestionBlockFactory,
    QuestionFactory,
    SurveySessionFactory,
    TestFactory,
)

pytestmark = pytest.mark.django_db


def test_test_defaults():
    survey = TestFactory()
    assert survey.is_active is True
    assert survey.is_admin_conducted is False
    assert survey.is_after_application is False
    assert survey.month == []


def test_after_application_requires_after_days():
    with pytest.raises(IntegrityError):
        Test.objects.create(title="Bad", is_after_application=True, after_days=None)


def test_after_application_with_after_days_ok():
    survey = Test.objects.create(title="OK", is_after_application=True, after_days=30)
    assert survey.after_days == 30


def test_question_type_choices_and_options_shape():
    block = QuestionBlockFactory()
    q = QuestionFactory(
        block=block,
        type=Question.Type.SINGLE,
        options=[{"id": "a", "text": "Yes"}, {"id": "b", "text": "No"}],
    )
    assert q.type == "single"
    assert q.options[0]["id"] == "a"


def test_block_and_question_ordering():
    survey = TestFactory()
    b2 = QuestionBlockFactory(test=survey, order=2)
    b1 = QuestionBlockFactory(test=survey, order=1)
    assert list(survey.blocks.all()) == [b1, b2]
    q2 = QuestionFactory(block=b1, order=2)
    q1 = QuestionFactory(block=b1, order=1)
    assert list(b1.questions.all()) == [q1, q2]


def test_answer_unique_per_session_question():
    session = SurveySessionFactory()
    question = QuestionFactory()
    Answer.objects.create(session=session, question=question)
    with pytest.raises(IntegrityError):
        Answer.objects.create(session=session, question=question)


def test_session_face_embedding_not_editable():
    field = SurveySession._meta.get_field("face_embedding")
    assert field.editable is False


def test_answer_polymorphic_payload_defaults():
    session = SurveySessionFactory()
    question = QuestionFactory(type=Question.Type.TEXTAREA, options=[])
    answer = Answer.objects.create(session=session, question=question, text_value="Great job")
    assert answer.selected_option_ids == []
    assert answer.text_value == "Great job"
