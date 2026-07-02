import pytest
from django.conf import settings

from apps.employees.face_enrollment import compute_centroid

from .factories import EmployeeFactory


def test_face_enrollment_settings_present():
    decor = settings.DECOR
    assert decor["FACE_MAX_PHOTOS_PER_EMPLOYEE"] == 5
    assert decor["FACE_MIN_FACE_PIXELS"] == 80
    assert decor["FACE_BLUR_MIN_VARIANCE"] == 0.0
    # Isolation guard: the test settings must NOT read backend/.env, so every knob is the
    # code default (e.g. 0.6) even when a local .env overrides it to 0.5.
    assert decor["FACE_SIMILARITY_THRESHOLD"] == 0.6
    assert decor["ANTI_SPOOFING_ENABLED"] is False
    assert decor["ANTI_SPOOFING_THRESHOLD"] == 0.5
    assert decor["ANTI_SPOOFING_BACKEND"].endswith("MockAntiSpoofingService")
    assert decor["FACE_WARMUP_ON_STARTUP"] is False


def test_insightface_model_settings_are_wired():
    """The InsightFace knobs the adapter reads must actually be present in DECOR (#7)."""
    decor = settings.DECOR
    assert decor["FACE_INSIGHTFACE_MODEL"] == "buffalo_sc"
    assert decor["FACE_DET_SIZE"] == 640


def test_reverify_on_submit_default_is_off_in_tests():
    """test.py must pin re-verify OFF so existing submit tests stay deterministic (#1)."""
    from django.conf import settings as dj_settings

    assert dj_settings.DECOR["REVERIFY_ON_SUBMIT"] == "off"


def test_compute_centroid_single_vector():
    vec = [1.0, 2.0, 3.0]
    result = compute_centroid([vec])
    assert result == [1.0, 2.0, 3.0]


def test_compute_centroid_multiple_vectors():
    vecs = [
        [1.0, 0.0],
        [3.0, 4.0],
    ]
    result = compute_centroid(vecs)
    assert result == [2.0, 2.0]


def test_compute_centroid_empty_raises():
    with pytest.raises(ValueError, match="empty"):
        compute_centroid([])


def test_compute_centroid_mismatched_dims_raises():
    with pytest.raises(ValueError, match="dimension"):
        compute_centroid([[1.0, 2.0], [1.0, 2.0, 3.0]])


def test_compute_centroid_is_plain_mean_no_normalization():
    """Centroid must NOT be L2-normalised.

    If normalisation were applied the result would be a unit vector.
    We deliberately choose embeddings whose plain mean is NOT unit-length
    and assert the non-unit result is returned intact.
    """
    vecs = [
        [3.0, 4.0],  # ||v|| = 5
        [6.0, 8.0],  # ||v|| = 10
    ]
    result = compute_centroid(vecs)
    # plain mean
    assert result == [4.5, 6.0]
    # NOT a unit vector (||result|| ≈ 7.5, not 1.0)
    norm_sq = sum(x * x for x in result)
    assert abs(norm_sq - 1.0) > 0.1, "centroid must not be L2-normalised"


@pytest.mark.django_db
def test_employee_face_photo_model_basics():
    from apps.employees.models import EmployeeFacePhoto

    emp = EmployeeFactory()
    sample = EmployeeFacePhoto.objects.create(
        employee=emp, photo="employees/face_photos/x.png", embedding=[0.1] * 16,
        model_version="mock-16",
    )
    assert emp.face_photos.count() == 1
    assert sample.created_at is not None
    assert list(emp.face_photos.all()) == [sample]


@pytest.mark.django_db
def test_backfill_legacy_samples_creates_one_per_employee():
    from apps.employees.face_enrollment import backfill_legacy_samples
    from apps.employees.models import Employee, EmployeeFacePhoto

    emp = EmployeeFactory(face_embedding=[0.5] * 16)  # factory also sets a photo
    created = backfill_legacy_samples(Employee, EmployeeFacePhoto)
    assert created == 1
    sample = emp.face_photos.get()
    assert sample.embedding == [0.5] * 16
    assert sample.model_version == "legacy"
    # idempotent — running again creates nothing
    assert backfill_legacy_samples(Employee, EmployeeFacePhoto) == 0
