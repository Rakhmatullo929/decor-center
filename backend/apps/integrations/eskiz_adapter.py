"""Eskiz.uz SMS adapter (future). Enable via DECOR_SMS_BACKEND once credentials exist."""
from .base import SmsSender


class EskizSmsSender(SmsSender):
    """Placeholder for the real Eskiz integration (notify.eskiz.uz).

    Wiring plan (later): authenticate with ESKIZ_EMAIL/ESKIZ_PASSWORD to obtain a
    bearer token, POST to /message/sms/send with {mobile_phone, message, from}.
    """

    def send(self, phone: str, text: str) -> None:
        raise NotImplementedError(
            "Eskiz SMS integration is not configured yet. "
            "Keep DECOR_SMS_BACKEND on MockSmsSender until credentials are added."
        )
