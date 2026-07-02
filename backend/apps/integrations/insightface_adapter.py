"""Production face-recognition adapter using InsightFace (ArcFace via ONNX Runtime).

Matches the declared dependency stack (`insightface`, `onnxruntime`,
`opencv-python-headless` in requirements/base.txt). Embeddings are **512-dim,
L2-normalized**; similarity is **cosine** (dot product of normalized vectors),
so `settings.DECOR["FACE_SIMILARITY_THRESHOLD"]` is interpreted here as the
**MIN cosine similarity** for a match (default 0.6; lower = looser).

Enable in .env:
    DECOR_FACE_BACKEND=apps.integrations.insightface_adapter.InsightFaceAdapter
    DECOR_FACE_SIMILARITY_THRESHOLD=0.5   # cosine; 0.4 loose / 0.6 strict
    DECOR_FACE_INSIGHTFACE_MODEL=buffalo_sc   # optional (default buffalo_sc)

The model pack (~14 MB for buffalo_sc) is downloaded to ~/.insightface on first
use; the Docker image bakes it in at build time. Requires the cv2 system libs
(libxcb1, libgl1, libglib2.0-0) — installed in backend/Dockerfile.
"""
import logging
import threading

import numpy as np
from django.conf import settings

from .base import FaceRecognitionService, NoFaceDetectedError

logger = logging.getLogger(__name__)

EMBEDDING_DIM = 512


class InsightFaceAdapter(FaceRecognitionService):
    """ArcFace adapter (InsightFace `buffalo_sc` by default, CPU/ONNX Runtime)."""

    MODEL_VERSION = "arcface-buffalo_sc-512"

    # The FaceAnalysis app is heavy (~100 ms+ and a model load); build it once,
    # process-wide, guarded for thread safety under the dev/gunicorn server.
    _app = None
    _lock = threading.Lock()

    @classmethod
    def _get_app(cls):
        if cls._app is None:
            with cls._lock:
                if cls._app is None:
                    from insightface.app import FaceAnalysis

                    model = settings.DECOR.get("FACE_INSIGHTFACE_MODEL", "buffalo_sc")
                    det = int(settings.DECOR.get("FACE_DET_SIZE", 640))
                    app = FaceAnalysis(name=model, providers=["CPUExecutionProvider"])
                    app.prepare(ctx_id=-1, det_size=(det, det))
                    cls._app = app
                    logger.info("InsightFace model '%s' loaded (det_size=%d).", model, det)
        return cls._app

    # ── Internal helpers ────────────────────────────────────────────────────

    @staticmethod
    def _decode_bgr(image_bytes: bytes) -> np.ndarray:
        """Decode image bytes → BGR uint8 ndarray, or None if the bytes aren't a valid image."""
        import cv2

        if not image_bytes:
            return None
        try:
            return cv2.imdecode(np.frombuffer(image_bytes, dtype=np.uint8), cv2.IMREAD_COLOR)
        except cv2.error:
            return None

    def _faces(self, image_bytes: bytes):
        """Detected faces (largest bbox first); [] if no face OR the image can't be decoded.

        Returning [] (rather than raising) lets compare()/identify_best_match() degrade to a
        clean no-match and detect() to the `no_face` enrollment gate, instead of a 500 on a
        corrupt/empty camera frame. extract_embedding() turns the empty list into
        NoFaceDetectedError for its callers.
        """
        img = self._decode_bgr(image_bytes)
        if img is None:
            return []
        faces = self._get_app().get(img)
        faces.sort(key=lambda f: float((f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1])), reverse=True)
        return faces

    @staticmethod
    def _unit(vec: np.ndarray) -> np.ndarray:
        norm = float(np.linalg.norm(vec))
        return vec / norm if norm else vec

    # ── FaceRecognitionService interface ────────────────────────────────────

    def extract_embedding(self, image_bytes: bytes) -> list[float]:
        """Reference photo → 512-dim L2-normalized embedding (largest face)."""
        faces = self._faces(image_bytes)
        if not faces:
            raise NoFaceDetectedError(
                "No face detected. Look directly at the camera and ensure good lighting."
            )
        return faces[0].normed_embedding.astype(float).tolist()

    def detect(self, image_bytes: bytes):
        """All detected faces with embedding + bbox size (for the enrollment gate)."""
        from .base import DetectedFace

        out = []
        for f in self._faces(image_bytes):
            x1, y1, x2, y2 = (int(v) for v in f.bbox)
            out.append(
                DetectedFace(
                    embedding=f.normed_embedding.astype(float).tolist(),
                    width=max(0, x2 - x1),
                    height=max(0, y2 - y1),
                )
            )
        return out

    def compare_embeddings(
        self, reference_embedding: list[float], live_embedding: list[float]
    ) -> tuple[bool, float]:
        """1:1 cosine match between two embeddings. Stale-dimension embeddings never match."""
        if len(reference_embedding) != EMBEDDING_DIM or len(live_embedding) != EMBEDDING_DIM:
            logger.warning(
                "Stale embedding (ref=%d-dim, live=%d-dim, expected %d). Run reindex_face_embeddings.",
                len(reference_embedding),
                len(live_embedding),
                EMBEDDING_DIM,
            )
            return False, 0.0

        ref = self._unit(np.asarray(reference_embedding, dtype=np.float32))
        live = self._unit(np.asarray(live_embedding, dtype=np.float32))
        similarity = float(np.dot(ref, live))
        threshold: float = settings.DECOR["FACE_SIMILARITY_THRESHOLD"]
        matched = similarity >= threshold
        logger.debug("compare: cosine=%.4f threshold=%.2f matched=%s", similarity, threshold, matched)
        return matched, round(similarity, 4)

    def identify_best_match(
        self,
        candidates: list[tuple[int, list[float]]],
        image_bytes: bytes | None = None,
        *,
        live_embedding: list[float] | None = None,
    ) -> tuple[int | None, float]:
        """1:N search: encode the live frame once, return the best cosine match.

        Accepts either the raw frame (``image_bytes``) or a precomputed ``live_embedding``
        so an enrollment that already detected the face does not detect a second time.
        Skips candidates whose embedding dimension isn't 512 (stale mock data).
        """
        if not candidates:
            return None, 0.0

        if live_embedding is None:
            faces = self._faces(image_bytes)
            if not faces:
                return None, 0.0
            live = faces[0].normed_embedding.astype(np.float32)
        else:
            live = self._unit(np.asarray(live_embedding, dtype=np.float32))

        valid = [(cid, emb) for cid, emb in candidates if len(emb) == EMBEDDING_DIM]
        if not valid:
            logger.warning(
                "All %d candidates have wrong embedding dimensions. "
                "Run: manage.py reindex_face_embeddings",
                len(candidates),
            )
            return None, 0.0

        ids = [c[0] for c in valid]
        matrix = np.asarray([c[1] for c in valid], dtype=np.float32)  # (N, 512)
        norms = np.linalg.norm(matrix, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        sims = (matrix / norms) @ live  # (N,) cosine, higher = better

        best_idx = int(np.argmax(sims))
        best_sim = float(sims[best_idx])
        threshold: float = settings.DECOR["FACE_SIMILARITY_THRESHOLD"]
        logger.debug(
            "identify: best cosine=%.4f (threshold=%.2f) for candidate id=%s",
            best_sim, threshold, ids[best_idx],
        )
        if best_sim < threshold:
            return None, round(best_sim, 4)
        return ids[best_idx], round(best_sim, 4)

    def warmup(self) -> None:
        """Load the model once at startup so the first request isn't slow."""
        try:
            self._get_app()
        except Exception:
            logger.exception("InsightFace warmup failed")
