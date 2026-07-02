"""Deterministic mock adapters for development and tests.

Behaviour is driven by markers embedded in the image bytes so that
both success and failure paths are reproducible:
  - b"NOFACE"    -> extract_embedding raises NoFaceDetectedError; compare fails
  - b"FAILMATCH" -> compare returns (False, low score)
Real providers replace these via the DECOR_*_BACKEND settings.
"""
import hashlib

from .base import (
    AntiSpoofingService,
    DetectedFace,
    FaceRecognitionService,
    GeneratedQuestion,
    NoFaceDetectedError,
    TestGeneratorService,
)


class MockFaceRecognitionService(FaceRecognitionService):
    EMBEDDING_SIZE = 16
    MODEL_VERSION = "mock-16"

    def extract_embedding(self, image_bytes: bytes) -> list[float]:
        if not image_bytes or b"NOFACE" in image_bytes:
            raise NoFaceDetectedError("No face detected in the photo. Please upload another photo.")
        digest = hashlib.sha256(image_bytes).digest()
        return [b / 255 for b in digest[: self.EMBEDDING_SIZE]]

    def compare_embeddings(
        self, reference_embedding: list[float], live_embedding: list[float]
    ) -> tuple[bool, float]:
        """Deterministic identity match: equal embeddings (same source image) match.

        Because extract_embedding hashes the image bytes, two different images yield
        different embeddings and do NOT match — so the anti-duplicate gate is meaningful
        under the mock (a frame marked FAILMATCH differs from any enrolled photo and so
        never matches; a NOFACE frame raises in extract_embedding upstream).
        """
        if len(reference_embedding) != len(live_embedding):
            return False, 0.0
        if all(abs(a - b) < 1e-9 for a, b in zip(reference_embedding, live_embedding, strict=True)):
            return True, 1.0
        return False, 0.0

    def detect(self, image_bytes: bytes) -> list[DetectedFace]:
        if not image_bytes or b"NOFACE" in image_bytes:
            return []
        embedding = self.extract_embedding(image_bytes)
        if b"MULTIFACE" in image_bytes:
            return [DetectedFace(embedding, 100, 100), DetectedFace(embedding, 90, 90)]
        if b"SMALLFACE" in image_bytes:
            return [DetectedFace(embedding, 10, 10)]
        return [DetectedFace(embedding, 100, 100)]


class MockAntiSpoofingService(AntiSpoofingService):
    def check_liveness(self, image_bytes: bytes) -> tuple[bool, float]:
        if not image_bytes or b"SPOOF" in image_bytes:
            return False, 0.0
        return True, 1.0


class MockTestGeneratorService(TestGeneratorService):
    def generate(self, source_text: str, count: int, language: str) -> list[GeneratedQuestion]:
        snippet = " ".join(source_text.split())[:80] or "the uploaded instruction"
        return [
            GeneratedQuestion(
                text=f"[MOCK/{language}] Question {i + 1} based on: {snippet}",
                options=[f"Option {letter}" for letter in "ABCD"],
                correct_option=i % 4,
            )
            for i in range(count)
        ]
