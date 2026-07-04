import pytest

from apps.surveys.models import Question
from apps.surveys.serializers import (
    QuestionSerializer,
    SubmitSerializer,
    TestSerializer,
)

from .factories import QuestionBlockFactory, TestFactory

pytestmark = pytest.mark.django_db


def test_question_single_requires_option_shape():
    block = QuestionBlockFactory()
    ser = QuestionSerializer(
        data={"block": block.id, "type": "single", "text": "Q", "options": []}
    )
    assert not ser.is_valid()
    assert "options" in ser.errors


def test_question_single_assigns_missing_option_ids():
    block = QuestionBlockFactory()
    ser = QuestionSerializer(
        data={
            "block": block.id,
            "type": "single",
            "text": "Q",
            "options": [{"text": "Yes"}, {"text": "No"}],
        }
    )
    assert ser.is_valid(), ser.errors
    opts = ser.validated_data["options"]
    assert all(opt["id"] for opt in opts)
    assert len({opt["id"] for opt in opts}) == 2


def test_question_textarea_forces_empty_options():
    block = QuestionBlockFactory()
    ser = QuestionSerializer(
        data={
            "block": block.id,
            "type": "textarea",
            "text": "Q",
            "options": [{"id": "x", "text": "nope"}],
        }
    )
    assert not ser.is_valid()
    assert "options" in ser.errors


def test_test_after_application_requires_after_days():
    ser = TestSerializer(
        data={"title": "T", "is_after_application": True, "after_days": None}
    )
    assert not ser.is_valid()
    assert "after_days" in ser.errors


def test_test_nested_blocks_read():
    """Legacy plain-string title/text (e.g. from a seed script or pre-migration data)
    is normalized to {uz, ru} on read, not just on write."""
    survey = TestFactory()
    block = QuestionBlockFactory(test=survey, title="B1")
    Question.objects.create(block=block, type="textarea", text="Free", options=[])
    data = TestSerializer(survey).data
    assert data["blocks"][0]["title"] == {"uz": "", "ru": "B1"}
    assert data["blocks"][0]["questions"][0]["type"] == "textarea"
    assert data["blocks"][0]["questions"][0]["text"] == {"uz": "", "ru": "Free"}


def test_submit_serializer_camel_case_fields():
    ser = SubmitSerializer(
        data={
            "answers": [
                {"question": 1, "selectedOptionIds": ["a"]},
                {"question": 2, "textValue": "hello"},
            ]
        }
    )
    assert ser.is_valid(), ser.errors
    assert ser.validated_data["answers"][0]["selectedOptionIds"] == ["a"]
    assert ser.validated_data["answers"][1]["textValue"] == "hello"
