import json
import urllib.error

import pytest
from django.core.files.base import ContentFile
from rest_framework.test import APIRequestFactory

from apps.assessments.models import Module, Question
from apps.assessments.serializers import QuestionAdminSerializer, QuestionPublicSerializer

from .factories import QuestionFactory


@pytest.fixture
def media_tmp(settings, tmp_path):
    settings.MEDIA_ROOT = str(tmp_path)
    return settings


@pytest.fixture
def tts_enabled(settings):
    # An API key turns the signal on; test settings keep it empty by default.
    settings.DEPO = {**settings.DEPO, "UZBEKVOICE_API_KEY": "test-key", "TTS_VOICE_UZ": "lola"}
    return settings


class _FakeResponse:
    def __init__(self, payload: bytes, content_type: str = "audio/wav"):
        self._payload = payload
        self.headers = {"Content-Type": content_type}

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def read(self):
        return self._payload


# A WAV magic-byte blob so _audio_extension picks ".wav".
WAV_BYTES = b"RIFF\x00\x00\x00\x00WAVEdata"


def _json_url_then_audio(monkeypatch, counter, audio=WAV_BYTES):
    """Patch urlopen: POST returns {"result": {"url": ...}}, then the URL returns audio."""
    def fake_urlopen(target, timeout=None):
        if hasattr(target, "full_url"):  # the TTS POST (a Request object)
            counter["post"] = counter.get("post", 0) + 1
            counter["url"] = target.full_url
            counter["auth"] = target.headers["Authorization"]
            counter["body"] = json.loads(target.data.decode("utf-8"))
            return _FakeResponse(
                json.dumps({"result": {"url": "https://cdn.uzbekvoice.ai/a.wav"}}).encode(),
                content_type="application/json",
            )
        return _FakeResponse(audio)  # the audio download (a URL string)

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)


def _approve(question):
    question.status = Question.Status.APPROVED
    question.save(update_fields=["status", "updated_at"])


@pytest.mark.django_db
def test_approve_generates_audio_via_signal(
    tts_enabled, media_tmp, monkeypatch, django_capture_on_commit_callbacks
):
    calls = {}
    _json_url_then_audio(monkeypatch, calls)
    question = QuestionFactory(status=Question.Status.DRAFT)

    with django_capture_on_commit_callbacks(execute=True):
        _approve(question)

    question.refresh_from_db()
    assert calls["url"] == "https://uzbekvoice.ai/api/v1/tts"
    assert calls["auth"] == "test-key"
    assert calls["body"] == {"text": question.text, "model": "lola", "blocking": "true"}
    assert question.audio_status == "ready"
    assert question.audio
    assert question.audio.read() == WAV_BYTES
    assert "question_audio/" in question.audio.name


@pytest.mark.django_db
def test_http_error_sets_error_status_and_empty_audio(
    tts_enabled, media_tmp, monkeypatch, django_capture_on_commit_callbacks
):
    def boom(target, timeout=None):
        raise urllib.error.URLError("provider down")

    monkeypatch.setattr("urllib.request.urlopen", boom)
    question = QuestionFactory(status=Question.Status.DRAFT)

    with django_capture_on_commit_callbacks(execute=True):
        _approve(question)

    question.refresh_from_db()
    assert question.audio_status == "error"
    assert not question.audio


@pytest.mark.django_db
def test_error_save_does_not_loop(
    tts_enabled, media_tmp, monkeypatch, django_capture_on_commit_callbacks
):
    calls = {"post": 0}

    def boom(target, timeout=None):
        calls["post"] += 1
        raise urllib.error.URLError("down")

    monkeypatch.setattr("urllib.request.urlopen", boom)
    question = QuestionFactory(status=Question.Status.DRAFT)

    with django_capture_on_commit_callbacks(execute=True):
        _approve(question)

    question.refresh_from_db()
    assert question.audio_status == "error"
    # The error-save (audio_status=error) is a bookkeeping write; the recursion
    # guard stops it re-entering the gate and retrying. Exactly one POST.
    assert calls["post"] == 1


@pytest.mark.django_db
def test_ready_path_makes_exactly_one_post(
    tts_enabled, media_tmp, monkeypatch, django_capture_on_commit_callbacks
):
    calls = {"post": 0}
    _json_url_then_audio(monkeypatch, calls)
    question = QuestionFactory(status=Question.Status.DRAFT)

    with django_capture_on_commit_callbacks(execute=True):
        _approve(question)

    question.refresh_from_db()
    assert question.audio_status == "ready"
    assert calls["post"] == 1


@pytest.mark.django_db
def test_draft_question_does_not_generate(
    tts_enabled, media_tmp, monkeypatch, django_capture_on_commit_callbacks
):
    def fail(*a, **k):
        raise AssertionError("must not call UzbekVoice for a draft")

    monkeypatch.setattr("urllib.request.urlopen", fail)

    with django_capture_on_commit_callbacks(execute=True):
        question = QuestionFactory(status=Question.Status.DRAFT)

    question.refresh_from_db()
    assert question.audio_status == "not_run"
    assert not question.audio


@pytest.mark.django_db
def test_safety_module_does_not_generate(
    tts_enabled, media_tmp, monkeypatch, django_capture_on_commit_callbacks
):
    def fail(*a, **k):
        raise AssertionError("must not call UzbekVoice for a safety module")

    monkeypatch.setattr("urllib.request.urlopen", fail)

    with django_capture_on_commit_callbacks(execute=True):
        question = QuestionFactory(
            module=Module.TECH_SAFETY, specialty=None, status=Question.Status.APPROVED
        )

    question.refresh_from_db()
    assert question.audio_status == "not_run"
    assert not question.audio


@pytest.mark.django_db
def test_no_api_key_is_a_noop(media_tmp, monkeypatch, django_capture_on_commit_callbacks):
    # No tts_enabled fixture -> UZBEKVOICE_API_KEY stays "" in test settings.
    def fail(*a, **k):
        raise AssertionError("must not call UzbekVoice without an API key")

    monkeypatch.setattr("urllib.request.urlopen", fail)
    question = QuestionFactory(status=Question.Status.DRAFT)

    with django_capture_on_commit_callbacks(execute=True):
        _approve(question)

    question.refresh_from_db()
    assert question.audio_status == "not_run"
    assert not question.audio


@pytest.mark.django_db
def test_public_serializer_exposes_absolute_audio_url(media_tmp):
    question = QuestionFactory(status=Question.Status.APPROVED)
    question.audio.save("q.mp3", ContentFile(b"AUDIO"), save=False)
    question.audio_status = "ready"
    question.save(update_fields=["audio", "audio_status", "updated_at"])

    request = APIRequestFactory().get("/")
    data = QuestionPublicSerializer(question, context={"request": request}).data

    assert data["audio_url"] is not None
    assert data["audio_url"].startswith("http")
    assert "/media/question_audio/" in data["audio_url"]


@pytest.mark.django_db
def test_public_serializer_audio_url_null_without_audio():
    question = QuestionFactory(status=Question.Status.APPROVED)

    data = QuestionPublicSerializer(question).data

    assert data["audio_url"] is None


@pytest.mark.django_db
def test_raw_audio_bytes_response_is_saved_directly(
    tts_enabled, media_tmp, monkeypatch, django_capture_on_commit_callbacks
):
    # When the POST itself returns audio bytes (non-JSON), use them with no second fetch.
    calls = {"post": 0}

    def fake_urlopen(target, timeout=None):
        assert hasattr(target, "full_url"), "must not make a second (download) request"
        calls["post"] += 1
        return _FakeResponse(WAV_BYTES, content_type="audio/wav")

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)
    question = QuestionFactory(status=Question.Status.DRAFT)

    with django_capture_on_commit_callbacks(execute=True):
        _approve(question)

    question.refresh_from_db()
    assert question.audio_status == "ready"
    assert question.audio.read() == WAV_BYTES
    assert calls["post"] == 1


@pytest.mark.django_db
def test_json_without_audio_url_sets_error(
    tts_enabled, media_tmp, monkeypatch, django_capture_on_commit_callbacks
):
    def fake_urlopen(target, timeout=None):
        return _FakeResponse(
            json.dumps({"status": "queued"}).encode(), content_type="application/json"
        )

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)
    question = QuestionFactory(status=Question.Status.DRAFT)

    with django_capture_on_commit_callbacks(execute=True):
        _approve(question)

    question.refresh_from_db()
    assert question.audio_status == "error"
    assert not question.audio


@pytest.mark.parametrize(
    "blob, expected",
    [
        (b"RIFF\x00\x00\x00\x00WAVEdata", "wav"),
        (b"OggS\x00\x00\x00\x00more", "ogg"),
        (b"ID3\x04\x00\x00\x00\x00\x00\x00", "mp3"),
        (b"\xff\xfb\x90\x00unknown", "mp3"),
    ],
)
def test_audio_extension_from_magic_bytes(blob, expected):
    from apps.assessments.audio_tts import _audio_extension

    assert _audio_extension(blob) == expected


@pytest.mark.django_db
def test_admin_serializer_exposes_audio_status_read_only():
    question = QuestionFactory(status=Question.Status.APPROVED)

    data = QuestionAdminSerializer(question).data

    assert data["audio_status"] == "not_run"
    assert "audio" in data
    assert "audio_status" in QuestionAdminSerializer().fields
    assert QuestionAdminSerializer().fields["audio_status"].read_only is True
