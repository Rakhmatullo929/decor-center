import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.employees.models import Employee

from .conftest import png_bytes
from .factories import SpecialtyFactory


@pytest.mark.django_db
def test_create_employee_with_phone(admin_client):
    specialty = SpecialtyFactory()
    photo = SimpleUploadedFile("p.png", png_bytes(), content_type="image/png")
    resp = admin_client.post(
        "/api/v1/employees/",
        {"full_name": "Ali Valiyev", "specialty": specialty.id,
         "phone": "+998901234567", "photo": photo},
        format="multipart",
    )
    assert resp.status_code == 201, resp.content
    assert resp.data["phone"] == "+998901234567"
    assert Employee.objects.get(pk=resp.data["id"]).phone == "+998901234567"


@pytest.mark.django_db
def test_create_employee_rejects_bad_phone(admin_client):
    specialty = SpecialtyFactory()
    photo = SimpleUploadedFile("p.png", png_bytes(), content_type="image/png")
    resp = admin_client.post(
        "/api/v1/employees/",
        {"full_name": "Bad Phone", "specialty": specialty.id,
         "phone": "12345", "photo": photo},
        format="multipart",
    )
    assert resp.status_code == 400
    assert "phone" in resp.data
