import datetime

import pytest
from django.utils import timezone

from apps.surveys.models import SurveySession
from apps.surveys.scheduling import due_surveys

from .factories import EmployeeFactory, TestFactory

pytestmark = pytest.mark.django_db


def _complete(test, employee, when):
    """Create a completed session for `test`/`employee` at datetime `when`."""
    if timezone.is_naive(when):
        when = timezone.make_aware(when, datetime.UTC)
    session = SurveySession.objects.create(test=test, employee=employee)
    SurveySession.objects.filter(pk=session.pk).update(completed_at=when)
    return session


def test_after_application_triggers_when_days_elapsed():
    emp = EmployeeFactory(hire_date=datetime.date(2026, 6, 1))
    survey = TestFactory(is_after_application=True, after_days=30)
    assert survey in due_surveys(emp, datetime.date(2026, 7, 1))  # 30 days later


def test_after_application_not_yet_due():
    emp = EmployeeFactory(hire_date=datetime.date(2026, 6, 1))
    TestFactory(is_after_application=True, after_days=30)
    assert due_surveys(emp, datetime.date(2026, 6, 20)) == []


def test_after_application_skips_when_no_hire_date():
    emp = EmployeeFactory(hire_date=None)
    TestFactory(is_after_application=True, after_days=30)
    assert due_surveys(emp, datetime.date(2026, 7, 1)) == []


def test_after_application_idempotent_after_completion():
    emp = EmployeeFactory(hire_date=datetime.date(2026, 6, 1))
    survey = TestFactory(is_after_application=True, after_days=30)
    _complete(survey, emp, datetime.datetime(2026, 7, 1, 9, 0))
    assert due_surveys(emp, datetime.date(2026, 7, 5)) == []


def test_periodic_in_month_and_window():
    emp = EmployeeFactory(hire_date=datetime.date(2020, 1, 1))
    survey = TestFactory(month=[7], test_days_from=1, test_days_to=7)
    assert survey in due_surveys(emp, datetime.date(2026, 7, 3))


def test_periodic_out_of_month():
    emp = EmployeeFactory(hire_date=datetime.date(2020, 1, 1))
    TestFactory(month=[7], test_days_from=1, test_days_to=7)
    assert due_surveys(emp, datetime.date(2026, 8, 3)) == []


def test_periodic_out_of_day_window():
    emp = EmployeeFactory(hire_date=datetime.date(2020, 1, 1))
    TestFactory(month=[7], test_days_from=1, test_days_to=7)
    assert due_surveys(emp, datetime.date(2026, 7, 20)) == []


def test_periodic_empty_month_means_every_month():
    emp = EmployeeFactory(hire_date=datetime.date(2020, 1, 1))
    survey = TestFactory(month=[], test_days_from=1, test_days_to=5)
    assert survey in due_surveys(emp, datetime.date(2026, 3, 2))
    assert survey in due_surveys(emp, datetime.date(2026, 11, 4))


def test_periodic_short_month_clamps_upper_bound():
    emp = EmployeeFactory(hire_date=datetime.date(2020, 1, 1))
    # 2027 February has 28 days; a window of 25..31 clamps to 25..28.
    survey = TestFactory(month=[2], test_days_from=25, test_days_to=31)
    assert survey in due_surveys(emp, datetime.date(2027, 2, 28))


def test_periodic_idempotent_within_window_but_returns_next_period():
    emp = EmployeeFactory(hire_date=datetime.date(2020, 1, 1))
    survey = TestFactory(month=[], test_days_from=1, test_days_to=7)
    _complete(survey, emp, datetime.datetime(2026, 7, 2, 9, 0))
    # Same window -> suppressed.
    assert due_surveys(emp, datetime.date(2026, 7, 4)) == []
    # Next month's window -> due again.
    assert survey in due_surveys(emp, datetime.date(2026, 8, 3))


def test_admin_conducted_excluded_from_due():
    emp = EmployeeFactory(hire_date=datetime.date(2020, 1, 1))
    TestFactory(is_admin_conducted=True, month=[], test_days_from=1, test_days_to=28)
    assert due_surveys(emp, datetime.date(2026, 7, 3)) == []


def test_inactive_test_excluded():
    emp = EmployeeFactory(hire_date=datetime.date(2020, 1, 1))
    TestFactory(is_active=False, month=[], test_days_from=1, test_days_to=28)
    assert due_surveys(emp, datetime.date(2026, 7, 3)) == []
