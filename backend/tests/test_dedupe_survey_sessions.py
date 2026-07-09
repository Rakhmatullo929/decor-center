from io import StringIO

import pytest
from django.core.management import call_command
from django.utils import timezone

from apps.surveys.models import SurveySession

from .factories import EmployeeFactory, SurveySessionFactory, TestFactory

pytestmark = pytest.mark.django_db


def test_dedupe_keeps_only_the_most_recent_incomplete_session():
    emp = EmployeeFactory()
    survey = TestFactory()
    older = SurveySessionFactory(employee=emp, test=survey)
    newer = SurveySessionFactory(employee=emp, test=survey)
    SurveySession.objects.filter(pk=older.pk).update(
        started_at=timezone.now() - timezone.timedelta(hours=1)
    )

    call_command("dedupe_survey_sessions", stdout=StringIO())

    remaining = SurveySession.objects.filter(employee=emp, test=survey)
    assert list(remaining.values_list("id", flat=True)) == [newer.id]


def test_dedupe_never_touches_completed_sessions():
    emp = EmployeeFactory()
    survey = TestFactory()
    completed_a = SurveySessionFactory(employee=emp, test=survey, completed_at=timezone.now())
    completed_b = SurveySessionFactory(employee=emp, test=survey, completed_at=timezone.now())

    call_command("dedupe_survey_sessions", stdout=StringIO())

    remaining_ids = set(SurveySession.objects.filter(employee=emp, test=survey).values_list("id", flat=True))
    assert remaining_ids == {completed_a.id, completed_b.id}


def test_dedupe_dry_run_deletes_nothing():
    emp = EmployeeFactory()
    survey = TestFactory()
    SurveySessionFactory(employee=emp, test=survey)
    SurveySessionFactory(employee=emp, test=survey)

    call_command("dedupe_survey_sessions", "--dry-run", stdout=StringIO())

    assert SurveySession.objects.filter(employee=emp, test=survey).count() == 2


def test_dedupe_is_idempotent():
    emp = EmployeeFactory()
    survey = TestFactory()
    SurveySessionFactory(employee=emp, test=survey)
    SurveySessionFactory(employee=emp, test=survey)

    call_command("dedupe_survey_sessions", stdout=StringIO())
    call_command("dedupe_survey_sessions", stdout=StringIO())

    assert SurveySession.objects.filter(employee=emp, test=survey).count() == 1
