import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from apps.employees.models import Employee
from apps.surveys.models import (
    Answer,
    FaceVerificationLog,
    OtpChallenge,
    SurveySession,
)

from .conftest import png_bytes
from .factories import (
    EmployeeFactory,
    QuestionFactory,
    SpecialtyFactory,
    SurveySessionFactory,
)

pytestmark = pytest.mark.django_db

EMPLOYEES_URL = "/api/v1/employees/"
SPECIALTIES_URL = "/api/v1/specialties/"


def _detail_url(employee_id):
    return f"{EMPLOYEES_URL}{employee_id}/"


def _photo():
    return SimpleUploadedFile("photo.png", png_bytes(), content_type="image/png")


def test_admin_creates_employee_and_embedding_is_generated(admin_client):
    specialty = SpecialtyFactory()
    response = admin_client.post(
        EMPLOYEES_URL,
        {"full_name": "Karimov Aziz Bahodirovich", "specialty": specialty.id, "photo": _photo()},
        format="multipart",
    )
    assert response.status_code == 201, response.data
    employee = Employee.objects.get(id=response.data["id"])
    assert employee.face_embedding is not None
    assert len(employee.face_embedding) == 16
    # Embedding must never leak through the API.
    assert "face_embedding" not in response.data


def test_photo_without_face_is_rejected(admin_client, photo_without_face):
    specialty = SpecialtyFactory()
    response = admin_client.post(
        EMPLOYEES_URL,
        {"full_name": "No Face", "specialty": specialty.id, "photo": photo_without_face},
        format="multipart",
    )
    assert response.status_code == 400
    assert "photo" in response.data
    assert Employee.objects.count() == 0


def test_employee_can_search_employees_by_name(employee_client):
    EmployeeFactory(full_name="Karimov Aziz")
    EmployeeFactory(full_name="Toshev Bobur")
    response = employee_client.get(EMPLOYEES_URL, {"search": "Karimov"})
    assert response.status_code == 200
    assert response.data["count"] == 1
    assert response.data["results"][0]["full_name"] == "Karimov Aziz"


def test_employee_cannot_create_employee(employee_client):
    specialty = SpecialtyFactory()
    response = employee_client.post(
        EMPLOYEES_URL,
        {"full_name": "Hacker", "specialty": specialty.id, "photo": _photo()},
        format="multipart",
    )
    assert response.status_code == 403


def test_specialties_readable_by_all_roles_writable_by_admin(admin_client, employee_client):
    assert admin_client.post(SPECIALTIES_URL, {"name": "New specialty"}).status_code == 201
    assert employee_client.get(SPECIALTIES_URL).status_code == 200
    assert employee_client.post(SPECIALTIES_URL, {"name": "Nope"}).status_code == 403


def test_list_filters_by_is_active(employee_client):
    active = EmployeeFactory(is_active=True)
    EmployeeFactory(is_active=False)

    response = employee_client.get(EMPLOYEES_URL, {"is_active": "true"})

    assert response.status_code == 200
    assert response.data["count"] == 1
    assert response.data["results"][0]["id"] == active.id


def test_admin_deletes_employee_and_cascades_survey_history(admin_client):
    """Deleting an employee removes the employee and all their protected survey history."""
    employee = EmployeeFactory()
    question = QuestionFactory()
    session = SurveySessionFactory(employee=employee, test=question.block.test)
    Answer.objects.create(session=session, question=question, text_value="hi")
    FaceVerificationLog.objects.create(employee=employee, success=True)
    OtpChallenge.objects.create(
        employee=employee,
        code_hash="x" * 8,
        expires_at=timezone.now() + timezone.timedelta(minutes=5),
    )

    response = admin_client.delete(_detail_url(employee.id))

    assert response.status_code == 204, getattr(response, "data", response.content)
    assert not Employee.objects.filter(id=employee.id).exists()
    assert not SurveySession.objects.filter(employee_id=employee.id).exists()
    assert not Answer.objects.filter(session_id=session.id).exists()
    assert not FaceVerificationLog.objects.filter(employee_id=employee.id).exists()
    assert not OtpChallenge.objects.filter(employee_id=employee.id).exists()


def test_admin_deletes_employee_without_history(admin_client):
    employee = EmployeeFactory()

    response = admin_client.delete(_detail_url(employee.id))

    assert response.status_code == 204
    assert not Employee.objects.filter(id=employee.id).exists()


def test_employee_cannot_delete_employee(employee_client):
    employee = EmployeeFactory()

    response = employee_client.delete(_detail_url(employee.id))

    assert response.status_code == 403
    assert Employee.objects.filter(id=employee.id).exists()
