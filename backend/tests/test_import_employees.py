import json

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from apps.employees.models import Employee, Specialty

pytestmark = pytest.mark.django_db


def _write(tmp_path, records):
    path = tmp_path / "employees.json"
    path.write_text(json.dumps(records, ensure_ascii=False), encoding="utf-8")
    return str(path)


def test_imports_and_links_by_normalized_specialty(tmp_path):
    # Seeded specialty uses a straight apostrophe (U+0027)...
    exploitation = Specialty.objects.create(
        name="ekspluatatsiya ishlari bo'yicha texnologiya muhandisi"
    )
    driver = Specialty.objects.create(name="teplovoz mashinisti")
    # ...while the roster uses a curly apostrophe (U+2018) and noisy spacing/case.
    path = _write(
        tmp_path,
        [
            {
                "name": "Ivanov Ivan",
                "speciality": "ekspluatatsiya ishlari bo‘yicha texnologiya muhandisi",
            },
            {"name": "Petrov Petr", "speciality": "  Teplovoz   Mashinisti "},
        ],
    )

    call_command("import_employees", "--file", path)

    assert Employee.objects.count() == 2
    ivanov = Employee.objects.get(full_name="Ivanov Ivan")
    assert ivanov.specialty == exploitation  # apostrophe variant still resolved
    assert ivanov.photo.name == ""  # imported as a roster, no photo yet
    assert ivanov.face_embedding is None
    assert Employee.objects.get(full_name="Petrov Petr").specialty == driver


def test_idempotent_rerun_skips_existing(tmp_path):
    Specialty.objects.create(name="teplovoz mashinisti")
    path = _write(tmp_path, [{"name": "Ivanov Ivan", "speciality": "teplovoz mashinisti"}])

    call_command("import_employees", "--file", path)
    call_command("import_employees", "--file", path)

    assert Employee.objects.filter(full_name="Ivanov Ivan").count() == 1


def test_unknown_specialty_aborts_without_writing(tmp_path):
    Specialty.objects.create(name="teplovoz mashinisti")
    path = _write(
        tmp_path,
        [
            {"name": "Ivanov Ivan", "speciality": "teplovoz mashinisti"},
            {"name": "Petrov Petr", "speciality": "no such specialty"},
        ],
    )

    with pytest.raises(CommandError, match="not in the database"):
        call_command("import_employees", "--file", path)

    assert Employee.objects.count() == 0  # fail fast: nothing written
