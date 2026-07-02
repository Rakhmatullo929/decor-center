import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command

from .conftest import png_bytes
from .factories import EmployeeFactory

pytestmark = pytest.mark.django_db


def test_reindex_rebuilds_sample_embeddings_and_centroid():
    from apps.employees.models import EmployeeFacePhoto

    emp = EmployeeFactory(face_embedding=None)
    sample = EmployeeFacePhoto.objects.create(
        employee=emp,
        photo=SimpleUploadedFile("s.png", png_bytes(), content_type="image/png"),
        embedding=[0.0] * 16,          # stale / wrong values
        model_version="legacy",
    )
    call_command("reindex_face_embeddings", "--id", str(emp.id))
    sample.refresh_from_db()
    emp.refresh_from_db()
    assert sample.model_version == "mock-16"
    assert sample.embedding != [0.0] * 16
    assert emp.face_embedding == sample.embedding  # centroid of one sample == that sample


def test_reindex_is_all_or_nothing_when_a_sample_fails():
    """A mid-employee failure must leave NO sample partially re-embedded and the centroid untouched."""
    from apps.employees.models import EmployeeFacePhoto

    emp = EmployeeFactory(face_embedding=[0.0] * 16)
    good = EmployeeFacePhoto.objects.create(
        employee=emp,
        photo=SimpleUploadedFile("g.png", png_bytes(), content_type="image/png"),
        embedding=[0.0] * 16,
        model_version="legacy",
    )
    EmployeeFacePhoto.objects.create(
        employee=emp,
        photo=SimpleUploadedFile("b.png", png_bytes() + b"NOFACE", content_type="image/png"),
        embedding=[0.0] * 16,
        model_version="legacy",
    )
    with pytest.raises(SystemExit):  # command exits non-zero when any employee fails
        call_command("reindex_face_embeddings", "--id", str(emp.id))

    good.refresh_from_db()
    emp.refresh_from_db()
    # The good sample must NOT have been re-embedded (all-or-nothing), and the
    # centroid must be untouched — no half-updated state.
    assert good.embedding == [0.0] * 16
    assert good.model_version == "legacy"
    assert emp.face_embedding == [0.0] * 16
