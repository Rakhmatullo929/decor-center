from apps.integrations.mocks import MockAntiSpoofingService
from apps.integrations.registry import get_anti_spoofing_service

from .conftest import png_bytes


def test_mock_anti_spoofing_passes_normal_image():
    assert MockAntiSpoofingService().check_liveness(png_bytes()) == (True, 1.0)


def test_mock_anti_spoofing_flags_spoof_marker():
    is_live, score = MockAntiSpoofingService().check_liveness(png_bytes() + b"SPOOF")
    assert is_live is False
    assert score == 0.0


def test_registry_resolves_anti_spoofing_default():
    assert isinstance(get_anti_spoofing_service(), MockAntiSpoofingService)
