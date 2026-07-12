import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.test import APIClient

from apps.accounts.models import Roles
from apps.surveys.models import Question

from .factories import (
    QuestionBlockFactory,
    QuestionFactory,
    TestFactory,
    UserFactory,
)


@pytest.fixture(autouse=True)
def isolated_media_root(settings, tmp_path):
    """Give every test its own MEDIA_ROOT so file-system state never leaks between tests."""
    settings.MEDIA_ROOT = str(tmp_path)


@pytest.fixture(autouse=True)
def _clear_throttle_cache():
    """Reset DRF throttle counters between tests so per-scope rate limits never leak."""
    from django.core.cache import cache

    cache.clear()
    yield
    cache.clear()


def png_bytes(color="white") -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (8, 8), color).save(buffer, "PNG")
    return buffer.getvalue()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def admin_user(db):
    return UserFactory(username="admin-test", role=Roles.ADMIN)


@pytest.fixture
def employee_user(db):
    return UserFactory(username="employee-test", role=Roles.EMPLOYEE)


@pytest.fixture
def admin_client(admin_user):
    client = APIClient()
    client.force_authenticate(admin_user)
    return client


@pytest.fixture
def employee_client(employee_user):
    client = APIClient()
    client.force_authenticate(employee_user)
    return client


@pytest.fixture
def survey_with_questions(db):
    """A survey with one single-choice and one textarea question — shared across the
    surveys API / status-progress test modules."""
    survey = TestFactory()
    block = QuestionBlockFactory(test=survey, order=0)
    q_single = QuestionFactory(
        block=block, type=Question.Type.SINGLE, order=0,
        options=[{"id": "a", "text": "Yes"}, {"id": "b", "text": "No"}],
    )
    q_text = QuestionFactory(block=block, type=Question.Type.TEXTAREA, order=1, options=[])
    return survey, q_single, q_text


@pytest.fixture
def face_image():
    """Valid camera frame: mock face service accepts it."""
    return SimpleUploadedFile("frame.png", png_bytes(), content_type="image/png")


@pytest.fixture
def face_image_fail():
    """Frame with the FAILMATCH marker: mock comparison fails."""
    return SimpleUploadedFile(
        "frame.png", png_bytes() + b"FAILMATCH", content_type="image/png"
    )


@pytest.fixture
def photo_without_face():
    """Photo with the NOFACE marker: mock embedding extraction fails (SRS §4.3)."""
    return SimpleUploadedFile(
        "photo.png", png_bytes() + b"NOFACE", content_type="image/png"
    )
