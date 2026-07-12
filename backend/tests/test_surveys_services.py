from datetime import timedelta

import pytest
from django.utils import timezone

from apps.surveys.models import Answer, Question, SurveySession
from apps.surveys.services import (
    SurveyFlowError,
    admin_fill,
    autosave_answer,
    in_progress_sessions,
    start_survey_session,
    submit_survey_session,
)

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
    session, questions, reused = start_survey_session(
        employee=emp, test=survey, entry_face_verified=True
    )
    assert reused is False
    assert session.face_verified is True
    assert session.face_embedding == emp.face_embedding
    assert session.model_version == "mock-16"
    assert {q.id for q in questions} == {q_single.id, q_text.id}
    # Presented set frozen as empty Answer rows.
    assert Answer.objects.filter(session=session).count() == 2


def test_start_is_idempotent_returns_existing_session():
    """A second start for the same (employee, test) while the first is still open
    resumes it instead of creating a duplicate SurveySession."""
    emp = EmployeeFactory()
    survey, _, _ = _survey_with_questions()
    first, _, first_reused = start_survey_session(
        employee=emp, test=survey, entry_face_verified=True
    )
    second, _, second_reused = start_survey_session(
        employee=emp, test=survey, entry_face_verified=False
    )
    assert first_reused is False
    assert second_reused is True
    assert second.id == first.id
    assert SurveySession.objects.filter(employee=emp, test=survey).count() == 1


def test_start_creates_new_session_after_previous_completed():
    emp = EmployeeFactory()
    survey, q_single, _ = _survey_with_questions()
    first, _, _ = start_survey_session(employee=emp, test=survey, entry_face_verified=True)
    submit_survey_session(
        session=first,
        answers=[{"question": q_single.id, "selected_option_ids": ["a"], "text_value": ""}],
    )
    second, _, reused = start_survey_session(
        employee=emp, test=survey, entry_face_verified=True
    )
    assert reused is False
    assert second.id != first.id
    assert SurveySession.objects.filter(employee=emp, test=survey).count() == 2


def test_start_creates_new_session_after_previous_abandoned(settings):
    emp = EmployeeFactory()
    survey, _, _ = _survey_with_questions()
    first, _, _ = start_survey_session(employee=emp, test=survey, entry_face_verified=True)
    SurveySession.objects.filter(pk=first.pk).update(
        started_at=timezone.now() - timedelta(hours=25)
    )
    settings.DECOR = {**settings.DECOR, "SURVEY_SESSION_ABANDONED_AFTER_HOURS": 24}
    first.refresh_from_db()
    assert first.status == SurveySession.Status.ABANDONED

    second, _, reused = start_survey_session(
        employee=emp, test=survey, entry_face_verified=True
    )
    assert reused is False
    assert second.id != first.id


def test_submit_persists_answers_and_completes():
    emp = EmployeeFactory()
    survey, q_single, q_text = _survey_with_questions()
    session, _, _ = start_survey_session(employee=emp, test=survey, entry_face_verified=True)
    session = submit_survey_session(
        session=session,
        answers=[
            {"question": q_single.id, "selected_option_ids": ["a"], "text_value": ""},
            {"question": q_text.id, "selected_option_ids": [], "text_value": "Great"},
        ],
    )
    assert session.completed_at is not None
    assert session.status == SurveySession.Status.COMPLETED
    single_answer = Answer.objects.get(session=session, question=q_single)
    text_answer = Answer.objects.get(session=session, question=q_text)
    assert single_answer.selected_option_ids == ["a"]
    assert text_answer.text_value == "Great"


def test_submit_rejects_already_completed():
    emp = EmployeeFactory()
    survey, q_single, _ = _survey_with_questions()
    session, _, _ = start_survey_session(employee=emp, test=survey, entry_face_verified=True)
    submit_survey_session(
        session=session,
        answers=[{"question": q_single.id, "selected_option_ids": ["a"], "text_value": ""}],
    )
    with pytest.raises(SurveyFlowError):
        submit_survey_session(
            session=session,
            answers=[{"question": q_single.id, "selected_option_ids": ["b"], "text_value": ""}],
        )


def test_submit_rejects_foreign_question():
    emp = EmployeeFactory()
    survey, q_single, _ = _survey_with_questions()
    other = QuestionFactory()
    session, _, _ = start_survey_session(employee=emp, test=survey, entry_face_verified=True)
    with pytest.raises(SurveyFlowError):
        submit_survey_session(
            session=session,
            answers=[{"question": other.id, "selected_option_ids": ["a"], "text_value": ""}],
        )


def test_autosave_answer_upserts_without_completing():
    emp = EmployeeFactory()
    survey, q_single, q_text = _survey_with_questions()
    session, _, _ = start_survey_session(employee=emp, test=survey, entry_face_verified=True)

    autosave_answer(session=session, item={"question": q_single.id, "selected_option_ids": ["a"]})
    session.refresh_from_db()
    assert session.completed_at is None
    assert session.status == SurveySession.Status.IN_PROGRESS
    assert Answer.objects.get(session=session, question=q_single).selected_option_ids == ["a"]

    # Re-saving (upsert) overwrites the same row, not a new one.
    autosave_answer(session=session, item={"question": q_single.id, "selected_option_ids": ["b"]})
    assert Answer.objects.filter(session=session, question=q_single).count() == 1
    assert Answer.objects.get(session=session, question=q_single).selected_option_ids == ["b"]

    autosave_answer(session=session, item={"question": q_text.id, "text_value": "draft"})
    assert Answer.objects.get(session=session, question=q_text).text_value == "draft"


def test_autosave_answer_rejects_after_completed():
    emp = EmployeeFactory()
    survey, q_single, _ = _survey_with_questions()
    session, _, _ = start_survey_session(employee=emp, test=survey, entry_face_verified=True)
    submit_survey_session(
        session=session,
        answers=[{"question": q_single.id, "selected_option_ids": ["a"], "text_value": ""}],
    )
    with pytest.raises(SurveyFlowError):
        autosave_answer(session=session, item={"question": q_single.id, "selected_option_ids": ["b"]})


def test_autosave_answer_rejects_foreign_question():
    emp = EmployeeFactory()
    survey, _, _ = _survey_with_questions()
    other = QuestionFactory()
    session, _, _ = start_survey_session(employee=emp, test=survey, entry_face_verified=True)
    with pytest.raises(SurveyFlowError):
        autosave_answer(session=session, item={"question": other.id, "selected_option_ids": ["a"]})


def test_in_progress_sessions_excludes_completed_and_abandoned(settings):
    emp = EmployeeFactory()
    survey_a, _, _ = _survey_with_questions()
    survey_b, q_single_b, _ = _survey_with_questions()
    survey_c, _, _ = _survey_with_questions()

    live, _, _ = start_survey_session(employee=emp, test=survey_a, entry_face_verified=True)
    completed, _, _ = start_survey_session(employee=emp, test=survey_b, entry_face_verified=True)
    submit_survey_session(
        session=completed,
        answers=[{"question": q_single_b.id, "selected_option_ids": ["a"], "text_value": ""}],
    )
    abandoned, _, _ = start_survey_session(employee=emp, test=survey_c, entry_face_verified=True)
    SurveySession.objects.filter(pk=abandoned.pk).update(
        started_at=timezone.now() - timedelta(hours=25)
    )
    settings.DECOR = {**settings.DECOR, "SURVEY_SESSION_ABANDONED_AFTER_HOURS": 24}

    result_ids = {s.id for s in in_progress_sessions(emp)}
    assert result_ids == {live.id}


def test_admin_fill_creates_completed_session_without_face():
    emp = EmployeeFactory(face_embedding=None)  # no face needed
    admin = UserFactory()
    survey, q_single, q_text = _survey_with_questions()
    session = admin_fill(
        employee=emp,
        test=survey,
        user=admin,
        answers=[
            {"question": q_single.id, "selected_option_ids": ["b"], "text_value": ""},
            {"question": q_text.id, "selected_option_ids": [], "text_value": "ok"},
        ],
    )
    assert session.completed_at is not None
    assert session.created_by == admin
    assert session.face_verified is False
    assert Answer.objects.filter(session=session).count() == 2
