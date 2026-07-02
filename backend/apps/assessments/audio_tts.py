"""UzbekVoice TTS worker for Question audio (driven by the post_save signal).

A raw urllib POST to the UzbekVoice REST endpoint; on success the returned audio
file is downloaded into question_audio/ and the row moves to `ready`, on any
failure the audio is cleared and the row moves to `error`. The worker never
raises — failures are logged and recorded on the row.
"""
import json
import logging
import threading
import urllib.request

from django.conf import settings
from django.core.files.base import ContentFile
from django.db import connection

from .models import Question

logger = logging.getLogger(__name__)

ENDPOINT = "https://uzbekvoice.ai/api/v1/tts"
TIMEOUT_SECONDS = 30


def enqueue_question_audio(question_id):
    """Run the worker in a daemon thread, or inline when TTS_ASYNC is off (tests)."""
    if settings.DEPO["TTS_ASYNC"]:
        threading.Thread(target=_run_in_thread, args=(question_id,), daemon=True).start()
    else:
        generate_question_audio(question_id)


def _run_in_thread(question_id):
    try:
        generate_question_audio(question_id)
    finally:
        # A spawned thread owns its own DB connection; close it so it is not leaked.
        connection.close()


def generate_question_audio(question_id):
    """Synthesize and store audio for one question. Never raises."""
    # Atomically claim the job: only one worker flips not_run/error -> processing.
    # QuerySet.update() bypasses signals, so this transition cannot re-trigger us.
    # NOTE: a process crash between here and the ready/error save leaves the row
    # stuck in `processing` (the gate never re-picks it). Accepted limitation —
    # no Celery, no reaper; recover with a manual audio_status reset.
    claimed = Question.objects.filter(
        pk=question_id, audio_status__in=("not_run", "error")
    ).update(audio_status="processing")
    if not claimed:
        return

    question = Question.objects.filter(pk=question_id).first()
    if question is None:
        return

    try:
        audio_bytes = _synthesize(question.text)
        if not audio_bytes:
            raise ValueError("UzbekVoice returned no audio")
    except Exception as exc:  # noqa: BLE001 - provider failure must not propagate
        logger.warning("TTS failed for question %s: %s", question_id, exc)
        question.audio.delete(save=False)
        question.audio_status = "error"
        question.save(update_fields=["audio", "audio_status", "updated_at"])
        return

    ext = _audio_extension(audio_bytes)
    question.audio.save(f"{question.id}.{ext}", ContentFile(audio_bytes), save=False)
    question.audio_status = "ready"
    question.save(update_fields=["audio", "audio_status", "updated_at"])


def _synthesize(text):
    """POST to UzbekVoice; return audio bytes (following result.url if JSON)."""
    payload = json.dumps(
        {"text": text, "model": settings.DEPO["TTS_VOICE_UZ"], "blocking": "true"}
    ).encode("utf-8")
    request = urllib.request.Request(
        ENDPOINT,
        data=payload,
        method="POST",
        headers={
            "Authorization": settings.DEPO["UZBEKVOICE_API_KEY"],
            "Content-Type": "application/json",
            "User-Agent": "depo-tts",
        },
    )
    with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
        content_type = response.headers.get("Content-Type", "")
        body = response.read()

    if "application/json" not in content_type.lower():
        return body
    data = json.loads(body)
    audio_url = _extract_audio_url(data)
    if not audio_url:
        raise ValueError(f"UzbekVoice response carried no audio URL: {data!r}")
    with urllib.request.urlopen(audio_url, timeout=TIMEOUT_SECONDS) as response:
        return response.read()


def _extract_audio_url(data):
    # UzbekVoice returns the file under result.url; the other keys/containers are
    # defensive fallbacks against minor response-shape drift, not observed shapes.
    containers = [data]
    if isinstance(data, dict):
        containers += [data.get("result"), data.get("data")]
    for container in containers:
        if isinstance(container, dict):
            for key in ("url", "audio_url", "audio", "output", "file"):
                value = container.get(key)
                if isinstance(value, str) and value:
                    return value
    return None


def _audio_extension(audio_bytes):
    if audio_bytes[:4] == b"RIFF" and audio_bytes[8:12] == b"WAVE":
        return "wav"
    if audio_bytes[:4] == b"OggS":
        return "ogg"
    return "mp3"  # MP3 and the default for unknown bytes
