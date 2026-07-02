"""Resolve active integration backends from settings (DEPO dict)."""
from django.conf import settings
from django.utils.module_loading import import_string

from .base import AntiSpoofingService, FaceRecognitionService, TestGeneratorService


def get_face_recognition_service() -> FaceRecognitionService:
    return import_string(settings.DEPO["FACE_RECOGNITION_BACKEND"])()


def get_test_generator_service() -> TestGeneratorService:
    return import_string(settings.DEPO["TEST_GENERATOR_BACKEND"])()


def get_anti_spoofing_service() -> AntiSpoofingService:
    return import_string(settings.DEPO["ANTI_SPOOFING_BACKEND"])()
