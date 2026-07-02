import datetime

import pytest
from django.utils import timezone

from apps.medical.models import MedicalCheck, MedicalCheckAudit

from .factories import EmployeeFactory

pytestmark = pytest.mark.django_db

CHECKS_URL = "/api/v1/medical-checks/"


def _payload(employee, **overrides):
    payload = {
        "employee": employee.id,
        "bp_systolic": 120,
        "bp_diastolic": 80,
        "pulse": 72,
        "saturation": 98,
        "alcohol_value": "0.000",
        "alcohol_positive": False,
        "hours_worked": "8.0",
        "hours_rested": "16.0",
        "conclusion": "approved",
        "note": "",
    }
    payload.update(overrides)
    return payload


def _aware(year, month, day, hour=10, minute=0, second=0, microsecond=0):
    """Timezone-aware datetime in the active (Asia/Tashkent) zone."""
    return timezone.make_aware(
        datetime.datetime(year, month, day, hour, minute, second, microsecond)
    )


def _check_at(medic_client, employee, created_at, *, conclusion="approved"):
    """Create a check via the API, then pin its `created_at` to a chosen instant.

    `created_at` is `auto_now_add` and cannot be set on insert, so it is overwritten with a
    `QuerySet.update()` (which bypasses `auto_now_add`). Returns the new check's id.
    """
    check_id = medic_client.post(
        CHECKS_URL, _payload(employee, conclusion=conclusion), format="json"
    ).data["id"]
    MedicalCheck.objects.filter(pk=check_id).update(created_at=created_at)
    return check_id


def test_medic_creates_check_and_audit_is_recorded(medic_client, medic_user):
    employee = EmployeeFactory()
    response = medic_client.post(CHECKS_URL, _payload(employee), format="json")
    assert response.status_code == 201, response.data
    # The medic is recorded automatically (SRS §7.2).
    assert response.data["medic_username"] == medic_user.username

    check = MedicalCheck.objects.get(id=response.data["id"])
    assert check.medic == medic_user
    audit = MedicalCheckAudit.objects.get(medical_check=check)
    assert audit.action == MedicalCheckAudit.Action.CREATED
    assert audit.performed_by == medic_user


def test_medic_cannot_edit_saved_check(medic_client):
    employee = EmployeeFactory()
    check_id = medic_client.post(CHECKS_URL, _payload(employee), format="json").data["id"]

    # Every business field must be rejected AND remain unchanged in the DB (SRS §7.3).
    attempts = {
        "conclusion": "rejected",
        "saturation": 60,
        "bp_systolic": 200,
        "hours_worked": "1.0",
        "note": "tampered",
    }
    for field, value in attempts.items():
        response = medic_client.patch(f"{CHECKS_URL}{check_id}/", {field: value}, format="json")
        assert response.status_code == 403, field

    check = MedicalCheck.objects.get(id=check_id)
    assert check.conclusion == "approved"
    assert check.saturation == 98
    assert check.bp_systolic == 120
    assert str(check.hours_worked) == "8.0"
    assert check.note == ""


def test_admin_edit_is_audited(medic_client, admin_client, admin_user):
    employee = EmployeeFactory()
    check_id = medic_client.post(CHECKS_URL, _payload(employee), format="json").data["id"]

    response = admin_client.patch(
        f"{CHECKS_URL}{check_id}/", {"conclusion": "rejected"}, format="json"
    )
    assert response.status_code == 200
    audit = MedicalCheckAudit.objects.get(
        medical_check_id=check_id, action=MedicalCheckAudit.Action.UPDATED
    )
    assert audit.performed_by == admin_user
    assert audit.snapshot["old"]["conclusion"] == "approved"
    assert audit.snapshot["new"]["conclusion"] == "rejected"


def test_delete_is_not_allowed(medic_client, admin_client):
    employee = EmployeeFactory()
    check_id = medic_client.post(CHECKS_URL, _payload(employee), format="json").data["id"]
    assert medic_client.delete(f"{CHECKS_URL}{check_id}/").status_code == 405
    assert admin_client.delete(f"{CHECKS_URL}{check_id}/").status_code == 405


def test_vitals_are_validated(medic_client):
    employee = EmployeeFactory()
    response = medic_client.post(
        CHECKS_URL, _payload(employee, saturation=120), format="json"
    )
    assert response.status_code == 400
    assert "saturation" in response.data


def test_history_filters(medic_client):
    """History search by employee, conclusion and exact day (SRS §7.4)."""
    first = EmployeeFactory()
    second = EmployeeFactory()
    id1 = _check_at(medic_client, first, _aware(2026, 6, 11))
    _check_at(medic_client, second, _aware(2026, 6, 12), conclusion="rejected")

    by_employee = medic_client.get(CHECKS_URL, {"employee": first.id})
    assert by_employee.data["count"] == 1

    by_conclusion = medic_client.get(CHECKS_URL, {"conclusion": "rejected"})
    assert by_conclusion.data["count"] == 1
    assert by_conclusion.data["results"][0]["employee"] == second.id

    # Exact-day `date` filter (replaces the removed `date_from`/`date_to` range).
    by_date_match = medic_client.get(CHECKS_URL, {"date": "2026-06-11"})
    assert by_date_match.data["count"] == 1
    assert by_date_match.data["results"][0]["id"] == id1

    by_date_empty = medic_client.get(CHECKS_URL, {"date": "2099-01-01"})
    assert by_date_empty.data["count"] == 0


def test_medical_date_isolates_exact_day(medic_client):
    emp = EmployeeFactory()
    target = _check_at(medic_client, emp, _aware(2026, 6, 11))
    _check_at(medic_client, emp, _aware(2026, 6, 10))  # day before
    _check_at(medic_client, emp, _aware(2026, 6, 12))  # day after

    response = medic_client.get(CHECKS_URL, {"date": "2026-06-11"})
    assert response.status_code == 200
    assert response.data["count"] == 1
    assert response.data["results"][0]["id"] == target


def test_medical_date_boundary_inclusive_end_excludes_next_midnight(medic_client):
    """Upper bound is inclusive at 23:59:59.999999; next-day midnight is excluded."""
    emp = EmployeeFactory()
    last_us = _check_at(medic_client, emp, _aware(2026, 6, 11, 23, 59, 59, 999999))
    _check_at(medic_client, emp, _aware(2026, 6, 12, 0, 0, 0, 0))

    response = medic_client.get(CHECKS_URL, {"date": "2026-06-11"})
    assert response.data["count"] == 1
    assert response.data["results"][0]["id"] == last_us


def test_medical_date_combined_with_conclusion(medic_client):
    emp = EmployeeFactory()
    target = _check_at(medic_client, emp, _aware(2026, 6, 11), conclusion="rejected")
    _check_at(medic_client, emp, _aware(2026, 6, 11))  # same day, approved
    _check_at(medic_client, emp, _aware(2026, 6, 10), conclusion="rejected")  # rejected, other day

    response = medic_client.get(CHECKS_URL, {"date": "2026-06-11", "conclusion": "rejected"})
    assert response.data["count"] == 1
    assert response.data["results"][0]["id"] == target
    assert response.data["results"][0]["conclusion"] == "rejected"


def test_medical_invalid_date_returns_400(medic_client):
    response = medic_client.get(CHECKS_URL, {"date": "not-a-date"})
    assert response.status_code == 400
    assert "date" in response.data


def test_medical_unknown_legacy_param_is_ignored(medic_client):
    """A stale `date_from` is silently ignored (the regression that broke the old test)."""
    emp = EmployeeFactory()
    _check_at(medic_client, emp, _aware(2026, 6, 11))
    _check_at(medic_client, emp, _aware(2026, 6, 12))

    response = medic_client.get(CHECKS_URL, {"date_from": "2099-01-01"})
    assert response.status_code == 200
    assert response.data["count"] == 2  # unfiltered: legacy param had no effect


def test_medical_default_ordering_and_explicit_created_at_asc(medic_client):
    emp = EmployeeFactory()
    id_old = _check_at(medic_client, emp, _aware(2026, 6, 10))
    id_new = _check_at(medic_client, emp, _aware(2026, 6, 12))
    id_mid = _check_at(medic_client, emp, _aware(2026, 6, 11))

    default = medic_client.get(CHECKS_URL)  # Meta.ordering = -created_at
    assert [r["id"] for r in default.data["results"]] == [id_new, id_mid, id_old]

    asc = medic_client.get(CHECKS_URL, {"ordering": "created_at"})
    assert [r["id"] for r in asc.data["results"]] == [id_old, id_mid, id_new]


def test_medical_admin_can_list_with_date_filter(admin_client, medic_client):
    """Admins (not only medics) can browse medical history with the date filter."""
    emp = EmployeeFactory()
    _check_at(medic_client, emp, _aware(2026, 6, 11))
    _check_at(medic_client, emp, _aware(2026, 6, 12))

    response = admin_client.get(CHECKS_URL, {"date": "2026-06-11"})
    assert response.status_code == 200
    assert response.data["count"] == 1


def test_medical_date_buckets_by_local_tashkent_day(medic_client):
    """A 20:00 UTC instant is 01:00 next-day in Asia/Tashkent and buckets by the local day.

    The medical `_day_range` is a separate copy of the assessments one, so its local-day
    behaviour is pinned independently here.
    """
    emp = EmployeeFactory()
    # 2026-06-15 20:00Z == 2026-06-16 01:00 Tashkent.
    _check_at(medic_client, emp, datetime.datetime(2026, 6, 15, 20, 0, tzinfo=datetime.UTC))

    assert medic_client.get(CHECKS_URL, {"date": "2026-06-15"}).data["count"] == 0
    assert medic_client.get(CHECKS_URL, {"date": "2026-06-16"}).data["count"] == 1


def test_medical_day_range_bounds_are_timezone_aware():
    """The medical `_day_range` must return tz-aware bounds spanning the full local day."""
    from apps.medical.filters import _day_range

    start, end = _day_range(datetime.date(2026, 6, 11))
    assert timezone.is_aware(start)
    assert timezone.is_aware(end)
    fmt = "%Y-%m-%d %H:%M:%S.%f"
    assert timezone.localtime(start).strftime(fmt) == "2026-06-11 00:00:00.000000"
    assert timezone.localtime(end).strftime(fmt) == "2026-06-11 23:59:59.999999"


def test_specialist_has_no_access_to_medical_module(specialist_client):
    assert specialist_client.get(CHECKS_URL).status_code == 403
