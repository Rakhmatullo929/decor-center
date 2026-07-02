"""Production settings: HTTPS enforced (SRS §11.2)."""
from .base import *  # noqa: F403
from .base import MIDDLEWARE, env

DEBUG = False

SECRET_KEY = env("DJANGO_SECRET_KEY")  # required, no default in prod
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS")

# WhiteNoise serves collected static (Django admin + DRF/Swagger) straight from gunicorn,
# so the API host needs no separate static server. Must sit right after SecurityMiddleware.
MIDDLEWARE = list(MIDDLEWARE)
MIDDLEWARE.insert(1, "whitenoise.middleware.WhiteNoiseMiddleware")

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

SECURE_SSL_REDIRECT = env.bool("DJANGO_SECURE_SSL_REDIRECT", default=True)
# Health check must answer over plain HTTP (internal/LB probes) without a 301 to HTTPS.
SECURE_REDIRECT_EXEMPT = [r"^health/$"]
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 60 * 60 * 24 * 30
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_CONTENT_TYPE_NOSNIFF = True

CORS_ALLOWED_ORIGINS = env.list("DJANGO_CORS_ALLOWED_ORIGINS", default=[])
CSRF_TRUSTED_ORIGINS = env.list("DJANGO_CSRF_TRUSTED_ORIGINS", default=[])
