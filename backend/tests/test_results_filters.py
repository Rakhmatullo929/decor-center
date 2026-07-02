"""Results list (TestSession) filtering — date / module / employee / passed / ordering.

Locks the behaviour added in the `statistics-of-admin` branch (SRS §8.1):
an exact-day `date` filter on `started_at`, module/employee/passed filters, and
admin-only access. The date filter buckets by the *local* (Asia/Tashkent) day via a
closed interval [00:00:00.000000, 23:59:59.999999]; these tests pin that contract so a
future refactor (or a silent param rename like the medical `date_from` → `date` one that
broke ``test_history_filters``) is caught instead of slipping through.
"""

import datetime

import pytest
from django.utils import timezone

from apps.assessments.models import TestSession

from .factories import EmployeeFactory

pytestmark = pytest.mark.django_db

SESSIONS_URL = "/api/v1/test-sessions/"

_UNSET = object()


def _aware(year, month, day, hour=12, minute=0, second=0, microsecond=0):
    """Timezone-aware datetime in the active (Asia/Tashkent) zone."""
    return timezone.make_aware(
        datetime.datetime(year, month, day, hour, minute, second, microsecond)
    )


def _session(employee, started_at, *, module="specialty", specialty=_UNSET, score=5, passed=True):
    """Create a TestSession with an explicit ``started_at`` (a settable field).

    ``_create_session`` in test_dashboard_and_export.py cannot set ``started_at``, which the
    date filter keys on, so the date tests build sessions directly. ``specialty`` defaults to
    the employee's specialty; pass ``specialty=None`` for safety modules.
    """
    return TestSession.objects.create(
        employee=employee,
        module=module,
        specialty=employee.specialty if specialty is _UNSET else specialty,
        total=10,
        score=score,
        passed=passed,
        face_verified=True,
        started_at=started_at,
    )


# ---------------------------------------------------------------- exact-day date filter


def test_results_date_isolates_exact_day(admin_client):
    emp = EmployeeFactory()
    target = _session(emp, _aware(2026, 6, 11))
    _session(emp, _aware(2026, 6, 10))  # day before
    _session(emp, _aware(2026, 6, 12))  # day after

    response = admin_client.get(SESSIONS_URL, {"date": "2026-06-11"})
    assert response.status_code == 200
    assert response.data["count"] == 1
    assert response.data["results"][0]["id"] == target.id


def test_results_date_boundary_inclusive_end_excludes_next_midnight(admin_client):
    """Upper bound is inclusive at 23:59:59.999999; the next-day midnight is excluded."""
    emp = EmployeeFactory()
    last_us = _session(emp, _aware(2026, 6, 11, 23, 59, 59, 999999))
    _session(emp, _aware(2026, 6, 12, 0, 0, 0, 0))  # first microsecond of D+1

    response = admin_client.get(SESSIONS_URL, {"date": "2026-06-11"})
    assert response.data["count"] == 1
    assert response.data["results"][0]["id"] == last_us.id


def test_results_date_lower_boundary_midnight_included(admin_client):
    """Lower bound is inclusive at 00:00:00.000000; D-1's last microsecond is excluded."""
    emp = EmployeeFactory()
    midnight = _session(emp, _aware(2026, 6, 11, 0, 0, 0, 0))
    _session(emp, _aware(2026, 6, 10, 23, 59, 59, 999999))  # last microsecond of D-1

    response = admin_client.get(SESSIONS_URL, {"date": "2026-06-11"})
    assert response.data["count"] == 1
    assert response.data["results"][0]["id"] == midnight.id


def test_results_date_buckets_by_local_tashkent_day(admin_client):
    """A 20:00 UTC instant is 01:00 next-day in Asia/Tashkent (UTC+5) and buckets locally."""
    emp = EmployeeFactory()
    # 2026-06-15 20:00Z == 2026-06-16 01:00 Tashkent.
    _session(emp, datetime.datetime(2026, 6, 15, 20, 0, tzinfo=datetime.UTC))

    assert admin_client.get(SESSIONS_URL, {"date": "2026-06-15"}).data["count"] == 0
    assert admin_client.get(SESSIONS_URL, {"date": "2026-06-16"}).data["count"] == 1


def test_results_date_empty_day_returns_zero(admin_client):
    emp = EmployeeFactory()
    _session(emp, _aware(2026, 6, 11))

    response = admin_client.get(SESSIONS_URL, {"date": "2000-01-01"})
    assert response.status_code == 200
    assert response.data["count"] == 0
    assert response.data["results"] == []


def test_results_invalid_date_returns_400(admin_client):
    response = admin_client.get(SESSIONS_URL, {"date": "foo"})
    assert response.status_code == 400
    assert "date" in response.data


def test_results_unknown_legacy_param_is_ignored(admin_client):
    """A stale `date_from` (the pre-rename name) is silently ignored, not honoured nor 400.

    Documents the exact failure mode that broke the old medical `test_history_filters`:
    django-filter drops unknown params, so a renamed filter silently stops filtering.
    """
    emp = EmployeeFactory()
    _session(emp, _aware(2026, 6, 11))
    _session(emp, _aware(2026, 6, 12))

    response = admin_client.get(SESSIONS_URL, {"date_from": "2099-01-01"})
    assert response.status_code == 200
    assert response.data["count"] == 2  # unfiltered: legacy param had no effect


# ---------------------------------------------------------------- combined filters (AND)


def test_results_date_combined_with_employee(admin_client):
    emp_a = EmployeeFactory()
    emp_b = EmployeeFactory()
    target = _session(emp_a, _aware(2026, 6, 11))
    _session(emp_b, _aware(2026, 6, 11))  # same day, other employee
    _session(emp_a, _aware(2026, 6, 12))  # same employee, other day

    response = admin_client.get(SESSIONS_URL, {"date": "2026-06-11", "employee": emp_a.id})
    assert response.data["count"] == 1
    assert response.data["results"][0]["id"] == target.id
    assert response.data["results"][0]["employee"] == emp_a.id


def test_results_date_combined_with_module(admin_client):
    emp = EmployeeFactory()
    target = _session(emp, _aware(2026, 6, 11), module="tech_safety", specialty=None)
    _session(emp, _aware(2026, 6, 11))  # specialty module, same day
    _session(emp, _aware(2026, 6, 10), module="tech_safety", specialty=None)  # tech, other day

    response = admin_client.get(SESSIONS_URL, {"date": "2026-06-11", "module": "tech_safety"})
    assert response.data["count"] == 1
    assert response.data["results"][0]["id"] == target.id
    assert response.data["results"][0]["module"] == "tech_safety"


# ---------------------------------------------------------------- module / passed filters


def test_results_module_tab_isolates_each_module(admin_client):
    emp = EmployeeFactory()
    _session(emp, _aware(2026, 6, 11))  # specialty
    _session(emp, _aware(2026, 6, 11), module="tech_safety", specialty=None)
    _session(emp, _aware(2026, 6, 11), module="industrial_safety", specialty=None)

    for module in ("specialty", "tech_safety", "industrial_safety"):
        response = admin_client.get(SESSIONS_URL, {"module": module})
        assert response.status_code == 200, module
        assert response.data["count"] == 1, module
        assert response.data["results"][0]["module"] == module


def test_results_passed_filter_true_false_and_excludes_null(admin_client):
    emp = EmployeeFactory()
    won = _session(emp, _aware(2026, 6, 11), score=8, passed=True)
    lost = _session(emp, _aware(2026, 6, 11), score=3, passed=False)
    progress = _session(emp, _aware(2026, 6, 11), score=None, passed=None)  # in-progress

    passed = admin_client.get(SESSIONS_URL, {"passed": True})
    assert [r["id"] for r in passed.data["results"]] == [won.id]
    assert passed.data["results"][0]["passed"] is True

    failed = admin_client.get(SESSIONS_URL, {"passed": False})
    assert [r["id"] for r in failed.data["results"]] == [lost.id]
    assert failed.data["results"][0]["passed"] is False

    # The in-progress (passed=None) session is excluded from BOTH filtered views.
    assert progress.id not in {r["id"] for r in passed.data["results"]}
    assert progress.id not in {r["id"] for r in failed.data["results"]}


def test_results_specialty_filter(admin_client):
    """`specialty` is a declared Meta filter (the per-session snapshot FK); lock it."""
    emp_a = EmployeeFactory()
    emp_b = EmployeeFactory()  # EmployeeFactory mints its own Specialty
    target = _session(emp_a, _aware(2026, 6, 11))
    _session(emp_b, _aware(2026, 6, 11))  # different specialty

    response = admin_client.get(SESSIONS_URL, {"specialty": emp_a.specialty_id})
    assert response.data["count"] == 1
    assert response.data["results"][0]["id"] == target.id


# ---------------------------------------------------------------- ordering


def test_results_ordering_by_score_and_employee_name(admin_client):
    emp_a = EmployeeFactory(full_name="Anvar Aliyev")
    emp_b = EmployeeFactory(full_name="Bobur Bek")
    emp_z = EmployeeFactory(full_name="Zafar Zokirov")
    _session(emp_a, _aware(2026, 6, 11), score=5)
    _session(emp_b, _aware(2026, 6, 11), score=9)
    _session(emp_z, _aware(2026, 6, 11), score=2)

    asc = admin_client.get(SESSIONS_URL, {"ordering": "score"})
    assert [r["score"] for r in asc.data["results"]] == [2, 5, 9]
    desc = admin_client.get(SESSIONS_URL, {"ordering": "-score"})
    assert [r["score"] for r in desc.data["results"]] == [9, 5, 2]

    by_name = admin_client.get(SESSIONS_URL, {"ordering": "employee__full_name"})
    assert by_name.data["results"][0]["employee"] == emp_a.id
    by_name_desc = admin_client.get(SESSIONS_URL, {"ordering": "-employee__full_name"})
    assert by_name_desc.data["results"][0]["employee"] == emp_z.id


def test_results_default_ordering_is_started_at_desc(admin_client):
    """With no `ordering` param the list falls back to Meta.ordering = -started_at."""
    emp = EmployeeFactory()
    older = _session(emp, _aware(2026, 6, 10))
    newest = _session(emp, _aware(2026, 6, 12))
    middle = _session(emp, _aware(2026, 6, 11))

    response = admin_client.get(SESSIONS_URL)
    assert [r["id"] for r in response.data["results"]] == [newest.id, middle.id, older.id]


# ---------------------------------------------------------------- permission


def test_results_list_forbidden_for_non_admin(medic_client, specialist_client):
    assert medic_client.get(SESSIONS_URL).status_code == 403
    assert specialist_client.get(SESSIONS_URL).status_code == 403


# ---------------------------------------------------------------- day-range helper contract


def test_day_range_bounds_are_timezone_aware_and_span_local_day():
    """`_day_range` must return tz-aware bounds covering the full local day.

    Naive bounds would still produce the right SQL today (Django coerces them with the active
    zone) but only emit a RuntimeWarning — so the end-to-end date tests can't see a dropped
    `make_aware`. This pins the aware contract and the closed [00:00:00, 23:59:59.999999] span
    directly on the helper.
    """
    from apps.assessments.filters import _day_range

    start, end = _day_range(datetime.date(2026, 6, 11))
    assert timezone.is_aware(start)
    assert timezone.is_aware(end)
    fmt = "%Y-%m-%d %H:%M:%S.%f"
    assert timezone.localtime(start).strftime(fmt) == "2026-06-11 00:00:00.000000"
    assert timezone.localtime(end).strftime(fmt) == "2026-06-11 23:59:59.999999"
