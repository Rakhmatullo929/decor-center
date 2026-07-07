import pytest
from django.core.management import call_command

from apps.surveys.models import Question, QuestionBlock, Test

pytestmark = pytest.mark.django_db

SURVEY_TITLES = [
    "Через 30 дней после найма",
    "Через 90 дней после найма",
    "1в1 ежемесячно (беседа)",
    "Краткий пульс",
    "Глубокий опрос",
]


@pytest.fixture
def surveys(db):
    call_command("seed_surveys")


def test_seed_survey_content_creates_blocks_and_questions(surveys):
    call_command("seed_survey_content")
    for title in SURVEY_TITLES:
        test = Test.objects.get(title=title)
        assert test.blocks.exists()
        assert Question.objects.filter(block__test=test).exists()


def test_seed_survey_content_is_idempotent(surveys):
    call_command("seed_survey_content")
    block_count = QuestionBlock.objects.count()
    question_count = Question.objects.count()

    call_command("seed_survey_content")

    assert QuestionBlock.objects.count() == block_count
    assert Question.objects.count() == question_count


def test_seed_survey_content_deep_survey_shape(surveys):
    call_command("seed_survey_content")
    survey = Test.objects.get(title="Глубокий опрос")
    assert survey.blocks.count() == 7
    assert Question.objects.filter(block__test=survey).count() == 28

    loyalty = survey.blocks.get(title="II. ЛОЯЛЬНОСТЬ")
    nps_question = loyalty.questions.first()
    assert nps_question.type == Question.Type.NPS
    assert nps_question.settings["min"] == 1
    assert nps_question.settings["max"] == 10
    assert nps_question.is_required is True

    mind_dive_questions = Question.objects.filter(block__test=survey, is_mind_dive=True)
    assert mind_dive_questions.count() == 10


def test_seed_survey_content_skips_missing_survey(db):
    """No Test rows exist yet — the command must not crash, just warn and skip."""
    call_command("seed_survey_content")
    assert QuestionBlock.objects.count() == 0
