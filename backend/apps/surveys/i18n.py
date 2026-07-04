"""Helpers for bilingual (uz/ru) text stored as {"uz": ..., "ru": ...}.

Older rows (and any write that bypasses the serializer, e.g. factories/fixtures)
may still hold a plain string — every helper here accepts both shapes so
reading never breaks on legacy data.
"""


def display_text(value, lang: str = "ru") -> str:
    """Resolve a bilingual value to a single display string (ru, falling back to uz)."""
    if isinstance(value, dict):
        other = "uz" if lang == "ru" else "ru"
        return str(value.get(lang) or value.get(other) or "")
    return str(value or "")


def normalize_i18n(value) -> dict:
    """Upgrade a plain string or partial dict into a canonical {"uz", "ru"} dict."""
    if isinstance(value, dict):
        return {"uz": str(value.get("uz") or ""), "ru": str(value.get("ru") or "")}
    return {"uz": "", "ru": str(value or "")}


def empty_i18n() -> dict:
    return {"uz": "", "ru": ""}
