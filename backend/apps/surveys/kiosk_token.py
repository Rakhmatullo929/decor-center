"""Short-lived signed token that authorises kiosk survey calls after OTP verification.

Not a login: minted server-side after face/manual identify + SMS code, carried in the
X-Kiosk-Token header. Stateless (django signing), scoped to one employee, short TTL.
"""
from django.conf import settings as dj_settings
from django.core import signing

_SALT = "decor.kiosk.token"


def issue_kiosk_token(employee_id: int, *, fallback: bool = False) -> str:
    return signing.dumps(
        {"employee_id": int(employee_id), "fallback": bool(fallback)}, salt=_SALT
    )


def read_kiosk_token(token: str) -> dict | None:
    try:
        data = signing.loads(
            token, salt=_SALT, max_age=dj_settings.DECOR["KIOSK_TOKEN_TTL"]
        )
    except signing.BadSignature:
        return None
    return {
        "employee_id": int(data["employee_id"]),
        "fallback": bool(data.get("fallback", False)),
    }
