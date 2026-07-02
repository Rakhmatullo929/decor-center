FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# System libraries required by OpenCV (pulled in transitively by insightface).
RUN apt-get update \
    && apt-get install -y --no-install-recommends libxcb1 libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements/ requirements/
RUN pip install --no-cache-dir -r requirements/dev.txt

# Bake the InsightFace model pack into the image (~14 MB) so the first request is
# fast and the container needs no internet at runtime. Only used when
# DECOR_FACE_BACKEND points to InsightFaceAdapter; harmless otherwise.
RUN python -c "from insightface.app import FaceAnalysis; FaceAnalysis(name='buffalo_sc', providers=['CPUExecutionProvider']).prepare(ctx_id=-1, det_size=(640, 640))"

COPY . .

EXPOSE 8000

CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
