"""Base settings shared by all environments."""
import os
from datetime import timedelta
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent.parent  # backend/

env = environ.Env()
_env_file = BASE_DIR / ".env"
# The test suite must be deterministic and independent of any local/CI .env: skip it so
# every DEPO knob resolves to its code default (the mock backends are pinned in test.py).
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
    "apps.instructions",
    "apps.assessments",
    "apps.medical",
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
    "default": env.db("DATABASE_URL", default="postgres://localhost:5432/depo"),
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
    "TITLE": "Locomotive Depot Assessment & Medical System API",
    "DESCRIPTION": "Employee knowledge assessment and medical examination system — Bukhara Locomotive Depot.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

# Domain configuration (SRS §15 agreed defaults, overridable via env)
DEPO = {
    "QUESTIONS_PER_TEST": env.int("DEPO_QUESTIONS_PER_TEST", default=10),
    "PASS_THRESHOLD": env.int("DEPO_PASS_THRESHOLD", default=8),
    "FACE_SIMILARITY_THRESHOLD": env.float("DEPO_FACE_SIMILARITY_THRESHOLD", default=0.6),
    "TESTGEN_LANGUAGE": env("DEPO_TESTGEN_LANGUAGE", default="uz"),
    "FACE_RECOGNITION_BACKEND": env(
        "DEPO_FACE_BACKEND", default="apps.integrations.mocks.MockFaceRecognitionService"
    ),
    # InsightFace adapter tuning (only used when FACE_RECOGNITION_BACKEND is InsightFaceAdapter)
    "FACE_INSIGHTFACE_MODEL": env("DEPO_FACE_INSIGHTFACE_MODEL", default="buffalo_sc"),
    "FACE_DET_SIZE": env.int("DEPO_FACE_DET_SIZE", default=640),
    "TEST_GENERATOR_BACKEND": env(
        "DEPO_TESTGEN_BACKEND", default="apps.integrations.mocks.MockTestGeneratorService"
    ),
    "TTS_VOICE_UZ": env("DEPO_TTS_VOICE_UZ", default="lola"),
    "UZBEKVOICE_API_KEY": env("UZBEKVOICE_API_KEY", default=""),
    "TTS_ASYNC": env.bool("DEPO_TTS_ASYNC", default=True),
    # Multi-photo face enrollment
    "FACE_MAX_PHOTOS_PER_EMPLOYEE": env.int("DEPO_FACE_MAX_PHOTOS", default=5),
    "FACE_MIN_FACE_PIXELS": env.int("DEPO_FACE_MIN_FACE_PIXELS", default=80),
    "FACE_BLUR_MIN_VARIANCE": env.float("DEPO_FACE_BLUR_MIN_VARIANCE", default=0.0),  # 0 = off
    "ANTI_SPOOFING_BACKEND": env(
        "DEPO_ANTI_SPOOFING_BACKEND", default="apps.integrations.mocks.MockAntiSpoofingService"
    ),
    "ANTI_SPOOFING_ENABLED": env.bool("DEPO_ANTI_SPOOFING_ENABLED", default=False),
    "ANTI_SPOOFING_THRESHOLD": env.float("DEPO_ANTI_SPOOFING_THRESHOLD", default=0.5),
    "FACE_WARMUP_ON_STARTUP": env.bool("DEPO_FACE_WARMUP_ON_STARTUP", default=False),
    # Submit-time face re-verification: off (disabled) | log (capture+log only) | block (reject).
    "REVERIFY_ON_SUBMIT": env("DEPO_REVERIFY_ON_SUBMIT", default="log"),
}
