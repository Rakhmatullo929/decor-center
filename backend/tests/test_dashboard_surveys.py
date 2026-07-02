import pytest
from django.utils import timezone

from apps.surveys.models import SurveySession

from .factories import EmployeeFactory, TestFactory

pytestmark = pytest.mark.django_db

URL = "/api/v1/dashboard/stats/"


def test_dashboard_requires_admin(specialist_client):
    assert specialist_client.get(URL).status_code == 403


def test_dashboard_survey_counters(admin_client):
    survey = TestFactory(is_active=True)
    TestFactory(is_admin_conducted=True)
    emp = EmployeeFactory()
    done = SurveySession.objects.create(test=survey, employee=emp)
    SurveySession.objects.filter(pk=done.pk).update(completed_at=timezone.now())
    SurveySession.objects.create(test=survey, employee=EmployeeFactory())  # in progress

    today = timezone.localdate().isoformat()
    resp = admin_client.get(f"{URL}?date={today}")
    assert resp.status_code == 200
    assert resp.data["sessions"]["total"] == 2
    assert resp.data["sessions"]["completed"] == 1
    assert resp.data["sessions"]["in_progress"] == 1
    assert resp.data["totals"]["active_tests"] == 2  # 'survey' + admin-conducted are both active
    assert resp.data["totals"]["admin_conducted_tests"] == 1
