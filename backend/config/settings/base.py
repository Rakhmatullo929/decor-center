"""Base settings shared by all environments."""
import os
from datetime import timedelta
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent.parent  # backend/

env = environ.Env()
_env_file = BASE_DIR / ".env"
# The test suite must be deterministic and independent of any local/CI .env: skip it so
# every DECOR knob resolves to its code default (the mock backends are pinned in test.py).
if _env_file.exists() and os.environ.get("DJANGO_SETTINGS_MODULE") != "config.settings.test":
    environ.Env.read_env(_env_file)

SECRET_KEY = env(
    "DJANGO_SECRET_KEY", default="insecure-dev-only-key-change-me-0123456789abcdef"
)
DEBUG = False
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=[])

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_filters",
    "drf_spectacular",
    # Local apps
    "apps.core",
    "apps.accounts",
    "apps.employees",
    "apps.integrations",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": env.db("DATABASE_URL", default="postgres://localhost:5432/decor"),
}

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Tashkent"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_PAGINATION_CLASS": "apps.core.pagination.DefaultPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=env.int("JWT_ACCESS_MINUTES", default=30)),
    "REFRESH_TOKEN_LIFETIME": timedelta(hours=env.int("JWT_REFRESH_HOURS", default=12)),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Decor Center — Employee Opinion Survey API",
    "DESCRIPTION": "Employee opinion-survey platform for decor-center (no scoring, no pass/fail).",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

# Face-recognition configuration (env-overridable). No scoring / TTS / AI-testgen knobs.
DECOR = {
    "FACE_SIMILARITY_THRESHOLD": env.float("DECOR_FACE_SIMILARITY_THRESHOLD", default=0.6),
    "FACE_RECOGNITION_BACKEND": env(
        "DECOR_FACE_BACKEND", default="apps.integrations.mocks.MockFaceRecognitionService"
    ),
    # InsightFace adapter tuning (only used when FACE_RECOGNITION_BACKEND is InsightFaceAdapter)
    "FACE_INSIGHTFACE_MODEL": env("DECOR_FACE_INSIGHTFACE_MODEL", default="buffalo_sc"),
    "FACE_DET_SIZE": env.int("DECOR_FACE_DET_SIZE", default=640),
    # Multi-photo face enrollment
    "FACE_MAX_PHOTOS_PER_EMPLOYEE": env.int("DECOR_FACE_MAX_PHOTOS", default=5),
    "FACE_MIN_FACE_PIXELS": env.int("DECOR_FACE_MIN_FACE_PIXELS", default=80),
    "FACE_BLUR_MIN_VARIANCE": env.float("DECOR_FACE_BLUR_MIN_VARIANCE", default=0.0),  # 0 = off
    "ANTI_SPOOFING_BACKEND": env(
        "DECOR_ANTI_SPOOFING_BACKEND", default="apps.integrations.mocks.MockAntiSpoofingService"
    ),
    "ANTI_SPOOFING_ENABLED": env.bool("DECOR_ANTI_SPOOFING_ENABLED", default=False),
    "ANTI_SPOOFING_THRESHOLD": env.float("DECOR_ANTI_SPOOFING_THRESHOLD", default=0.5),
    "FACE_WARMUP_ON_STARTUP": env.bool("DECOR_FACE_WARMUP_ON_STARTUP", default=False),
    # Submit-time face re-verification for surveys defaults OFF (opinion surveys, no integrity gate).
    "REVERIFY_ON_SUBMIT": env("DECOR_REVERIFY_ON_SUBMIT", default="off"),
}
