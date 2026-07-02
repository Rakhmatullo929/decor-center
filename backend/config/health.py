"""Unauthenticated liveness/readiness probe for container healthchecks and load balancers."""
from django.db import connection
from django.http import JsonResponse


def health(_request):
    """Return 200 when the database answers, 503 otherwise."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
    except Exception:
        return JsonResponse({"status": "error"}, status=503)
    return JsonResponse({"status": "ok"})
