import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.test import APIClient

from apps.accounts.models import Roles

from .factories import UserFactory


@pytest.fixture(autouse=True)
def isolated_media_root(settings, tmp_path):
    """Give every test its own MEDIA_ROOT so file-system state never leaks between tests."""
    settings.MEDIA_ROOT = str(tmp_path)


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
