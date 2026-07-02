"""Auto-generate UzbekVoice TTS audio for approved specialty questions.

A post_save receiver on Question kicks off audio synthesis after commit so a
provider call never blocks (or rolls back with) the admin's save.
"""
from django.conf import settings
from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from .audio_tts import enqueue_question_audio
from .models import Module, Question

# Saves touching only these fields are the worker's own bookkeeping writes;
# skipping them stops the signal from re-triggering itself (infinite loop),
# including the error-state save whose status would otherwise re-match the gate.
_AUDIO_BOOKKEEPING_FIELDS = {"audio", "audio_status", "audio_text_hash", "updated_at"}


@receiver(post_save, sender=Question, dispatch_uid="question_audio_tts")
def generate_question_audio_on_save(sender, instance, update_fields, **kwargs):
    if update_fields is not None and set(update_fields) <= _AUDIO_BOOKKEEPING_FIELDS:
        return
    if instance.module != Module.SPECIALTY or instance.status != Question.Status.APPROVED:
        return
    # Only (re)generate when audio is missing or previously failed. By design this
    # does NOT refresh audio after a text edit on an already-ready question, nor
    # while one is mid-flight (processing) — that is intentional, not a bug.
    if instance.audio_status not in ("not_run", "error"):
        return
    if not settings.DEPO["UZBEKVOICE_API_KEY"]:
        return
    pk = instance.pk
    transaction.on_commit(lambda: enqueue_question_audio(pk))
