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
    "TEST_GENERATOR_BACKEND": "apps.integrations.mocks.MockTestGeneratorService",
    # Pin submit-time re-verify OFF so existing submit tests stay deterministic; feature
    # tests opt in per-test via the `settings` fixture.
    "REVERIFY_ON_SUBMIT": "off",
    # Run TTS synthesis inline (no thread) so the signal is deterministic in tests.
    "TTS_ASYNC": False,
}
