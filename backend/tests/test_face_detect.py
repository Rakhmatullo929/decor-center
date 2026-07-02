from apps.integrations.mocks import MockFaceRecognitionService

from .conftest import png_bytes


def test_mock_detect_single_normal_face():
    faces = MockFaceRecognitionService().detect(png_bytes())
    assert len(faces) == 1
    assert faces[0].width == 100 and faces[0].height == 100
    assert len(faces[0].embedding) == 16


def test_mock_detect_no_face_returns_empty():
    assert MockFaceRecognitionService().detect(png_bytes() + b"NOFACE") == []


def test_mock_detect_multiple_faces():
    assert len(MockFaceRecognitionService().detect(png_bytes() + b"MULTIFACE")) == 2


def test_mock_detect_small_face():
    faces = MockFaceRecognitionService().detect(png_bytes() + b"SMALLFACE")
    assert len(faces) == 1
    assert faces[0].width == 10


def test_base_default_detect_uses_extract_embedding():
    # The base default returns one size-unknown face; [] when no face.
    svc = MockFaceRecognitionService()
    # mock overrides detect, so exercise the base default explicitly:
    from apps.integrations.base import FaceRecognitionService

    faces = FaceRecognitionService.detect(svc, png_bytes())
    assert len(faces) == 1 and faces[0].width is None
    assert FaceRecognitionService.detect(svc, png_bytes() + b"NOFACE") == []


def test_mock_warmup_is_noop():
    assert MockFaceRecognitionService().warmup() is None
