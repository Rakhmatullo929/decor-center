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
