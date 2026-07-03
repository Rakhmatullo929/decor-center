"""Test settings: fast hashing, throwaway media, deterministic mock integrations."""
import tempfile

from .dev import *  # noqa: F403
from .dev import DECOR

PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
MEDIA_ROOT = tempfile.mkdtemp(prefix="decor-test-media-")

# Pin the mock integration backends so the suite is deterministic and free of heavy
# ML deps, regardless of what backend/.env selects for dev/prod.
DECOR = {
    **DECOR,
    "FACE_RECOGNITION_BACKEND": "apps.integrations.mocks.MockFaceRecognitionService",
    "ANTI_SPOOFING_BACKEND": "apps.integrations.mocks.MockAntiSpoofingService",
    # Pin submit-time re-verify OFF so submit tests stay deterministic.
    "REVERIFY_ON_SUBMIT": "off",
    # Pin the knobs the suite asserts on to their code defaults, so tests are hermetic even
    # when DECOR_* env vars are injected (e.g. docker-compose env_file) — the "backend/.env
    # is not read under test settings" guard does not cover process environment variables.
    "FACE_SIMILARITY_THRESHOLD": 0.6,
    "FACE_WARMUP_ON_STARTUP": False,
}
