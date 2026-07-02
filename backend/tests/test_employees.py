import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.employees.models import Employee

from .conftest import png_bytes
from .factories import EmployeeFactory, SpecialtyFactory

pytestmark = pytest.mark.django_db

EMPLOYEES_URL = "/api/v1/employees/"
SPECIALTIES_URL = "/api/v1/specialties/"


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


def test_specialist_can_search_employees_by_name(specialist_client):
    EmployeeFactory(full_name="Karimov Aziz")
    EmployeeFactory(full_name="Toshev Bobur")
    response = specialist_client.get(EMPLOYEES_URL, {"search": "Karimov"})
    assert response.status_code == 200
    assert response.data["count"] == 1
    assert response.data["results"][0]["full_name"] == "Karimov Aziz"


def test_specialist_cannot_create_employee(specialist_client):
    specialty = SpecialtyFactory()
    response = specialist_client.post(
        EMPLOYEES_URL,
        {"full_name": "Hacker", "specialty": specialty.id, "photo": _photo()},
        format="multipart",
    )
    assert response.status_code == 403


def test_specialties_readable_by_all_roles_writable_by_admin(admin_client, specialist_client):
    assert admin_client.post(SPECIALTIES_URL, {"name": "New specialty"}).status_code == 201
    assert specialist_client.get(SPECIALTIES_URL).status_code == 200
    assert specialist_client.post(SPECIALTIES_URL, {"name": "Nope"}).status_code == 403
