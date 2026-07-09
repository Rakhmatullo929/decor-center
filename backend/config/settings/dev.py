"""Development settings."""
from .base import *  # noqa: F403
from .base import REST_FRAMEWORK

DEBUG = True
ALLOWED_HOSTS = ["*"]

# Browsable API + session auth for convenient manual testing in dev
REST_FRAMEWORK = {
    **REST_FRAMEWORK,
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
        "rest_framework.renderers.BrowsableAPIRenderer",
    ],
}

# Dev-only: allow any local origin so the frontend works on whichever host port
# it lands on (3000, 3010, 5173, ...). Auth is JWT via the Authorization header
# (no cookies/credentials), so the server may safely reflect `*`. Consistent with
# the wide-open ALLOWED_HOSTS = ["*"] above. Never enable this in prod.
CORS_ALLOW_ALL_ORIGINS = True

# Kept for reference / explicit allow-list if CORS_ALLOW_ALL_ORIGINS is disabled.
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://localhost:3010",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
]
