import datetime

import pytest

from apps.surveys.models import Question, SurveySession
from apps.surveys.scheduling import due_surveys, is_expired

from .factories import (
    EmployeeFactory,
    QuestionFactory,
    SurveySessionFactory,
    TestFactory,
)
from .test_surveys_api import kiosk_client

pytestmark = pytest.mark.django_db

SESSIONS = "/api/v1/survey-sessions/"


# --- is_expired --------------------------------------------------------------

def test_is_expired_periodic_past_window():
    t = TestFactory(test_days_from=1, test_days_to=10, month=[7])
    assert is_expired(t, datetime.date(2026, 7, 20)) is True
    assert is_expired(t, datetime.date(2026, 7, 10)) is False  # inclusive upper bound
    assert is_expired(t, datetime.date(2026, 7, 5)) is False


def test_is_expired_after_application_never():
    t = TestFactory(is_after_application=True, after_days=30)
    assert is_expired(t, datetime.date(2026, 7, 20)) is False


def test_is_expired_no_upper_bound_never():
    t = TestFactory()  # test_days_to is None
    assert is_expired(t, datetime.date(2026, 7, 20)) is False


def test_is_expired_wrong_month_not_expired():
    t = TestFactory(test_days_from=1, test_days_to=10, month=[6])
    assert is_expired(t, datetime.date(2026, 7, 20)) is False


def test_is_expired_clamps_to_month_end():
    t = TestFactory(test_days_from=1, test_days_to=31, month=[2])
    # Feb 2026 has 28 days: the clamped upper bound is the 28th, so the 28th is open.
    assert is_expired(t, datetime.date(2026, 2, 28)) is False


# --- due_surveys dedup -------------------------------------------------------

def test_due_excludes_test_with_live_session():
    emp = EmployeeFactory(hire_date=datetime.date(2026, 6, 1))
    survey = TestFactory(is_after_application=True, after_days=1)
    # A started-but-not-completed (live) session must move this survey OUT of `due`.
    SurveySessionFactory(test=survey, employee=emp)  # started_at=now, completed_at=None
    result = due_surveys(emp, datetime.date(2026, 7, 1))
    assert survey not in result


def test_due_still_lists_test_without_a_session():
    emp = EmployeeFactory(hire_date=datetime.date(2026, 6, 1))
    survey = TestFactory(is_after_application=True, after_days=1)
    result = due_surveys(emp, datetime.date(2026, 7, 1))
    assert survey in result


# --- in-progress: expired-window exclusion -----------------------------------

def test_in_progress_excludes_expired_window_session(monkeypatch):
    emp = EmployeeFactory()
    survey = TestFactory(test_days_from=1, test_days_to=10, month=[7])
    SurveySessionFactory(test=survey, employee=emp)
    monkeypatch.setattr(
        "django.utils.timezone.localdate", lambda: datetime.date(2026, 7, 20)
    )
    resp = kiosk_client(emp.id).get(f"{SESSIONS}in-progress/?employee={emp.id}")
    assert resp.status_code == 200, resp.data
    assert resp.data == []


def test_in_progress_includes_open_window_session(monkeypatch):
    emp = EmployeeFactory()
    survey = TestFactory(test_days_from=1, test_days_to=31, month=[7])
    session = SurveySessionFactory(test=survey, employee=emp)
    monkeypatch.setattr(
        "django.utils.timezone.localdate", lambda: datetime.date(2026, 7, 20)
    )
    resp = kiosk_client(emp.id).get(f"{SESSIONS}in-progress/?employee={emp.id}")
    assert [row["id"] for row in resp.data] == [session.id]


# --- progress counts ---------------------------------------------------------

from .test_surveys_api import _start, survey_with_questions  # noqa: E402,F401


def test_in_progress_reports_progress_counts(survey_with_questions):
    survey, q_single, q_text = survey_with_questions
    emp = EmployeeFactory()
    client = kiosk_client(emp.id)
    session_id = _start(client, survey, emp).data["session"]["id"]
    client.post(
        f"{SESSIONS}{session_id}/answer/",
        {"question": q_single.id, "selectedOptionIds": ["a"]},
        format="json",
    )
    resp = client.get(f"{SESSIONS}in-progress/?employee={emp.id}")
    row = next(s for s in resp.data if s["id"] == session_id)
    assert row["total_count"] == 2
    assert row["answered_count"] == 1


def test_progress_excludes_section_headers(survey_with_questions):
    survey, q_single, q_text = survey_with_questions
    block = survey.blocks.first()
    QuestionFactory(
        block=block, type=Question.Type.SECTION_HEADER, order=5, options=[]
    )
    emp = EmployeeFactory()
    client = kiosk_client(emp.id)
    session_id = _start(client, survey, emp).data["session"]["id"]
    resp = client.get(f"{SESSIONS}in-progress/?employee={emp.id}")
    row = next(s for s in resp.data if s["id"] == session_id)
    assert row["total_count"] == 2  # the section header is not counted
    assert row["answered_count"] == 0


# --- expired guard on start/submit -------------------------------------------

def test_start_blocked_when_expired(monkeypatch):
    emp = EmployeeFactory()
    survey = TestFactory(test_days_from=1, test_days_to=10, month=[7])
    monkeypatch.setattr(
        "django.utils.timezone.localdate", lambda: datetime.date(2026, 7, 20)
    )
    resp = kiosk_client(emp.id).post(
        f"{SESSIONS}start/", {"employee": emp.id, "test": survey.id}, format="json"
    )
    assert resp.status_code == 409, resp.data
    assert resp.data["code"] == "survey_expired"


def test_start_allowed_when_open(monkeypatch):
    emp = EmployeeFactory()
    survey = TestFactory(test_days_from=1, test_days_to=31, month=[7])
    monkeypatch.setattr(
        "django.utils.timezone.localdate", lambda: datetime.date(2026, 7, 20)
    )
    resp = kiosk_client(emp.id).post(
        f"{SESSIONS}start/", {"employee": emp.id, "test": survey.id}, format="json"
    )
    assert resp.status_code in (200, 201), resp.data


def test_submit_blocked_when_expired(monkeypatch):
    emp = EmployeeFactory()
    survey = TestFactory(test_days_from=1, test_days_to=10, month=[7])
    session = SurveySessionFactory(test=survey, employee=emp)  # started in-window earlier
    monkeypatch.setattr(
        "django.utils.timezone.localdate", lambda: datetime.date(2026, 7, 20)
    )
    resp = kiosk_client(emp.id).post(
        f"{SESSIONS}{session.id}/submit/", {"answers": []}, format="json"
    )
    assert resp.status_code == 409, resp.data
    assert resp.data["code"] == "survey_expired"
