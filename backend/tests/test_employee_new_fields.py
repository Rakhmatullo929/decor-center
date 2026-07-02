import pytest

from apps.employees.models import Employee
from apps.employees.serializers import EmployeeSerializer

from .factories import EmployeeFactory, SpecialtyFactory

pytestmark = pytest.mark.django_db


def test_model_has_new_fields():
    f = {fld.name for fld in Employee._meta.get_fields()}
    assert "hire_date" in f
    assert "work_experience" in f


def test_serializer_exposes_new_fields_but_not_embedding():
    fields = EmployeeSerializer.Meta.fields
    assert "hire_date" in fields
    assert "work_experience" in fields
    assert "face_embedding" not in fields


def test_serialized_employee_roundtrips_new_fields():
    emp = EmployeeFactory(hire_date="2020-01-15", work_experience=5)
    data = EmployeeSerializer(emp).data
    assert data["hire_date"] == "2020-01-15"
    assert data["work_experience"] == 5
    assert "face_embedding" not in data


def test_import_reads_optional_new_fields(tmp_path):
    import json

    from django.core.management import call_command

    SpecialtyFactory(name="teplovoz mashinisti")
    path = tmp_path / "roster.json"
    path.write_text(json.dumps([
        {"name": "Ivanov Ivan", "speciality": "teplovoz mashinisti",
         "hire_date": "2019-03-01", "work_experience": 7},
        {"name": "Petrov Petr", "speciality": "teplovoz mashinisti"},
    ], ensure_ascii=False), encoding="utf-8")
    call_command("import_employees", "--file", str(path))
    ivanov = Employee.objects.get(full_name="Ivanov Ivan")
    assert str(ivanov.hire_date) == "2019-03-01"
    assert ivanov.work_experience == 7
    petrov = Employee.objects.get(full_name="Petrov Petr")
    assert petrov.hire_date is None
    assert petrov.work_experience is None
