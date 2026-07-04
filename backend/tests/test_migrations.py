import pytest
from django.core.management import call_command


@pytest.mark.django_db(transaction=True)
def test_surveys_0002_reversible_on_non_empty_table():
    """migrate surveys 0001 must not fail once rows exist (regression for the
    NOT NULL/no-default AddField that RemoveField's stock reverse re-creates)."""
    from apps.surveys.models import Question, QuestionBlock
    from apps.surveys.models import Test as SurveyTest

    survey = SurveyTest.objects.create(title="Reversibility check")
    block = QuestionBlock.objects.create(test=survey, order=0, title={"uz": "Blok", "ru": "Блок"})
    Question.objects.create(
        block=block,
        type=Question.Type.TEXTAREA,
        order=0,
        text={"uz": "Savol?", "ru": "Вопрос?"},
        options=[],
    )

    # Must not raise: reversing 0002 on a non-empty table used to fail trying to
    # re-add a NOT NULL column with no default (see RemoveFieldRestoreNullable).
    call_command("migrate", "surveys", "0001", verbosity=0)
    call_command("migrate", "surveys", "0002", verbosity=0)

    # The old schema only had a single string per block/question, so round-tripping
    # through it is lossy by design (uz is dropped, ru wins) — just check it survives.
    block.refresh_from_db()
    assert block.title["ru"] == "Блок"
