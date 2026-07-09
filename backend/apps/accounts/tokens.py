"""Password-less JWT issuance for flows that authenticate a user another way
(kiosk face + SMS OTP) and need a real login session, not just a login form."""
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User


def issue_token_pair(user: User, *, extra_claims: dict | None = None) -> dict:
    """Mint an access/refresh pair for `user`, mirroring DecorTokenObtainPairSerializer's claims."""
    refresh = RefreshToken.for_user(user)
    refresh["role"] = user.role
    refresh["username"] = user.username
    for key, value in (extra_claims or {}).items():
        refresh[key] = value
    return {"access": str(refresh.access_token), "refresh": str(refresh)}
