"""Medical check audit helpers (SRS §7.3 — full change history)."""
from .models import MedicalCheck, MedicalCheckAudit

SNAPSHOT_FIELDS = [
    "employee_id",
    "bp_systolic",
    "bp_diastolic",
    "pulse",
    "saturation",
    "alcohol_value",
    "alcohol_positive",
    "hours_worked",
    "hours_rested",
    "conclusion",
    "note",
    "medic_id",
]


def snapshot_medical_check(check: MedicalCheck) -> dict:
    """JSON-safe snapshot of all business fields."""
    data = {}
    for field in SNAPSHOT_FIELDS:
        value = getattr(check, field)
        data[field] = str(value) if value is not None and not isinstance(value, (int, bool)) else value
    return data


def record_created(check: MedicalCheck, user) -> None:
    MedicalCheckAudit.objects.create(
        medical_check=check,
        action=MedicalCheckAudit.Action.CREATED,
        performed_by=user,
        snapshot={"new": snapshot_medical_check(check)},
    )


def record_updated(check: MedicalCheck, user, old_snapshot: dict) -> None:
    MedicalCheckAudit.objects.create(
        medical_check=check,
        action=MedicalCheckAudit.Action.UPDATED,
        performed_by=user,
        snapshot={"old": old_snapshot, "new": snapshot_medical_check(check)},
    )
