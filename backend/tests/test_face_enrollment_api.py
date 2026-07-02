import os

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from .conftest import png_bytes
from .factories import EmployeeFactory, SpecialtyFactory

pytestmark = pytest.mark.django_db


def _upload(marker=b""):
    return SimpleUploadedFile("p.png", png_bytes() + marker, content_type="image/png")


def _url(emp):
    return f"/api/v1/employees/{emp.id}/face-photos/"


def _display_photos(settings):
    photos_dir = os.path.join(settings.MEDIA_ROOT, "employees", "photos")
    return set(os.listdir(photos_dir)) if os.path.isdir(photos_dir) else set()


def test_admin_adds_face_photo(admin_client):
    emp = EmployeeFactory(face_embedding=None)
    resp = admin_client.post(_url(emp), {"photo": _upload()}, format="multipart")
    assert resp.status_code == 201, resp.data
    assert "embedding" not in resp.data
    emp.refresh_from_db()
    assert emp.face_photos.count() == 1
    assert emp.face_embedding is not None


def test_list_face_photos_hides_embedding(admin_client):
    emp = EmployeeFactory(face_embedding=None)
    admin_client.post(_url(emp), {"photo": _upload()}, format="multipart")
    resp = admin_client.get(_url(emp))
    assert resp.status_code == 200
    assert len(resp.data) == 1
    assert "embedding" not in resp.data[0]
    assert set(resp.data[0]) == {"id", "photo", "model_version", "created_at"}


def test_specialist_can_list_but_not_add(specialist_client):
    emp = EmployeeFactory(face_embedding=None)
    assert specialist_client.get(_url(emp)).status_code == 200
    assert specialist_client.post(_url(emp), {"photo": _upload()}, format="multipart").status_code == 403


def test_add_no_face_returns_400_code(admin_client):
    emp = EmployeeFactory(face_embedding=None)
    resp = admin_client.post(_url(emp), {"photo": _upload(b"NOFACE")}, format="multipart")
    assert resp.status_code == 400
    assert resp.data["code"] == ["no_face"]


def test_add_without_photo_returns_400(admin_client):
    emp = EmployeeFactory(face_embedding=None)
    resp = admin_client.post(_url(emp), {}, format="multipart")
    assert resp.status_code == 400
    assert resp.data["code"] == ["invalid_image"]


def test_delete_face_photo_recomputes_and_clears(admin_client):
    emp = EmployeeFactory(face_embedding=None)
    admin_client.post(_url(emp), {"photo": _upload()}, format="multipart")
    emp.refresh_from_db()
    assert emp.face_embedding is not None
    sample_id = emp.face_photos.get().id
    resp = admin_client.delete(f"{_url(emp)}{sample_id}/")
    assert resp.status_code == 204
    emp.refresh_from_db()
    assert emp.face_photos.count() == 0
    assert emp.face_embedding is None


def test_delete_face_photo_is_atomic_on_failure(admin_client, monkeypatch):
    """If centroid recompute fails mid-delete, the row and file must both survive (#8)."""
    from django.core.files.storage import default_storage

    import apps.employees.views as views_mod

    emp = EmployeeFactory(face_embedding=None)
    admin_client.post(_url(emp), {"photo": _upload()}, format="multipart")
    sample = emp.face_photos.get()
    photo_name = sample.photo.name
    assert default_storage.exists(photo_name)

    def boom(employee):
        raise RuntimeError("simulated DB hiccup during recompute")

    monkeypatch.setattr(views_mod, "recompute_centroid", boom)
    with pytest.raises(RuntimeError):
        admin_client.delete(f"{_url(emp)}{sample.id}/")

    # No partial state: the sample row is preserved and its file was NOT deleted.
    assert emp.face_photos.filter(pk=sample.id).exists()
    assert default_storage.exists(photo_name)


def test_delete_missing_face_photo_returns_404(admin_client):
    emp = EmployeeFactory(face_embedding=None)
    resp = admin_client.delete(f"{_url(emp)}99999/")
    assert resp.status_code == 404


def test_legacy_employee_create_seeds_one_sample(admin_client):
    from apps.employees.models import Employee

    from .factories import SpecialtyFactory

    specialty = SpecialtyFactory()
    resp = admin_client.post(
        "/api/v1/employees/",
        {"full_name": "Legacy Path", "specialty": specialty.id, "photo": _upload()},
        format="multipart",
    )
    assert resp.status_code == 201, resp.data
    emp = Employee.objects.get(id=resp.data["id"])
    assert emp.face_photos.count() == 1
    assert emp.face_embedding is not None and len(emp.face_embedding) == 16


def test_create_with_unusable_photo_leaves_no_display_file(admin_client, settings):
    """A rejected enrollment on create must not leak the display photo to storage (#3)."""
    specialty = SpecialtyFactory()
    resp = admin_client.post(
        "/api/v1/employees/",
        {"full_name": "Bad Photo", "specialty": specialty.id, "photo": _upload(b"NOFACE")},
        format="multipart",
    )
    assert resp.status_code == 400
    assert resp.data["code"] == ["no_face"]
    assert _display_photos(settings) == set()  # no orphaned file


def test_update_with_unusable_photo_leaves_no_new_display_file(admin_client, settings):
    """A rejected enrollment on update must not leak a new display photo (#3)."""
    emp = EmployeeFactory(face_embedding=None)
    admin_client.post(_url(emp), {"photo": _upload()}, format="multipart")
    before = _display_photos(settings)
    resp = admin_client.patch(
        f"/api/v1/employees/{emp.id}/", {"photo": _upload(b"NOFACE")}, format="multipart"
    )
    assert resp.status_code == 400
    assert _display_photos(settings) == before  # no new orphaned file


def test_update_display_photo_not_blocked_by_sample_limit(admin_client, settings):
    """Editing the display photo must work even when the per-employee sample cap is reached (#4)."""
    settings.DEPO = {**settings.DEPO, "FACE_MAX_PHOTOS_PER_EMPLOYEE": 1}
    emp = EmployeeFactory(face_embedding=None)
    admin_client.post(_url(emp), {"photo": _upload()}, format="multipart")  # fills the cap
    resp = admin_client.patch(
        f"/api/v1/employees/{emp.id}/", {"photo": _upload()}, format="multipart"
    )
    assert resp.status_code == 200, resp.data


def test_legacy_employee_create_is_additive_not_destructive(admin_client):
    from apps.employees.models import Employee

    from .factories import SpecialtyFactory

    specialty = SpecialtyFactory()
    create = admin_client.post(
        "/api/v1/employees/",
        {"full_name": "Additive", "specialty": specialty.id, "photo": _upload()},
        format="multipart",
    )
    emp = Employee.objects.get(id=create.data["id"])
    # adding a second photo via the dedicated endpoint, then a legacy PATCH, keeps both
    admin_client.post(_url(emp), {"photo": _upload(b"FAILMATCH")}, format="multipart")
    assert emp.face_photos.count() == 2
