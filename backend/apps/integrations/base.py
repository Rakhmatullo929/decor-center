"""Service interfaces (ports) for external face-recognition integrations.

Domain code depends only on these abstractions. Concrete face adapters
(the mock backend in dev/CI; InsightFace in prod) are resolved through
`apps.integrations.registry`.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass


class NoFaceDetectedError(Exception):
    """Raised when no face can be found in the supplied image (SRS §4.3)."""


@dataclass(frozen=True)
class DetectedFace:
    """One detected face: its embedding plus optional bounding-box size in pixels."""

    embedding: list[float]
    width: int | None = None
    height: int | None = None


class FaceRecognitionService(ABC):
    """Server-side face embedding extraction and comparison (SRS §12.3)."""

    @abstractmethod
    def extract_embedding(self, image_bytes: bytes) -> list[float]:
        """Return a face embedding for the reference photo.

        Raises NoFaceDetectedError if no face is present.
        """

    @abstractmethod
    def compare_embeddings(
        self, reference_embedding: list[float], live_embedding: list[float]
    ) -> tuple[bool, float]:
        """Compare two embeddings using the backend's own metric and threshold.

        Returns (matched, similarity_score). This is the single source of truth for the
        matching metric; compare() and identify_best_match() are built on top of it.
        """

    def compare(self, reference_embedding: list[float], image_bytes: bytes) -> tuple[bool, float]:
        """Compare a live camera frame against a stored reference embedding.

        Extracts the live embedding once, then delegates to compare_embeddings().
        Returns (False, 0.0) if no face is present in the frame.
        """
        try:
            live_embedding = self.extract_embedding(image_bytes)
        except NoFaceDetectedError:
            return False, 0.0
        return self.compare_embeddings(reference_embedding, live_embedding)

    def identify_best_match(
        self,
        candidates: list[tuple[int, list[float]]],
        image_bytes: bytes | None = None,
        *,
        live_embedding: list[float] | None = None,
    ) -> tuple[int | None, float]:
        """1:N search: find the best-matching employee from a candidate list.

        candidates — list of (employee_id, face_embedding) pairs.
        Provide either ``image_bytes`` (the live frame, embedded once here) or a
        precomputed ``live_embedding`` so callers that already detected the face do not
        pay for a second detection. Returns (employee_id, score) of the best match, or
        (None, 0.0).

        Default: calls compare_embeddings() per candidate (fine for small sets ≤ 200).
        Override this for vectorised batch comparison on larger employee bases.
        """
        if live_embedding is None:
            try:
                live_embedding = self.extract_embedding(image_bytes)
            except NoFaceDetectedError:
                return None, 0.0
        best_id: int | None = None
        best_score = 0.0
        for cand_id, embedding in candidates:
            try:
                matched, score = self.compare_embeddings(embedding, live_embedding)
            except Exception:
                continue
            if matched and score > best_score:
                best_score = score
                best_id = cand_id
        return best_id, best_score

    def detect(self, image_bytes: bytes) -> list["DetectedFace"]:
        """Return detected faces (embedding + optional bbox size).

        Default: a single size-unknown face from extract_embedding; [] if no face.
        Adapters override this for multi-face detection and bounding-box sizes.
        """
        try:
            return [DetectedFace(embedding=self.extract_embedding(image_bytes))]
        except NoFaceDetectedError:
            return []

    def warmup(self) -> None:
        """Preload any heavy model so the first real request isn't slow. No-op by default."""
        return None


class AntiSpoofingService(ABC):
    """Passive single-image anti-spoofing (best-effort for static uploaded photos)."""

    @abstractmethod
    def check_liveness(self, image_bytes: bytes) -> tuple[bool, float]:
        """Return (is_live, score). Higher score = more likely a genuine live capture."""


class SmsError(Exception):
    """Raised when an SMS provider fails to accept/deliver a message."""


class SmsSender(ABC):
    """Outbound SMS port. The mock no-ops in dev/CI; Eskiz sends in prod."""

    @abstractmethod
    def send(self, phone: str, text: str) -> None:
        """Send `text` to `phone` (E.164). Raise SmsError on provider failure."""
