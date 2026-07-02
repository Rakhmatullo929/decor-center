"""Face enrollment helpers for the Depo backend.

`compute_centroid` and `backfill_legacy_samples` are deliberately numpy-free
(pure Python) so they work with the mock backend and inside data migrations.
The enrollment service (`add_face_photo` and friends) does depend on Django/DRF.
"""
from __future__ import annotations

import io
import logging
import statistics

from django.conf import settings
from django.core.files.base import ContentFile
from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.integrations.registry import (
    get_anti_spoofing_service,
    get_face_recognition_service,
)

from .models import Employee, EmployeeFacePhoto

logger = logging.getLogger(__name__)


def compute_centroid(embeddings: list[list[float]]) -> list[float]:
    """Return the plain arithmetic mean of a list of equal-length embedding vectors.

    The centroid is NOT L2-normalised: the active backend (InsightFace/ArcFace) matches by
    cosine, which normalises internally, so the un-normalised mean is a valid template.
    Keeping it a pure-Python mean (no numpy) also lets this run under the mock backend and
    inside data migrations.

    Args:
        embeddings: A non-empty list of equal-length float vectors.

    Returns:
        A new list of floats representing the element-wise mean.

    Raises:
        ValueError: If *embeddings* is empty or the vectors have mismatched
            dimensions.
    """
    if not embeddings:
        raise ValueError("embeddings list must not be empty")

    dim = len(embeddings[0])
    for i, vec in enumerate(embeddings[1:], start=1):
        if len(vec) != dim:
            raise ValueError(
                f"dimension mismatch: vector 0 has length {dim} but "
                f"vector {i} has length {len(vec)}"
            )

    n = len(embeddings)
    centroid = [sum(vec[j] for vec in embeddings) / n for j in range(dim)]
    return centroid


def backfill_legacy_samples(EmployeeModel, FacePhotoModel) -> int:
    """Create one 'legacy' face sample per employee that has an embedding but no samples.

    Receives model classes (real or migration-frozen) so it is safe to call from a data
    migration via apps.get_model. Copies the existing embedding and references the same
    photo file — loads no ML model. Returns the number of samples created.
    """
    created = 0
    for emp in EmployeeModel.objects.filter(face_embedding__isnull=False):
        if not emp.photo:
            continue
        if FacePhotoModel.objects.filter(employee=emp).exists():
            continue
        FacePhotoModel.objects.create(
            employee=emp,
            photo=emp.photo.name,
            embedding=emp.face_embedding,
            model_version="legacy",
        )
        created += 1
    return created


def backend_model_version(service) -> str:
    """Tag stored embeddings with the backend that produced them.

    Each FaceRecognitionService declares a `MODEL_VERSION`; fall back to the class
    name for any backend that doesn't.
    """
    return getattr(service, "MODEL_VERSION", type(service).__name__)


def _fail(code: str, message: str):
    raise ValidationError({"code": [code], "photo": [message]})


def _check_blur(image_bytes: bytes, min_variance: float) -> None:
    """Reject blurry photos via the variance of edge intensities (Pillow only; numpy-free).

    Sharpness is the variance of an edge-detected image: sharp photos have strong,
    varied edges (high variance); blurry or flat photos have weak, uniform edges
    (low variance). The 1px border is dropped first because Pillow's convolution
    leaves border pixels unfiltered, which would otherwise inject spurious
    high-contrast values on small images.
    """
    if min_variance <= 0:
        return
    from PIL import Image, ImageFilter

    edges = Image.open(io.BytesIO(image_bytes)).convert("L").filter(ImageFilter.FIND_EDGES)
    width, height = edges.size
    if width > 2 and height > 2:
        edges = edges.crop((1, 1, width - 1, height - 1))
    values = list(edges.getdata())
    variance = statistics.pvariance(values) if len(values) > 1 else 0.0
    if variance < min_variance:
        _fail("low_quality", "Photo is too blurry. Use a sharper, well-lit photo.")


def _active_template_embeddings(samples: list[tuple[str, list[float]]]) -> list[list[float]]:
    """Pick the embeddings that form the active template from (model_version, embedding) rows.

    Selection is backend-aware rather than recency-based:

    1. Prefer samples produced by the currently-active backend, matched by ``model_version``.
       This is the common, correct case and never mixes incompatible embeddings (even two
       different backends that happen to share a dimension).
    2. If no sample matches the active backend (e.g. only legacy/unknown-version rows remain
       after a backend switch), fall back to the largest group sharing one embedding
       dimension, breaking ties toward the newest sample's dimension.

    Either way a single stale-backend sample can never discard the rest of the template,
    and the result is always dimension-consistent so ``compute_centroid`` cannot crash.
    ``samples`` must be ordered oldest→newest.
    """
    if not samples:
        return []

    active_version = backend_model_version(get_face_recognition_service())
    by_version = [emb for version, emb in samples if version == active_version]
    if by_version:
        return by_version

    embeddings = [emb for _version, emb in samples]
    dims = [len(emb) for emb in embeddings]
    newest_dim = dims[-1]
    best_dim = max(set(dims), key=lambda d: (dims.count(d), d == newest_dim))
    return [emb for emb in embeddings if len(emb) == best_dim]


def recompute_centroid(employee) -> None:
    """Recompute Employee.face_embedding as the mean of the ACTIVE backend's samples.

    Samples are grouped by the backend that produced them (``model_version``); only the
    active backend's samples contribute, so a stale sample left over from a previous
    backend (e.g. a 16-dim mock vector beside 512-dim ArcFace ones) never poisons the
    centroid — see :func:`_active_template_embeddings`. If the employee has samples but
    none are usable for the active backend the centroid is cleared and a warning is
    logged; run ``manage.py reindex_face_embeddings`` to rebuild them. Ordering is
    ``(created_at, id)`` so the tie-break is deterministic.
    """
    samples = list(
        employee.face_photos.order_by("created_at", "id").values_list(
            "model_version", "embedding"
        )
    )
    active = _active_template_embeddings(samples)
    if not active:
        if samples:
            logger.warning(
                "Employee %s has %d face sample(s) but none usable for the active backend; "
                "clearing centroid. Run: manage.py reindex_face_embeddings",
                employee.pk,
                len(samples),
            )
        employee.face_embedding = None
    else:
        dropped = len(samples) - len(active)
        if dropped:
            logger.info(
                "Employee %s: ignoring %d stale face sample(s) when recomputing centroid.",
                employee.pk,
                dropped,
            )
        employee.face_embedding = compute_centroid(active)
    employee.save(update_fields=["face_embedding"])


@transaction.atomic
def add_face_photo(
    employee,
    image_bytes: bytes,
    filename: str,
    user=None,
    *,
    enforce_limit: bool = True,
) -> EmployeeFacePhoto:
    """Quality-gate a photo, persist it as a sample, and recompute the centroid.

    Gates run on in-memory bytes BEFORE any file is written, so a rejected photo
    leaves no orphan file. Raises rest_framework.exceptions.ValidationError on any
    gate failure (DRF renders it as HTTP 400 with a stable `code`).

    Set ``enforce_limit=False`` for the implicit sample seeded from an employee's
    display photo, which must never be rejected just because the per-employee photo
    cap is already reached (the quality and anti-duplicate gates still apply).
    """
    cfg = settings.DEPO

    # 1. anti-spoofing (optional)
    if cfg["ANTI_SPOOFING_ENABLED"]:
        is_live, score = get_anti_spoofing_service().check_liveness(image_bytes)
        if not is_live or score < cfg["ANTI_SPOOFING_THRESHOLD"]:
            _fail("spoof_detected", "Liveness check failed. Use a live, in-person photo.")

    # 2. detection — exactly one face
    service = get_face_recognition_service()
    faces = service.detect(image_bytes)
    if len(faces) == 0:
        _fail("no_face", "No face detected. Use a clear, front-facing photo.")
    if len(faces) > 1:
        _fail("multiple_faces", "Multiple faces detected. The photo must contain exactly one face.")
    face = faces[0]

    # 3. face size
    min_px = cfg["FACE_MIN_FACE_PIXELS"]
    if face.width is not None and face.height is not None:
        if min(face.width, face.height) < min_px:
            _fail("face_too_small", f"Face is too small. It must be at least {min_px}px wide.")

    # 4. blur (optional)
    _check_blur(image_bytes, cfg["FACE_BLUR_MIN_VARIANCE"])

    # 5. per-employee limit — count only samples of the active embedding dimension, so
    #    stale samples from a previous backend never block fresh enrollment and the limit
    #    agrees with the centroid about which samples are "active".
    if enforce_limit:
        max_photos = cfg["FACE_MAX_PHOTOS_PER_EMPLOYEE"]
        active_dim = len(face.embedding)
        active_count = sum(
            1
            for emb in employee.face_photos.values_list("embedding", flat=True)
            if len(emb) == active_dim
        )
        if active_count >= max_photos:
            _fail(
                "limit_reached",
                f"This employee already has the maximum of {max_photos} face photos.",
            )

    # 6. anti-duplicate vs OTHER employees: reuses identify_best_match, which applies the
    #    backend's own metric and the live-match threshold (DEPO_FACE_SIMILARITY_THRESHOLD).
    others = (
        Employee.objects.filter(is_active=True, face_embedding__isnull=False)
        .exclude(pk=employee.pk)
        .only("id", "face_embedding")
    )
    candidates = [(e.id, e.face_embedding) for e in others]
    if candidates:
        # Reuse the embedding already extracted in step 2 — no second decode/detect.
        best_id, _score = service.identify_best_match(candidates, live_embedding=face.embedding)
        if best_id is not None:
            _fail("duplicate", f"This face already matches another employee (id={best_id}).")

    # persist sample (file is written only now, after all gates pass)
    sample = EmployeeFacePhoto(
        employee=employee,
        embedding=face.embedding,
        model_version=backend_model_version(service),
        created_by=user,
    )
    sample.photo.save(filename, ContentFile(image_bytes), save=False)
    sample.save()

    recompute_centroid(employee)
    return sample
