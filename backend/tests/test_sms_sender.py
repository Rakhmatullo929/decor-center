import pytest

from apps.integrations.base import SmsSender
from apps.integrations.eskiz_adapter import EskizSmsSender
from apps.integrations.mocks import MockSmsSender
from apps.integrations.registry import get_sms_sender


def test_registry_resolves_mock_by_default():
    assert isinstance(get_sms_sender(), SmsSender)
    assert isinstance(get_sms_sender(), MockSmsSender)


def test_mock_sender_never_raises(caplog):
    MockSmsSender().send("+998901234567", "code 0000")  # no exception, logs only


def test_eskiz_adapter_is_a_stub():
    with pytest.raises(NotImplementedError):
        EskizSmsSender().send("+998901234567", "code 1234")
