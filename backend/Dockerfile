FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Dev/CI use the mock face backend (no InsightFace / OpenCV). The real ArcFace stack
# and its system libraries live in Dockerfile.prod.
COPY requirements/ requirements/
RUN pip install --no-cache-dir -r requirements/dev.txt

COPY . .

EXPOSE 8000

CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
