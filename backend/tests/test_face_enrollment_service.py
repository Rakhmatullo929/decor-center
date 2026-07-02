import os

import pytest
from rest_framework.exceptions import ValidationError

from apps.employees.face_enrollment import add_face_photo

from .conftest import png_bytes
from .factories import EmployeeFactory

pytestmark = pytest.mark.django_db


def _bytes(marker=b""):
    return png_bytes() + marker


def test_add_face_photo_happy_path_sets_sample_and_centroid(admin_user):
    emp = EmployeeFactory(face_embedding=None)
    sample = add_face_photo(emp, _bytes(), "p.png", user=admin_user)
    emp.refresh_from_db()
    assert emp.face_photos.count() == 1
    assert emp.face_embedding is not None and len(emp.face_embedding) == 16
    assert sample.model_version == "mock-16"
    assert sample.created_by_id == admin_user.id


def test_add_face_photo_no_face(admin_user):
    emp = EmployeeFactory(face_embedding=None)
    with pytest.raises(ValidationError) as exc:
        add_face_photo(emp, _bytes(b"NOFACE"), "p.png", user=admin_user)
    assert exc.value.detail["code"] == ["no_face"]


def test_add_face_photo_multiple_faces(admin_user):
    emp = EmployeeFactory(face_embedding=None)
    with pytest.raises(ValidationError) as exc:
        add_face_photo(emp, _bytes(b"MULTIFACE"), "p.png", user=admin_user)
    assert exc.value.detail["code"] == ["multiple_faces"]


def test_add_face_photo_face_too_small(admin_user):
    emp = EmployeeFactory(face_embedding=None)
    with pytest.raises(ValidationError) as exc:
        add_face_photo(emp, _bytes(b"SMALLFACE"), "p.png", user=admin_user)
    assert exc.value.detail["code"] == ["face_too_small"]


def test_add_face_photo_limit_reached(admin_user, settings):
    settings.DECOR = {**settings.DECOR, "FACE_MAX_PHOTOS_PER_EMPLOYEE": 1}
    emp = EmployeeFactory(face_embedding=None)
    add_face_photo(emp, _bytes(), "a.png", user=admin_user)
    with pytest.raises(ValidationError) as exc:
        add_face_photo(emp, _bytes(), "b.png", user=admin_user)
    assert exc.value.detail["code"] == ["limit_reached"]


def test_add_face_photo_duplicate_of_another_employee(admin_user):
    # The other employee's stored face is the canonical photo (factory default); enrolling
    # that SAME face onto a different employee must be rejected as a duplicate.
    EmployeeFactory()
    emp = EmployeeFactory(face_embedding=None)
    with pytest.raises(ValidationError) as exc:
        add_face_photo(emp, _bytes(), "p.png", user=admin_user)
    assert exc.value.detail["code"] == ["duplicate"]


def test_add_face_photo_allows_distinct_face_when_others_enrolled(admin_user):
    """A genuinely different face must NOT be flagged as a duplicate (#1).

    Regression: the mock used to 'match' any image, so enrolling a 2nd employee was
    always rejected as a duplicate in the default backend.
    """
    EmployeeFactory()  # another enrolled employee whose face is the canonical (white) photo
    emp = EmployeeFactory(face_embedding=None)
    sample = add_face_photo(emp, png_bytes("black"), "p.png", user=admin_user)
    emp.refresh_from_db()
    assert sample.id is not None
    assert emp.face_photos.count() == 1


def test_add_face_photo_not_duplicate_with_failmatch(admin_user):
    EmployeeFactory(face_embedding=[0.5] * 16)
    emp = EmployeeFactory(face_embedding=None)
    sample = add_face_photo(emp, _bytes(b"FAILMATCH"), "p.png", user=admin_user)
    assert emp.face_photos.count() == 1
    assert sample.id is not None


def test_add_face_photo_reuses_embedding_for_dedup_no_re_detect(admin_user, monkeypatch):
    """Anti-duplicate must reuse the already-extracted embedding, not re-run detection (#12)."""
    from apps.employees import face_enrollment
    from apps.integrations.mocks import MockFaceRecognitionService

    seen = {}

    class CountingService(MockFaceRecognitionService):
        def identify_best_match(self, candidates, image_bytes=None, *, live_embedding=None):
            seen["live_embedding"] = live_embedding
            seen["image_bytes"] = image_bytes
            return None, 0.0  # no duplicate

    monkeypatch.setattr(
        face_enrollment, "get_face_recognition_service", lambda: CountingService()
    )
    EmployeeFactory()  # ensures the candidate list is non-empty so dedup actually runs
    emp = EmployeeFactory(face_embedding=None)
    add_face_photo(emp, png_bytes("black"), "p.png", user=admin_user)

    assert seen["live_embedding"] is not None  # reused the embedding from detection
    assert seen["image_bytes"] is None  # did NOT hand bytes back for a second detect


def test_add_face_photo_spoof_detected(admin_user, settings):
    settings.DECOR = {**settings.DECOR, "ANTI_SPOOFING_ENABLED": True}
    emp = EmployeeFactory(face_embedding=None)
    with pytest.raises(ValidationError) as exc:
        add_face_photo(emp, _bytes(b"SPOOF"), "p.png", user=admin_user)
    assert exc.value.detail["code"] == ["spoof_detected"]


def test_add_face_photo_blur_rejected_when_enabled(admin_user, settings):
    # png_bytes() is a flat 8x8 image → FIND_EDGES variance is 0 → below any positive threshold
    settings.DECOR = {**settings.DECOR, "FACE_BLUR_MIN_VARIANCE": 1.0}
    emp = EmployeeFactory(face_embedding=None)
    with pytest.raises(ValidationError) as exc:
        add_face_photo(emp, _bytes(), "p.png", user=admin_user)
    assert exc.value.detail["code"] == ["low_quality"]


def test_failed_gate_leaves_no_orphan_file(admin_user, settings):
    emp = EmployeeFactory(face_embedding=None)
    with pytest.raises(ValidationError):
        add_face_photo(emp, _bytes(b"NOFACE"), "p.png", user=admin_user)
    face_dir = os.path.join(settings.MEDIA_ROOT, "employees", "face_photos")
    assert not os.path.isdir(face_dir) or os.listdir(face_dir) == []


def test_recompute_centroid_ignores_stale_dimension(admin_user):
    # After a backend switch an employee may carry a stale 16-dim legacy sample
    # alongside a new 512-dim one; the centroid must use only the newest dimension.
    from apps.employees.face_enrollment import recompute_centroid
    from apps.employees.models import EmployeeFacePhoto

    emp = EmployeeFactory(face_embedding=None)
    EmployeeFacePhoto.objects.create(
        employee=emp, photo="a.png", embedding=[0.0] * 16, model_version="legacy"
    )
    EmployeeFacePhoto.objects.create(
        employee=emp, photo="b.png", embedding=[0.5] * 512, model_version="arcface-buffalo_sc-512"
    )
    recompute_centroid(emp)
    emp.refresh_from_db()
    assert emp.face_embedding is not None
    assert len(emp.face_embedding) == 512  # newest dimension wins; stale 16-dim ignored


def test_recompute_centroid_is_mean_of_samples(admin_user, settings):
    settings.DECOR = {**settings.DECOR, "FACE_MAX_PHOTOS_PER_EMPLOYEE": 5}
    emp = EmployeeFactory(face_embedding=None)
    add_face_photo(emp, _bytes(), "a.png", user=admin_user)
    add_face_photo(emp, _bytes(b"FAILMATCH"), "b.png", user=admin_user)
    emp.refresh_from_db()
    samples = list(emp.face_photos.values_list("embedding", flat=True))
    expected = [(samples[0][i] + samples[1][i]) / 2 for i in range(16)]
    assert emp.face_embedding == expected


def test_recompute_centroid_one_stale_newest_does_not_poison_template(admin_user):
    """A single stale-backend sample (even the newest) must not discard the active set.

    Active backend in tests is the mock ('mock-16'). Two good mock samples plus one
    newer 512-dim sample from a previous/other backend → the centroid must stay the
    mean of the two active mock samples, not collapse onto the lone stale vector.
    """
    from apps.employees.face_enrollment import recompute_centroid
    from apps.employees.models import EmployeeFacePhoto

    emp = EmployeeFactory(face_embedding=None)
    EmployeeFacePhoto.objects.create(
        employee=emp, photo="a.png", embedding=[0.2] * 16, model_version="mock-16"
    )
    EmployeeFacePhoto.objects.create(
        employee=emp, photo="b.png", embedding=[0.4] * 16, model_version="mock-16"
    )
    EmployeeFacePhoto.objects.create(
        employee=emp, photo="c.png", embedding=[0.9] * 512, model_version="arcface-buffalo_sc-512"
    )
    recompute_centroid(emp)
    emp.refresh_from_db()
    assert len(emp.face_embedding) == 16
    assert emp.face_embedding == pytest.approx([0.3] * 16)


def test_limit_counts_only_active_dimension_samples(admin_user, settings):
    """Stale samples from a previous backend must not block enrolling fresh ones.

    The per-employee limit and the centroid must agree on which samples are 'active':
    after a backend switch, stale-dimension samples count toward neither.
    """
    from apps.employees.models import EmployeeFacePhoto

    settings.DECOR = {**settings.DECOR, "FACE_MAX_PHOTOS_PER_EMPLOYEE": 2}
    emp = EmployeeFactory(face_embedding=None)
    EmployeeFacePhoto.objects.create(
        employee=emp, photo="a.png", embedding=[0.1] * 512, model_version="arcface-buffalo_sc-512"
    )
    EmployeeFacePhoto.objects.create(
        employee=emp, photo="b.png", embedding=[0.2] * 512, model_version="arcface-buffalo_sc-512"
    )
    # Active backend is the mock (16-dim); the two stale 512-dim samples are not of
    # the active dimension, so adding a fresh mock sample must NOT hit the limit.
    sample = add_face_photo(emp, _bytes(), "c.png", user=admin_user)
    assert sample.id is not None
