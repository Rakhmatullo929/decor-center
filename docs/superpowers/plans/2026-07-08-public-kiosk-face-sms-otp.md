# Public Kiosk (Face + SMS OTP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Employees take surveys with no login — a public `/scan` route turns the camera on, recognises them (1:N), then an SMS one-time code authorises them; admin keeps its login.

**Architecture:** The kiosk survey endpoints stop requiring a JWT. Instead, three public endpoints (`identify`, `request-otp`, `verify-otp`) are anonymous+throttled; a successful OTP mints a short-lived signed **kiosk token** that authorises `due`/`start`/`submit`. SMS is a pluggable port (mock now → Eskiz later) with a fixed code `0000` during the mock phase. Face recognition stays the primary identifier; OTP (phone possession) is the authenticator and the sole gate on the manual fallback path.

**Tech Stack:** Django 5 + DRF + SimpleJWT (admin only), `django.core.signing` (kiosk token), InsightFace/mock face backend (existing). React 18 + TypeScript + MUI + react-query + axios (humps snake↔camel).

## Global Constraints

- Backend tests run with: `cd backend && .venv/bin/python -m pytest` (settings auto-resolve to `config.settings.test` via `pyproject.toml`). Single test: `.venv/bin/python -m pytest tests/test_x.py::test_y -v`.
- Migrations: `cd backend && .venv/bin/python manage.py makemigrations <app>` then `migrate`. Never hand-write migration bodies — generate them.
- Every new setting is env-overridable and lives in the `DECOR` dict in `backend/config/settings/base.py` (mirror the existing `env(...)`/`env.int(...)` style).
- Mock backends stay pinned in `config/settings/test.py` so the suite is deterministic and ML-free.
- OTP static code default is `"0000"`; `MockSmsSender` never sends a real message.
- Kiosk token: `django.core.signing.dumps/loads`, salt `"decor.kiosk.token"`, transported in the `X-Kiosk-Token` request header.
- Ruff must stay green: `cd backend && .venv/bin/ruff check .` (line-length 100, ignore E501; rules E,F,I,W,UP,B).
- Frontend gates: `make typecheck` (tsc --noEmit), `make lint-frontend` (eslint), `make build-frontend`. Public API calls use `request(options, /* isPublic */ true)`.
- Commit after every task with a Conventional-Commits message.
- Roles: only `admin` and `employee` exist (`accounts.Roles`). Employees are recognition subjects; they have **no** login account — do not create one.

## Deviations from the committed spec (intentional refinements found during planning)

1. **`identify` is not stripped to name-only.** It already requires a *matching* face photo (an attacker must already possess the employee's face to get a hit), so it keeps returning `full_name`, `photo`, `specialty_name` (needed by the existing scanner banner) plus `phone_masked`. It never returns the raw phone or the embedding. The truly minimal, query-gated endpoint is `employees-lookup` (manual fallback only).
2. **SMS classes follow the repo's flat integrations layout** (`base.py` port, `mocks.py` mock, `eskiz_adapter.py` real, `registry.py` resolver) instead of a `sms/` subpackage — consistent with the existing face stack.
3. **`OtpChallenge` lives in the `surveys` app** (it gates survey taking).
4. **Fallback trust:** the `fallback` flag is client-supplied at `verify-otp` and rides inside the signed kiosk token. In fallback mode the face gate is downgraded to log-only — OTP (SMS to the employee's phone) is the security boundary, per the approved design. Documented in Task A7.

## File Structure

**Backend — created**
- `backend/apps/integrations/eskiz_adapter.py` — real SMS adapter stub (future Eskiz).
- `backend/apps/surveys/otp.py` — OTP domain service (generate/send/verify, phone masking).
- `backend/apps/surveys/kiosk_token.py` — issue/read the signed kiosk token.
- `backend/apps/surveys/permissions.py` — `IsKioskVerified` DRF permission.
- `backend/apps/surveys/migrations/000X_otpchallenge.py` — generated.
- `backend/apps/employees/migrations/000X_employee_phone.py` — generated.
- Tests: `backend/tests/test_sms_sender.py`, `test_kiosk_otp.py`, `test_kiosk_token.py`, `test_kiosk_public_api.py`, `test_kiosk_throttle.py`, and additions to `test_employees_*`.

**Backend — modified**
- `apps/employees/models.py` (+`phone`), `apps/employees/serializers.py` (+`phone`).
- `apps/integrations/base.py` (+`SmsSender`, `SmsError`), `apps/integrations/mocks.py` (+`MockSmsSender`), `apps/integrations/registry.py` (+`get_sms_sender`).
- `apps/surveys/models.py` (+`OtpChallenge`), `apps/surveys/serializers.py` (+`KioskIdentifiedEmployeeSerializer`; `StartSurveySerializer.face_image` optional), `apps/surveys/services.py` (`start_survey_session` gains `require_face_match`), `apps/surveys/views.py` (permissions + new actions + token gate).
- `config/settings/base.py` (DECOR knobs + throttle rates), `config/settings/test.py` (pin SMS mock + throttle-safe), `.env.example`, `backend/tests/conftest.py` (cache-clear fixture).

**Frontend — created**
- `src/sections/app/survey-kiosk/components/otp-step.tsx`, `confirm-step.tsx`, `manual-pick-step.tsx`.
- `src/pages/public/scan.tsx` (public page).
- `src/routes/sections/public.tsx` (public route group).

**Frontend — modified**
- `src/routes/paths.ts`, `src/routes/sections/index.tsx`, `src/routes/sections/dashboard.tsx`.
- `src/lib/api/endpoints.ts`.
- `src/sections/app/survey-kiosk/api/{types.ts,survey-requests.ts,use-survey-kiosk-api.ts}`.
- `src/sections/app/survey-kiosk/{entry-view.tsx → becomes scan-view,answer-view.tsx}`, `components/index.tsx`.
- `src/sections/app/employees/employee-upsert-dialog.tsx`, `src/sections/app/employees/api/types.ts`.

---

# PHASE A — BACKEND

## Task A1: Employee phone field

**Files:**
- Modify: `backend/apps/employees/models.py` (Employee, after `is_active` line 33)
- Create (generated): `backend/apps/employees/migrations/0002_employee_phone.py`
- Modify: `backend/apps/employees/serializers.py` (EmployeeSerializer.Meta.fields + phone field)
- Test: `backend/tests/test_employee_phone.py`

**Interfaces:**
- Produces: `Employee.phone: str` (blank/null allowed in DB); `EmployeeSerializer` accepts/returns `phone` validated as `^\+\d{9,15}$` or blank.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_employee_phone.py
import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.employees.models import Employee

from .conftest import png_bytes
from .factories import SpecialtyFactory


@pytest.mark.django_db
def test_create_employee_with_phone(admin_client):
    specialty = SpecialtyFactory()
    photo = SimpleUploadedFile("p.png", png_bytes(), content_type="image/png")
    resp = admin_client.post(
        "/api/v1/employees/",
        {"full_name": "Ali Valiyev", "specialty": specialty.id,
         "phone": "+998901234567", "photo": photo},
        format="multipart",
    )
    assert resp.status_code == 201, resp.content
    assert resp.data["phone"] == "+998901234567"
    assert Employee.objects.get(pk=resp.data["id"]).phone == "+998901234567"


@pytest.mark.django_db
def test_create_employee_rejects_bad_phone(admin_client):
    specialty = SpecialtyFactory()
    photo = SimpleUploadedFile("p.png", png_bytes(), content_type="image/png")
    resp = admin_client.post(
        "/api/v1/employees/",
        {"full_name": "Bad Phone", "specialty": specialty.id,
         "phone": "12345", "photo": photo},
        format="multipart",
    )
    assert resp.status_code == 400
    assert "phone" in resp.data
```

- [ ] **Step 2: Run it — expect failure**

Run: `cd backend && .venv/bin/python -m pytest tests/test_employee_phone.py -v`
Expected: FAIL (unknown field `phone` / 400 on the happy path).

- [ ] **Step 3: Add the model field**

In `backend/apps/employees/models.py`, inside `Employee`, add after `is_active = models.BooleanField(default=True)` (line 33):

```python
    # Employee phone for kiosk SMS OTP (E.164, e.g. +998901234567). Nullable for
    # already-imported employees; required by the admin form via the serializer.
    phone = models.CharField(max_length=20, blank=True, default="")
```

- [ ] **Step 4: Generate the migration**

Run: `cd backend && .venv/bin/python manage.py makemigrations employees`
Expected: creates `apps/employees/migrations/0002_employee_phone.py` adding one `AddField`.

- [ ] **Step 5: Add phone to the serializer**

In `backend/apps/employees/serializers.py`, add the field to `EmployeeSerializer` (before `class Meta`, after the `specialty_name` line 17):

```python
    phone = serializers.RegexField(
        r"^\+\d{9,15}$",
        required=False,
        allow_blank=True,
        error_messages={"invalid": "Phone must be E.164, e.g. +998901234567."},
    )
```

And add `"phone",` to `Meta.fields` (right after `"specialty_name",` on line 26):

```python
            "specialty_name",
            "phone",
            "photo",
```

- [ ] **Step 6: Run tests — expect pass**

Run: `cd backend && .venv/bin/python -m pytest tests/test_employee_phone.py -v`
Expected: PASS (2 tests).

- [ ] **Step 7: Guard the existing employee tests still pass**

Run: `cd backend && .venv/bin/python -m pytest tests/test_face_enrollment_api.py -q`
Expected: PASS (phone is optional, so existing creates are unaffected).

- [ ] **Step 8: Commit**

```bash
cd backend && .venv/bin/ruff check apps/employees tests/test_employee_phone.py
git add apps/employees/models.py apps/employees/migrations/0002_employee_phone.py apps/employees/serializers.py tests/test_employee_phone.py
git commit -m "feat(employees): add optional phone field for kiosk SMS OTP"
```

---

## Task A2: SMS sender port + mock + Eskiz stub + registry

**Files:**
- Modify: `backend/apps/integrations/base.py` (append `SmsError`, `SmsSender`)
- Modify: `backend/apps/integrations/mocks.py` (append `MockSmsSender`)
- Create: `backend/apps/integrations/eskiz_adapter.py`
- Modify: `backend/apps/integrations/registry.py` (append `get_sms_sender`)
- Modify: `backend/config/settings/base.py` (DECOR `SMS_BACKEND`)
- Modify: `backend/config/settings/test.py` (pin SMS mock)
- Test: `backend/tests/test_sms_sender.py`

**Interfaces:**
- Produces: `SmsSender.send(phone: str, text: str) -> None`; `get_sms_sender() -> SmsSender`; `MockSmsSender` (logs, never raises); `EskizSmsSender` (raises `NotImplementedError` until configured); setting key `DECOR["SMS_BACKEND"]` (default mock).

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_sms_sender.py
import pytest

from apps.integrations.base import SmsSender
from apps.integrations.eskiz_adapter import EskizSmsSender
from apps.integrations.mocks import MockSmsSender
from apps.integrations.registry import get_sms_sender


def test_registry_resolves_mock_by_default():
    assert isinstance(get_sms_sender(), SmsSender)
    assert isinstance(get_sms_sender(), MockSmsSender)


def test_mock_sender_never_raises(caplog):
    MockSmsSender().send("+998901234567", "code 0000")  # no exception, logs only


def test_eskiz_adapter_is_a_stub():
    with pytest.raises(NotImplementedError):
        EskizSmsSender().send("+998901234567", "code 1234")
```

- [ ] **Step 2: Run it — expect failure**

Run: `cd backend && .venv/bin/python -m pytest tests/test_sms_sender.py -v`
Expected: FAIL (imports don't exist).

- [ ] **Step 3: Add the port to `base.py`**

Append to `backend/apps/integrations/base.py`:

```python
class SmsError(Exception):
    """Raised when an SMS provider fails to accept/deliver a message."""


class SmsSender(ABC):
    """Outbound SMS port. The mock no-ops in dev/CI; Eskiz sends in prod."""

    @abstractmethod
    def send(self, phone: str, text: str) -> None:
        """Send `text` to `phone` (E.164). Raise SmsError on provider failure."""
```

- [ ] **Step 4: Add the mock to `mocks.py`**

At the top of `backend/apps/integrations/mocks.py` add `import logging` under the existing `import hashlib`, add `SmsSender` to the `from .base import (...)` list, and append:

```python
logger = logging.getLogger(__name__)


class MockSmsSender(SmsSender):
    """Logs instead of sending. Used until a real provider (Eskiz) is wired up."""

    def send(self, phone: str, text: str) -> None:
        logger.info("MockSmsSender: would send SMS to %s: %s", phone, text)
```

- [ ] **Step 5: Create the Eskiz stub**

```python
# backend/apps/integrations/eskiz_adapter.py
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
```

- [ ] **Step 6: Add the resolver to `registry.py`**

In `backend/apps/integrations/registry.py`, change the import line and append the function:

```python
from .base import AntiSpoofingService, FaceRecognitionService, SmsSender
```

```python
def get_sms_sender() -> SmsSender:
    return import_string(settings.DECOR["SMS_BACKEND"])()
```

- [ ] **Step 7: Add the setting**

In `backend/config/settings/base.py`, inside the `DECOR = {` dict (e.g. right after `REVERIFY_ON_SUBMIT` line 151), add:

```python
    # ── Kiosk SMS OTP ──────────────────────────────────────────────────────
    "SMS_BACKEND": env(
        "DECOR_SMS_BACKEND", default="apps.integrations.mocks.MockSmsSender"
    ),
```

In `backend/config/settings/test.py`, add the pin inside the `DECOR = {**DECOR, ...}` block:

```python
    "SMS_BACKEND": "apps.integrations.mocks.MockSmsSender",
```

- [ ] **Step 8: Run tests — expect pass**

Run: `cd backend && .venv/bin/python -m pytest tests/test_sms_sender.py tests/test_integrations_face_only.py -v`
Expected: PASS (face pipeline test still green; SMS tests pass).

- [ ] **Step 9: Commit**

```bash
cd backend && .venv/bin/ruff check apps/integrations config tests/test_sms_sender.py
git add apps/integrations/base.py apps/integrations/mocks.py apps/integrations/eskiz_adapter.py apps/integrations/registry.py config/settings/base.py config/settings/test.py tests/test_sms_sender.py
git commit -m "feat(integrations): add SMS sender port with mock + Eskiz stub"
```

---

## Task A3: OtpChallenge model

**Files:**
- Modify: `backend/apps/surveys/models.py` (append `OtpChallenge`)
- Create (generated): `backend/apps/surveys/migrations/000X_otpchallenge.py`
- Test: `backend/tests/test_kiosk_otp.py` (first test only; more added in A4)

**Interfaces:**
- Produces: `OtpChallenge(employee, code_hash, attempts, is_used, expires_at, created_at)`; `OtpChallenge.is_expired() -> bool`.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_kiosk_otp.py
from datetime import timedelta

import pytest
from django.utils import timezone

from apps.surveys.models import OtpChallenge

from .factories import EmployeeFactory


@pytest.mark.django_db
def test_otp_challenge_is_expired():
    emp = EmployeeFactory()
    fresh = OtpChallenge.objects.create(
        employee=emp, code_hash="x", expires_at=timezone.now() + timedelta(minutes=5)
    )
    stale = OtpChallenge.objects.create(
        employee=emp, code_hash="x", expires_at=timezone.now() - timedelta(seconds=1)
    )
    assert fresh.is_expired() is False
    assert stale.is_expired() is True
```

- [ ] **Step 2: Run it — expect failure**

Run: `cd backend && .venv/bin/python -m pytest tests/test_kiosk_otp.py -v`
Expected: FAIL (no `OtpChallenge`).

- [ ] **Step 3: Add the model**

Append to `backend/apps/surveys/models.py`:

```python
class OtpChallenge(TimeStampedModel):
    """One SMS one-time-code challenge for kiosk login (post face/manual identify)."""

    employee = models.ForeignKey(
        "employees.Employee", on_delete=models.PROTECT, related_name="otp_challenges"
    )
    code_hash = models.CharField(max_length=64)
    attempts = models.PositiveSmallIntegerField(default=0)
    is_used = models.BooleanField(default=False)
    expires_at = models.DateTimeField()

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["employee", "created_at"])]

    def is_expired(self) -> bool:
        from django.utils import timezone

        return timezone.now() >= self.expires_at
```

- [ ] **Step 4: Generate the migration**

Run: `cd backend && .venv/bin/python manage.py makemigrations surveys`
Expected: creates `apps/surveys/migrations/0002_otpchallenge.py` (one `CreateModel`).

- [ ] **Step 5: Run tests — expect pass**

Run: `cd backend && .venv/bin/python -m pytest tests/test_kiosk_otp.py -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd backend && .venv/bin/ruff check apps/surveys tests/test_kiosk_otp.py
git add apps/surveys/models.py apps/surveys/migrations/0002_otpchallenge.py tests/test_kiosk_otp.py
git commit -m "feat(surveys): add OtpChallenge model for kiosk SMS OTP"
```

---

## Task A4: OTP domain service

**Files:**
- Create: `backend/apps/surveys/otp.py`
- Modify: `backend/config/settings/base.py` (DECOR OTP knobs)
- Test: `backend/tests/test_kiosk_otp.py` (append)

**Interfaces:**
- Consumes: `OtpChallenge` (A3), `get_sms_sender` (A2), `Employee.phone` (A1).
- Produces:
  - `mask_phone(phone: str) -> str`
  - `request_otp(employee) -> str` (returns masked phone; creates a challenge; sends SMS)
  - `verify_otp(employee, code: str) -> None` (raises on failure; marks used on success)
  - `PhoneNotSetError`, `OtpError(code: str)` where `str(exc)` ∈ {`invalid_code`,`expired`,`too_many_attempts`}.
  - settings: `DECOR["KIOSK_OTP_STATIC_CODE"]`, `["KIOSK_OTP_TTL_SECONDS"]`, `["KIOSK_OTP_MAX_ATTEMPTS"]`.

- [ ] **Step 1: Write the failing tests (append to `test_kiosk_otp.py`)**

```python
from apps.surveys.otp import (
    OtpError,
    PhoneNotSetError,
    mask_phone,
    request_otp,
    verify_otp,
)


def test_mask_phone():
    assert mask_phone("+998901234567") == "+998 *** ** 67"
    assert mask_phone("") == ""


@pytest.mark.django_db
def test_request_otp_returns_masked_and_creates_challenge():
    emp = EmployeeFactory(phone="+998901234567")
    masked = request_otp(emp)
    assert masked == "+998 *** ** 67"
    assert OtpChallenge.objects.filter(employee=emp, is_used=False).count() == 1


@pytest.mark.django_db
def test_request_otp_without_phone_raises():
    emp = EmployeeFactory(phone="")
    with pytest.raises(PhoneNotSetError):
        request_otp(emp)


@pytest.mark.django_db
def test_verify_otp_happy_path_static_code():
    emp = EmployeeFactory(phone="+998901234567")
    request_otp(emp)
    verify_otp(emp, "0000")  # static default; no exception
    assert OtpChallenge.objects.get(employee=emp).is_used is True


@pytest.mark.django_db
def test_verify_otp_wrong_code_raises_and_counts_attempt():
    emp = EmployeeFactory(phone="+998901234567")
    request_otp(emp)
    with pytest.raises(OtpError) as exc:
        verify_otp(emp, "9999")
    assert str(exc.value) == "invalid_code"
    assert OtpChallenge.objects.get(employee=emp).attempts == 1


@pytest.mark.django_db
def test_verify_otp_expired_raises(settings):
    settings.DECOR = {**settings.DECOR, "KIOSK_OTP_TTL_SECONDS": -1}
    emp = EmployeeFactory(phone="+998901234567")
    request_otp(emp)
    with pytest.raises(OtpError) as exc:
        verify_otp(emp, "0000")
    assert str(exc.value) == "expired"


@pytest.mark.django_db
def test_verify_otp_too_many_attempts(settings):
    settings.DECOR = {**settings.DECOR, "KIOSK_OTP_MAX_ATTEMPTS": 2}
    emp = EmployeeFactory(phone="+998901234567")
    request_otp(emp)
    verify_otp_wrong = lambda: verify_otp(emp, "1111")  # noqa: E731
    with pytest.raises(OtpError):
        verify_otp_wrong()
    with pytest.raises(OtpError):
        verify_otp_wrong()
    with pytest.raises(OtpError) as exc:
        verify_otp(emp, "0000")
    assert str(exc.value) == "too_many_attempts"
```

- [ ] **Step 2: Run — expect failure**

Run: `cd backend && .venv/bin/python -m pytest tests/test_kiosk_otp.py -v`
Expected: FAIL (`apps.surveys.otp` missing).

- [ ] **Step 3: Add OTP settings**

In `backend/config/settings/base.py` `DECOR`, right after the `SMS_BACKEND` entry added in A2:

```python
    "KIOSK_OTP_STATIC_CODE": env("DECOR_KIOSK_OTP_STATIC_CODE", default="0000"),
    "KIOSK_OTP_TTL_SECONDS": env.int("DECOR_KIOSK_OTP_TTL_SECONDS", default=300),
    "KIOSK_OTP_MAX_ATTEMPTS": env.int("DECOR_KIOSK_OTP_MAX_ATTEMPTS", default=5),
```

- [ ] **Step 4: Write the service**

```python
# backend/apps/surveys/otp.py
"""Kiosk SMS one-time-code: generate + send + verify. Static 0000 until Eskiz lands."""
import hashlib
from datetime import timedelta

from django.conf import settings as dj_settings
from django.utils import timezone
from django.utils.crypto import get_random_string

from apps.employees.models import Employee
from apps.integrations.registry import get_sms_sender

from .models import OtpChallenge


class PhoneNotSetError(Exception):
    """The employee has no phone number, so no code can be sent."""


class OtpError(Exception):
    """OTP verification failed. str(exc) is a stable machine code."""


def mask_phone(phone: str) -> str:
    """'+998901234567' -> '+998 *** ** 67'. Empty stays empty."""
    phone = (phone or "").strip()
    if len(phone) < 6:
        return phone
    return f"{phone[:4]} *** ** {phone[-2:]}"


def _hash_code(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def _new_code() -> str:
    static = dj_settings.DECOR["KIOSK_OTP_STATIC_CODE"]
    if static:
        return static
    return get_random_string(4, allowed_chars="0123456789")


def request_otp(employee: Employee) -> str:
    """Create a challenge, send the code by SMS, return the masked phone."""
    if not employee.phone:
        raise PhoneNotSetError("Employee has no phone number on file.")
    code = _new_code()
    ttl = dj_settings.DECOR["KIOSK_OTP_TTL_SECONDS"]
    OtpChallenge.objects.create(
        employee=employee,
        code_hash=_hash_code(code),
        expires_at=timezone.now() + timedelta(seconds=ttl),
    )
    get_sms_sender().send(employee.phone, f"Decor Center kod: {code}")
    return mask_phone(employee.phone)


def verify_otp(employee: Employee, code: str) -> None:
    """Verify the latest unused challenge for the employee. Raise OtpError on failure."""
    challenge = (
        OtpChallenge.objects.filter(employee=employee, is_used=False)
        .order_by("-created_at")
        .first()
    )
    if challenge is None or challenge.is_expired():
        raise OtpError("expired")
    if challenge.attempts >= dj_settings.DECOR["KIOSK_OTP_MAX_ATTEMPTS"]:
        raise OtpError("too_many_attempts")

    challenge.attempts += 1
    if challenge.code_hash != _hash_code(str(code)):
        challenge.save(update_fields=["attempts", "updated_at"])
        raise OtpError("invalid_code")

    challenge.is_used = True
    challenge.save(update_fields=["attempts", "is_used", "updated_at"])
```

- [ ] **Step 5: Run — expect pass**

Run: `cd backend && .venv/bin/python -m pytest tests/test_kiosk_otp.py -v`
Expected: PASS (all OTP tests).

- [ ] **Step 6: Commit**

```bash
cd backend && .venv/bin/ruff check apps/surveys config tests/test_kiosk_otp.py
git add apps/surveys/otp.py config/settings/base.py tests/test_kiosk_otp.py
git commit -m "feat(surveys): add kiosk OTP service (generate/send/verify, static 0000)"
```

---

## Task A5: Kiosk token + IsKioskVerified permission

**Files:**
- Create: `backend/apps/surveys/kiosk_token.py`
- Create: `backend/apps/surveys/permissions.py`
- Modify: `backend/config/settings/base.py` (DECOR `KIOSK_TOKEN_TTL`)
- Test: `backend/tests/test_kiosk_token.py`

**Interfaces:**
- Produces:
  - `issue_kiosk_token(employee_id: int, *, fallback: bool = False) -> str`
  - `read_kiosk_token(token: str) -> dict | None` → `{"employee_id": int, "fallback": bool}` or `None`
  - `IsKioskVerified` (DRF permission): reads `X-Kiosk-Token`, sets `request.kiosk_employee_id` and `request.kiosk_fallback`; denies if absent/invalid/expired.
  - setting `DECOR["KIOSK_TOKEN_TTL"]`.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_kiosk_token.py
import pytest
from rest_framework.test import APIRequestFactory

from apps.surveys.kiosk_token import issue_kiosk_token, read_kiosk_token
from apps.surveys.permissions import IsKioskVerified


def test_issue_then_read_roundtrip():
    token = issue_kiosk_token(42, fallback=True)
    data = read_kiosk_token(token)
    assert data == {"employee_id": 42, "fallback": True}


def test_tampered_token_is_rejected():
    assert read_kiosk_token("not-a-real-token") is None
    good = issue_kiosk_token(1)
    assert read_kiosk_token(good + "x") is None


def test_expired_token_is_rejected(settings):
    settings.DECOR = {**settings.DECOR, "KIOSK_TOKEN_TTL": -1}
    assert read_kiosk_token(issue_kiosk_token(1)) is None


def test_permission_grants_with_valid_header_denies_without():
    factory = APIRequestFactory()
    perm = IsKioskVerified()

    denied = factory.get("/x")
    assert perm.has_permission(denied, view=None) is False

    granted = factory.get("/x", HTTP_X_KIOSK_TOKEN=issue_kiosk_token(7, fallback=False))
    assert perm.has_permission(granted, view=None) is True
    assert granted.kiosk_employee_id == 7
    assert granted.kiosk_fallback is False
```

- [ ] **Step 2: Run — expect failure**

Run: `cd backend && .venv/bin/python -m pytest tests/test_kiosk_token.py -v`
Expected: FAIL (modules missing).

- [ ] **Step 3: Add the setting**

In `backend/config/settings/base.py` `DECOR`, after the OTP knobs from A4:

```python
    "KIOSK_TOKEN_TTL": env.int("DECOR_KIOSK_TOKEN_TTL", default=900),
```

- [ ] **Step 4: Write the token module**

```python
# backend/apps/surveys/kiosk_token.py
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
```

- [ ] **Step 5: Write the permission**

```python
# backend/apps/surveys/permissions.py
"""Kiosk authorisation: a valid X-Kiosk-Token (issued after OTP) instead of a login."""
from rest_framework.permissions import BasePermission

from .kiosk_token import read_kiosk_token


class IsKioskVerified(BasePermission):
    """Grant access to a kiosk-token bearer; attach the token's employee to the request."""

    message = {"detail": "Kiosk verification required.", "code": "kiosk_unverified"}

    def has_permission(self, request, view):
        token = request.headers.get("X-Kiosk-Token", "")
        data = read_kiosk_token(token) if token else None
        if not data:
            return False
        request.kiosk_employee_id = data["employee_id"]
        request.kiosk_fallback = data["fallback"]
        return True
```

- [ ] **Step 6: Run — expect pass**

Run: `cd backend && .venv/bin/python -m pytest tests/test_kiosk_token.py -v`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd backend && .venv/bin/ruff check apps/surveys config tests/test_kiosk_token.py
git add apps/surveys/kiosk_token.py apps/surveys/permissions.py config/settings/base.py tests/test_kiosk_token.py
git commit -m "feat(surveys): add signed kiosk token + IsKioskVerified permission"
```

---

## Task A6: Public identify + request-otp + verify-otp + employees-lookup

**Files:**
- Modify: `backend/apps/surveys/serializers.py` (add `KioskIdentifiedEmployeeSerializer`)
- Modify: `backend/apps/surveys/views.py` (permissions map + `identify` response + 3 new actions)
- Test: `backend/tests/test_kiosk_public_api.py`

**Interfaces:**
- Consumes: `otp.request_otp/verify_otp/PhoneNotSetError/OtpError` (A4), `kiosk_token.issue_kiosk_token` (A5), `get_face_recognition_service` (existing).
- Produces public endpoints (no auth):
  - `POST /api/v1/survey-sessions/identify/` → `{"employee": {id, fullName, specialtyName, photo, phoneMasked}}` or 404
  - `POST /api/v1/survey-sessions/request-otp/` (body `{employee}`) → `{"phoneMasked": str}` | 400 `phone_not_set` | 404
  - `POST /api/v1/survey-sessions/verify-otp/` (body `{employee, code, fallback?}`) → `{"kioskToken": str}` | 400 `{invalid_code|expired|too_many_attempts}` | 404
  - `GET /api/v1/survey-sessions/employees-lookup/?q=` → `[{id, fullName}]` (≤20; empty if q shorter than 2)

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/test_kiosk_public_api.py
import pytest

from apps.surveys.models import OtpChallenge

from .factories import EmployeeFactory


@pytest.mark.django_db
def test_identify_is_public_and_returns_masked_phone(api_client, face_image):
    emp = EmployeeFactory(phone="+998901234567")  # embedding matches face_image (mock)
    resp = api_client.post(
        "/api/v1/survey-sessions/identify/", {"face_image": face_image}, format="multipart"
    )
    assert resp.status_code == 200, resp.content
    body = resp.data["employee"]
    assert body["id"] == emp.id
    assert body["phoneMasked"] == "+998 *** ** 67"
    assert "phone" not in body and "faceEmbedding" not in body


@pytest.mark.django_db
def test_request_otp_public(api_client):
    emp = EmployeeFactory(phone="+998901234567")
    resp = api_client.post(
        "/api/v1/survey-sessions/request-otp/", {"employee": emp.id}, format="json"
    )
    assert resp.status_code == 200
    assert resp.data["phoneMasked"] == "+998 *** ** 67"
    assert OtpChallenge.objects.filter(employee=emp).count() == 1


@pytest.mark.django_db
def test_request_otp_phone_not_set(api_client):
    emp = EmployeeFactory(phone="")
    resp = api_client.post(
        "/api/v1/survey-sessions/request-otp/", {"employee": emp.id}, format="json"
    )
    assert resp.status_code == 400
    assert resp.data["code"] == "phone_not_set"


@pytest.mark.django_db
def test_verify_otp_wrong_then_right(api_client):
    emp = EmployeeFactory(phone="+998901234567")
    api_client.post("/api/v1/survey-sessions/request-otp/", {"employee": emp.id}, format="json")

    bad = api_client.post(
        "/api/v1/survey-sessions/verify-otp/",
        {"employee": emp.id, "code": "9999"}, format="json",
    )
    assert bad.status_code == 400
    assert bad.data["code"] == "invalid_code"

    ok = api_client.post(
        "/api/v1/survey-sessions/verify-otp/",
        {"employee": emp.id, "code": "0000"}, format="json",
    )
    assert ok.status_code == 200
    assert ok.data["kioskToken"]


@pytest.mark.django_db
def test_employees_lookup_requires_query(api_client):
    EmployeeFactory(full_name="Zafar Karimov")
    assert api_client.get("/api/v1/survey-sessions/employees-lookup/?q=z").data == []
    hits = api_client.get("/api/v1/survey-sessions/employees-lookup/?q=zafar").data
    assert len(hits) == 1
    assert set(hits[0]) == {"id", "fullName"}
```

- [ ] **Step 2: Run — expect failure**

Run: `cd backend && .venv/bin/python -m pytest tests/test_kiosk_public_api.py -v`
Expected: FAIL (identify still authed / new actions missing).

- [ ] **Step 3: Add the identify serializer**

Append to `backend/apps/surveys/serializers.py`:

```python
class KioskIdentifiedEmployeeSerializer(serializers.ModelSerializer):
    """Public identify payload: enough for the kiosk banner + a masked phone. No PII leak
    beyond what a matching face already implies; never exposes the raw phone/embedding."""

    specialty_name = serializers.CharField(source="specialty.name", read_only=True)
    phone_masked = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = ["id", "full_name", "specialty_name", "photo", "phone_masked"]

    def get_phone_masked(self, obj) -> str:
        from .otp import mask_phone

        return mask_phone(obj.phone)
```

- [ ] **Step 4: Rewire the viewset**

In `backend/apps/surveys/views.py`:

(a) Update imports — replace the `from apps.accounts.permissions import ...` line and add:

```python
from rest_framework.permissions import AllowAny

from apps.accounts.permissions import IsAdmin

from .kiosk_token import issue_kiosk_token
from .otp import OtpError, PhoneNotSetError, request_otp, verify_otp
from .permissions import IsKioskVerified
```

Add `KioskIdentifiedEmployeeSerializer` to the `from .serializers import (...)` block.

(b) Replace `get_permissions` (lines 225-228) with:

```python
    def get_permissions(self):
        if self.action in ("identify", "request_otp", "verify_otp", "employees_lookup"):
            return [AllowAny()]
        if self.action in ("due", "start", "submit"):
            return [IsKioskVerified()]
        return [IsAdmin()]
```

(c) Replace the final line of `identify` (line 273) so it returns the minimal serializer:

```python
        employee = Employee.objects.select_related("specialty").get(id=best_id)
        return Response({"employee": KioskIdentifiedEmployeeSerializer(employee).data})
```

(d) Add three actions (place after `identify`, before `due`):

```python
    @extend_schema(request={"application/json": {"type": "object",
        "properties": {"employee": {"type": "integer"}}, "required": ["employee"]}})
    @action(detail=False, methods=["post"], url_path="request-otp")
    def request_otp(self, request):
        """Send an SMS one-time code to a (face- or manually-)identified employee."""
        employee = self._active_employee(request.data.get("employee"))
        try:
            phone_masked = request_otp(employee)
        except PhoneNotSetError:
            return Response(
                {"detail": "No phone number on file. Contact the administrator.",
                 "code": "phone_not_set"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response({"phone_masked": phone_masked})

    @extend_schema(request={"application/json": {"type": "object", "properties": {
        "employee": {"type": "integer"}, "code": {"type": "string"},
        "fallback": {"type": "boolean"}}, "required": ["employee", "code"]}})
    @action(detail=False, methods=["post"], url_path="verify-otp")
    def verify_otp(self, request):
        """Verify the SMS code; on success mint a short-lived kiosk token."""
        employee = self._active_employee(request.data.get("employee"))
        try:
            verify_otp(employee, str(request.data.get("code") or ""))
        except OtpError as exc:
            return Response(
                {"detail": "Code verification failed.", "code": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        token = issue_kiosk_token(employee.id, fallback=bool(request.data.get("fallback")))
        return Response({"kiosk_token": token})

    @action(detail=False, methods=["get"], url_path="employees-lookup")
    def employees_lookup(self, request):
        """Minimal name search for the manual fallback (needs a >=2 char query)."""
        query = (request.query_params.get("q") or "").strip()
        if len(query) < 2:
            return Response([])
        rows = (
            Employee.objects.filter(is_active=True, full_name__icontains=query)
            .order_by("full_name")
            .values("id", "full_name")[:20]
        )
        return Response(list(rows))
```

(e) Add the helper method (place near `_require_test`, before `_aggregate_results`):

```python
    def _active_employee(self, employee_id) -> Employee:
        employee = Employee.objects.filter(pk=employee_id, is_active=True).first()
        if employee is None:
            raise ValidationError({"detail": "Employee not found.", "code": "not_found"})
        return employee
```

> Note: DRF renders `phone_masked`/`kiosk_token` keys; the frontend humps layer reads them as `phoneMasked`/`kioskToken`. The tests above assert the raw snake_case (server side).

- [ ] **Step 5: Run — expect pass**

Run: `cd backend && .venv/bin/python -m pytest tests/test_kiosk_public_api.py -v`
Expected: PASS (5 tests).

- [ ] **Step 6: Guard existing survey tests**

Run: `cd backend && .venv/bin/python -m pytest tests/test_surveys_api.py -q`
Expected: the old identify test may now assert the old full-Employee shape — if it fails only on the identify response shape, update that assertion to the new `{id, fullName, specialtyName, photo, phoneMasked}` shape; leave start/submit assertions (they change in A7).

- [ ] **Step 7: Commit**

```bash
cd backend && .venv/bin/ruff check apps/surveys tests/test_kiosk_public_api.py
git add apps/surveys/serializers.py apps/surveys/views.py tests/test_kiosk_public_api.py tests/test_surveys_api.py
git commit -m "feat(surveys): public identify/request-otp/verify-otp/employees-lookup"
```

---

## Task A7: Kiosk-token gate on due/start/submit + fallback face-gate

**Files:**
- Modify: `backend/apps/surveys/services.py` (`start_survey_session` gains `require_face_match`)
- Modify: `backend/apps/surveys/serializers.py` (`StartSurveySerializer.face_image` optional)
- Modify: `backend/apps/surveys/views.py` (`due`/`start`/`submit` employee-match + fallback)
- Test: `backend/tests/test_kiosk_public_api.py` (append)

**Interfaces:**
- Consumes: `request.kiosk_employee_id`, `request.kiosk_fallback` (set by `IsKioskVerified`, A5).
- Produces: `start_survey_session(*, employee, test, face_image_bytes, require_face_match=True)`; `due`/`start`/`submit` reject when the target employee ≠ token employee (403), and reject entirely without a token (403).

- [ ] **Step 1: Write the failing tests (append to `test_kiosk_public_api.py`)**

```python
from apps.surveys.kiosk_token import issue_kiosk_token

from .factories import QuestionFactory, TestFactory


def _kiosk(api_client, employee_id, fallback=False):
    api_client.credentials(HTTP_X_KIOSK_TOKEN=issue_kiosk_token(employee_id, fallback=fallback))
    return api_client


@pytest.mark.django_db
def test_due_requires_kiosk_token(api_client):
    emp = EmployeeFactory(phone="+998901234567")
    # no token → 403
    assert api_client.get(f"/api/v1/survey-sessions/due/?employee={emp.id}").status_code == 403


@pytest.mark.django_db
def test_start_primary_verifies_face(api_client, face_image):
    emp = EmployeeFactory(phone="+998901234567")
    q = QuestionFactory()
    test = q.block.test
    resp = _kiosk(api_client, emp.id).post(
        "/api/v1/survey-sessions/start/",
        {"employee": emp.id, "test": test.id, "face_image": face_image},
        format="multipart",
    )
    assert resp.status_code == 201, resp.content
    assert resp.data["session"]["faceVerified"] is True


@pytest.mark.django_db
def test_start_fallback_without_face_succeeds(api_client):
    emp = EmployeeFactory(phone="+998901234567")
    q = QuestionFactory()
    test = q.block.test
    resp = _kiosk(api_client, emp.id, fallback=True).post(
        "/api/v1/survey-sessions/start/",
        {"employee": emp.id, "test": test.id},
        format="multipart",
    )
    assert resp.status_code == 201, resp.content


@pytest.mark.django_db
def test_start_rejects_employee_mismatch(api_client, face_image):
    emp = EmployeeFactory(phone="+998901234567")
    other = EmployeeFactory(phone="+998900000000")
    q = QuestionFactory()
    resp = _kiosk(api_client, other.id).post(
        "/api/v1/survey-sessions/start/",
        {"employee": emp.id, "test": q.block.test.id, "face_image": face_image},
        format="multipart",
    )
    assert resp.status_code == 403
```

- [ ] **Step 2: Run — expect failure**

Run: `cd backend && .venv/bin/python -m pytest tests/test_kiosk_public_api.py -k "start or due" -v`
Expected: FAIL (no token gate / face_image required / no fallback support).

- [ ] **Step 3: Make `face_image` optional**

In `backend/apps/surveys/serializers.py`, `StartSurveySerializer` (line 137):

```python
    face_image = serializers.ImageField(required=False)
```

- [ ] **Step 4: Add `require_face_match` to the service**

In `backend/apps/surveys/services.py`, replace the `start_survey_session` signature and its face block (lines 120-138) with:

```python
def start_survey_session(
    *, employee: Employee, test: Test, face_image_bytes: bytes | None,
    require_face_match: bool = True,
) -> tuple[SurveySession, list[Question]]:
    """Verify Face-ID (unless fallback), then create a session and freeze the questions.

    require_face_match=False (manual/OTP fallback): the face is not a hard gate — OTP
    is the authenticator. A capture, if provided, is still compared and logged.
    """
    service = get_face_recognition_service()

    if require_face_match:
        if not employee.face_embedding:
            raise SurveyFlowError(
                "Employee has no reference photo embedding. Contact the administrator."
            )
        matched, score = service.compare(employee.face_embedding, face_image_bytes)
        FaceVerificationLog.objects.create(
            employee=employee, stage=FaceVerificationLog.Stage.START,
            success=matched, similarity_score=score,
        )
        if not matched:
            raise FaceVerificationError(
                "Face-ID check failed: face does not match or not detected."
            )
        face_verified = True
    else:
        matched = False
        if employee.face_embedding and face_image_bytes:
            matched, score = service.compare(employee.face_embedding, face_image_bytes)
            FaceVerificationLog.objects.create(
                employee=employee, stage=FaceVerificationLog.Stage.START,
                success=matched, similarity_score=score, reason="fallback",
            )
        face_verified = matched
```

Then the existing `questions = _presented_questions(test)` / `with transaction.atomic():` block stays, but change the `SurveySession.objects.create(...)` `face_verified=True` argument to `face_verified=face_verified`.

- [ ] **Step 5: Gate the views + employee match**

In `backend/apps/surveys/views.py`:

`due` — after resolving `employee_id` (line 279), add before building the response:

```python
        if str(employee_id) != str(getattr(request, "kiosk_employee_id", None)):
            raise PermissionDenied({"detail": "Employee mismatch.", "code": "kiosk_mismatch"})
```

`start` — replace the body around lines 292-308 with:

```python
        serializer = StartSurveySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        employee = serializer.validated_data["employee"]
        if employee.id != getattr(request, "kiosk_employee_id", None):
            raise PermissionDenied({"detail": "Employee mismatch.", "code": "kiosk_mismatch"})
        fallback = bool(getattr(request, "kiosk_fallback", False))

        face_image = serializer.validated_data.get("face_image")
        face_bytes = None
        if face_image is not None:
            face_image.seek(0)
            face_bytes = face_image.read()
        if not fallback and face_bytes is None:
            raise ValidationError({"face_image": ["This field is required."]})

        survey = serializer.validated_data["test"]
        try:
            session, _questions = start_survey_session(
                employee=employee, test=survey, face_image_bytes=face_bytes,
                require_face_match=not fallback,
            )
        except FaceVerificationError as exc:
            raise PermissionDenied({"detail": str(exc), "code": "face_verify_failed"}) from exc
        except SurveyFlowError as exc:
            raise ValidationError({"detail": str(exc)}) from exc
```

`submit` — after `session = self.get_object()` (line 324), add:

```python
        if session.employee_id != getattr(request, "kiosk_employee_id", None):
            raise PermissionDenied({"detail": "Employee mismatch.", "code": "kiosk_mismatch"})
```

- [ ] **Step 6: Run — expect pass**

Run: `cd backend && .venv/bin/python -m pytest tests/test_kiosk_public_api.py -v`
Expected: PASS (all).

- [ ] **Step 7: Fix the old surveys API test**

Run: `cd backend && .venv/bin/python -m pytest tests/test_surveys_api.py -v`
Expected: the old start/submit/due tests used `employee_client` (JWT). Update them to use the kiosk-token helper (set `HTTP_X_KIOSK_TOKEN=issue_kiosk_token(emp.id)` and drop `force_authenticate`), matching the new contract. Keep admin-only tests (results/export/admin-fill/list) using `admin_client`.

- [ ] **Step 8: Commit**

```bash
cd backend && .venv/bin/ruff check apps/surveys tests
git add apps/surveys/services.py apps/surveys/serializers.py apps/surveys/views.py tests/test_kiosk_public_api.py tests/test_surveys_api.py
git commit -m "feat(surveys): gate due/start/submit on kiosk token; fallback face-gate"
```

---

## Task A8: Throttling on public kiosk actions

**Files:**
- Modify: `backend/apps/surveys/views.py` (`get_throttles`)
- Modify: `backend/config/settings/base.py` (`REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]`)
- Modify: `backend/tests/conftest.py` (autouse cache-clear so throttle counters never leak)
- Test: `backend/tests/test_kiosk_throttle.py`

**Interfaces:**
- Produces: scoped throttling on the four public actions (scopes `kiosk_identify`, `kiosk_otp`, `kiosk_lookup`), configurable via settings; over-limit → HTTP 429.

- [ ] **Step 1: Add the cache-clear fixture (prevents cross-test throttle bleed)**

Append to `backend/tests/conftest.py`:

```python
@pytest.fixture(autouse=True)
def _clear_throttle_cache():
    from django.core.cache import cache

    cache.clear()
    yield
    cache.clear()
```

- [ ] **Step 2: Write the failing test**

```python
# backend/tests/test_kiosk_throttle.py
import pytest
from django.test import override_settings

from .factories import EmployeeFactory


@pytest.mark.django_db
@override_settings(REST_FRAMEWORK={
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_PAGINATION_CLASS": "apps.core.pagination.DefaultPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_THROTTLE_RATES": {"kiosk_identify": "1/min", "kiosk_otp": "1/min",
                              "kiosk_lookup": "1/min"},
})
def test_request_otp_is_throttled(api_client):
    emp = EmployeeFactory(phone="+998901234567")
    first = api_client.post("/api/v1/survey-sessions/request-otp/",
                            {"employee": emp.id}, format="json")
    assert first.status_code == 200
    second = api_client.post("/api/v1/survey-sessions/request-otp/",
                             {"employee": emp.id}, format="json")
    assert second.status_code == 429
```

- [ ] **Step 3: Run — expect failure**

Run: `cd backend && .venv/bin/python -m pytest tests/test_kiosk_throttle.py -v`
Expected: FAIL (second call returns 200 — no throttling yet).

- [ ] **Step 4: Add default rates**

In `backend/config/settings/base.py` `REST_FRAMEWORK` (after `PAGE_SIZE`, line 112):

```python
    "DEFAULT_THROTTLE_RATES": {
        "kiosk_identify": env("DECOR_THROTTLE_IDENTIFY", default="30/min"),
        "kiosk_otp": env("DECOR_THROTTLE_OTP", default="10/min"),
        "kiosk_lookup": env("DECOR_THROTTLE_LOOKUP", default="30/min"),
    },
```

- [ ] **Step 5: Apply scoped throttles to the public actions**

In `backend/apps/surveys/views.py`, add the import:

```python
from rest_framework.throttling import ScopedRateThrottle
```

Add to `SurveySessionViewSet` (near `get_permissions`):

```python
    _KIOSK_THROTTLE_SCOPES = {
        "identify": "kiosk_identify",
        "request_otp": "kiosk_otp",
        "verify_otp": "kiosk_otp",
        "employees_lookup": "kiosk_lookup",
    }

    def get_throttles(self):
        scope = self._KIOSK_THROTTLE_SCOPES.get(self.action)
        if scope:
            self.throttle_scope = scope
            return [ScopedRateThrottle()]
        return super().get_throttles()
```

- [ ] **Step 6: Run — expect pass**

Run: `cd backend && .venv/bin/python -m pytest tests/test_kiosk_throttle.py tests/test_kiosk_public_api.py -v`
Expected: PASS (throttle test green; public API tests unaffected because the default rates are generous and the cache is cleared per test).

- [ ] **Step 7: Commit**

```bash
cd backend && .venv/bin/ruff check apps/surveys config tests
git add apps/surveys/views.py config/settings/base.py tests/conftest.py tests/test_kiosk_throttle.py
git commit -m "feat(surveys): throttle public kiosk endpoints (identify/otp/lookup)"
```

---

## Task A9: Backend wrap-up — .env.example + full suite + lint

**Files:**
- Modify: `backend/.env.example`
- (verify only) whole backend suite + ruff

- [ ] **Step 1: Document the new env vars**

Append to `backend/.env.example` (under the existing DECOR block; values are non-secret defaults):

```bash
# ── Kiosk SMS OTP ──────────────────────────────────────────────────────────
DECOR_SMS_BACKEND=apps.integrations.mocks.MockSmsSender
DECOR_KIOSK_OTP_STATIC_CODE=0000
DECOR_KIOSK_OTP_TTL_SECONDS=300
DECOR_KIOSK_OTP_MAX_ATTEMPTS=5
DECOR_KIOSK_TOKEN_TTL=900
DECOR_THROTTLE_IDENTIFY=30/min
DECOR_THROTTLE_OTP=10/min
DECOR_THROTTLE_LOOKUP=30/min
```

- [ ] **Step 2: Run the whole backend suite**

Run: `cd backend && .venv/bin/python -m pytest`
Expected: PASS (all green, including pre-existing tests).

- [ ] **Step 3: Lint**

Run: `cd backend && .venv/bin/ruff check .`
Expected: no errors.

- [ ] **Step 4: Sanity-check migrations apply cleanly**

Run: `cd backend && .venv/bin/python manage.py makemigrations --check --dry-run`
Expected: "No changes detected" (models and migrations are in sync).

- [ ] **Step 5: Commit**

```bash
git add backend/.env.example
git commit -m "docs(env): document kiosk OTP + throttle env vars"
```

---

# PHASE B — FRONTEND

> Backend must be running for manual checks: `make run-backend` (:8000). Frontend dev: `make run-frontend` (:3000).

## Task B1: Employee phone field in the admin form

**Files:**
- Modify: `frontend/src/sections/app/employees/api/types.ts` (add `phone`)
- Modify: `frontend/src/sections/app/employees/employee-upsert-dialog.tsx` (RHF field + yup)

**Interfaces:**
- Consumes: backend `EmployeeSerializer.phone` (A1).
- Produces: admin can set/edit `phone` on an employee.

- [ ] **Step 1: Add `phone` to the Employee type**

In `frontend/src/sections/app/employees/api/types.ts`, add `phone?: string;` to the `Employee` type and to the create/update payload type (mirror where `fullName` appears).

- [ ] **Step 2: Add the form field**

In `frontend/src/sections/app/employees/employee-upsert-dialog.tsx`:
- Add `phone` to the yup schema: `phone: Yup.string().matches(/^\+\d{9,15}$/, 'Format: +998901234567').required('Phone is required')`.
- Add `phone: employee?.phone ?? ''` to `defaultValues`.
- Render an `<RHFTextField name="phone" label="Phone" placeholder="+998901234567" />` next to the full-name field.
- Ensure `phone` is included in the submitted payload (it will be if the form uses `methods.handleSubmit(data => upsert(data))` spreading all fields).

- [ ] **Step 3: Typecheck**

Run: `make typecheck`
Expected: no errors.

- [ ] **Step 4: Manual check**

Run backend + frontend, log in as admin, open Employees → create/edit → confirm the Phone field saves and reloads. (See run instructions above.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/sections/app/employees/api/types.ts frontend/src/sections/app/employees/employee-upsert-dialog.tsx
git commit -m "feat(employees-ui): add phone field to the employee form"
```

---

## Task B2: Public scan API layer (endpoints, requests, hooks, types)

**Files:**
- Modify: `frontend/src/lib/api/endpoints.ts` (add requestOtp, verifyOtp, employeesLookup)
- Modify: `frontend/src/sections/app/survey-kiosk/api/types.ts`
- Modify: `frontend/src/sections/app/survey-kiosk/api/survey-requests.ts`
- Modify: `frontend/src/sections/app/survey-kiosk/api/use-survey-kiosk-api.ts`

**Interfaces:**
- Produces:
  - `identifyEmployee(payload)` → public, returns `{ employee: KioskEmployee }`
  - `requestOtp(employeeId)` → `{ phoneMasked }`
  - `verifyOtp({ employeeId, code, fallback })` → `{ kioskToken }`
  - `employeesLookup(q)` → `{ id, fullName }[]`
  - `fetchDueSurveys(employeeId, kioskToken)`, `startSurvey(payload, kioskToken)`, `submitSurvey(sessionId, payload, kioskToken)` — all public + `X-Kiosk-Token`.
  - hooks: `useRequestOtpMutation`, `useVerifyOtpMutation`, `useEmployeesLookupQuery`.

- [ ] **Step 1: Add endpoint constants**

In `frontend/src/lib/api/endpoints.ts`, inside `surveys`, after `identify` (line 39):

```typescript
    requestOtp: `${API_V1}/survey-sessions/request-otp/`,
    verifyOtp: `${API_V1}/survey-sessions/verify-otp/`,
    employeesLookup: `${API_V1}/survey-sessions/employees-lookup/`,
```

- [ ] **Step 2: Extend types**

In `frontend/src/sections/app/survey-kiosk/api/types.ts`:

```typescript
export type KioskEmployee = {
  id: number;
  fullName: string;
  specialtyName: string;
  photo: string | null;
  phoneMasked: string;
};

export type RequestOtpResponse = { phoneMasked: string };
export type VerifyOtpResponse = { kioskToken: string };
export type EmployeeLookupItem = { id: number; fullName: string };
```

Change `IdentifyEmployeeResponse` to `{ employee: KioskEmployee }`.

- [ ] **Step 3: Rewrite the request functions**

Replace `frontend/src/sections/app/survey-kiosk/api/survey-requests.ts` with public + token-aware versions:

```typescript
import { request, API_ENDPOINTS } from 'src/utils/axios';

import type {
  EmployeeLookupItem,
  IdentifyEmployeePayload,
  IdentifyEmployeeResponse,
  RequestOtpResponse,
  StartSurveyPayload,
  StartSurveyResponse,
  SubmitSurveyPayload,
  SurveySession,
  Test,
  VerifyOtpResponse,
} from './types';

const kioskHeaders = (token: string) => ({ 'X-Kiosk-Token': token });

/** 1:N face search — public, no session created. */
export function identifyEmployee(payload: IdentifyEmployeePayload) {
  const formData = new FormData();
  formData.append('face_image', payload.faceImage);
  return request<IdentifyEmployeeResponse>(
    { method: 'POST', url: API_ENDPOINTS.surveys.identify, data: formData },
    true
  );
}

/** Send SMS one-time code to the identified employee. Public. */
export function requestOtp(employeeId: number) {
  return request<RequestOtpResponse>(
    { method: 'POST', url: API_ENDPOINTS.surveys.requestOtp, data: { employee: employeeId } },
    true
  );
}

/** Verify the code; returns a short-lived kiosk token. Public. */
export function verifyOtp(params: { employeeId: number; code: string; fallback: boolean }) {
  return request<VerifyOtpResponse>(
    {
      method: 'POST',
      url: API_ENDPOINTS.surveys.verifyOtp,
      data: { employee: params.employeeId, code: params.code, fallback: params.fallback },
    },
    true
  );
}

/** Manual-fallback name search. Public; needs >=2 chars. */
export function employeesLookup(q: string) {
  return request<EmployeeLookupItem[]>(
    { method: 'GET', url: API_ENDPOINTS.surveys.employeesLookup, params: { q } },
    true
  );
}

/** Surveys currently due — kiosk-token gated. */
export function fetchDueSurveys(employeeId: number, kioskToken: string) {
  return request<Test[]>(
    {
      method: 'GET',
      url: API_ENDPOINTS.surveys.due,
      params: { employee: employeeId },
      headers: kioskHeaders(kioskToken),
    },
    true
  );
}

/** Start a session — kiosk-token gated. face_image omitted on the manual fallback. */
export function startSurvey(payload: StartSurveyPayload, kioskToken: string) {
  const formData = new FormData();
  formData.append('employee', String(payload.employee));
  formData.append('test', String(payload.test));
  if (payload.faceImage) {
    formData.append('face_image', payload.faceImage);
  }
  return request<StartSurveyResponse>(
    { method: 'POST', url: API_ENDPOINTS.surveys.start, data: formData, headers: kioskHeaders(kioskToken) },
    true
  );
}

/** Persist answers + complete — kiosk-token gated. */
export function submitSurvey(sessionId: number, payload: SubmitSurveyPayload, kioskToken: string) {
  return request<SurveySession>(
    { method: 'POST', url: API_ENDPOINTS.surveys.submit(sessionId), data: payload, headers: kioskHeaders(kioskToken) },
    true
  );
}
```

Also make `StartSurveyPayload.faceImage` optional in `types.ts`:

```typescript
export type StartSurveyPayload = { employee: number; test: number; faceImage?: File };
```

- [ ] **Step 4: Update hooks**

Replace `frontend/src/sections/app/survey-kiosk/api/use-survey-kiosk-api.ts` mutation/query wrappers to thread the token and add OTP hooks:

```typescript
import { useFetch, useMutate } from 'src/hooks/api';

import {
  employeesLookup,
  fetchDueSurveys,
  identifyEmployee,
  requestOtp,
  startSurvey,
  submitSurvey,
  verifyOtp,
} from './survey-requests';
import type {
  EmployeeLookupItem,
  IdentifyEmployeePayload,
  IdentifyEmployeeResponse,
  RequestOtpResponse,
  StartSurveyPayload,
  StartSurveyResponse,
  SubmitSurveyPayload,
  SurveySession,
  Test,
  VerifyOtpResponse,
} from './types';

export function useIdentifyEmployeeMutation() {
  return useMutate<IdentifyEmployeeResponse, IdentifyEmployeePayload>(
    (payload) => identifyEmployee(payload),
    { skipGlobalErrorNotification: true }
  );
}

export function useRequestOtpMutation() {
  return useMutate<RequestOtpResponse, number>((employeeId) => requestOtp(employeeId), {
    skipGlobalErrorNotification: true,
  });
}

export function useVerifyOtpMutation() {
  return useMutate<VerifyOtpResponse, { employeeId: number; code: string; fallback: boolean }>(
    (params) => verifyOtp(params),
    { skipGlobalErrorNotification: true }
  );
}

export function useEmployeesLookupQuery(q: string) {
  return useFetch<EmployeeLookupItem[]>(['kiosk', 'lookup', q], () => employeesLookup(q), {
    enabled: q.trim().length >= 2,
  });
}

export function useDueSurveysQuery(employeeId: number | null, kioskToken: string | null) {
  return useFetch<Test[]>(
    ['kiosk', 'due', employeeId],
    () => fetchDueSurveys(employeeId as number, kioskToken as string),
    { enabled: employeeId !== null && !!kioskToken }
  );
}

export function useStartSurveyMutation() {
  return useMutate<StartSurveyResponse, { payload: StartSurveyPayload; kioskToken: string }>(
    ({ payload, kioskToken }) => startSurvey(payload, kioskToken),
    { skipGlobalErrorNotification: true }
  );
}

export function useSubmitSurveyMutation() {
  return useMutate<
    SurveySession,
    { sessionId: number; payload: SubmitSurveyPayload; kioskToken: string }
  >(({ sessionId, payload, kioskToken }) => submitSurvey(sessionId, payload, kioskToken), {
    skipGlobalErrorNotification: true,
  });
}
```

> Note: this removes `useKioskEmployeesQuery` (the old authed list). The manual fallback uses `useEmployeesLookupQuery` instead. Delete the now-unused `fetchEmployees`/`EmployeeListParams` import.

- [ ] **Step 5: Typecheck**

Run: `make typecheck`
Expected: errors ONLY in files that consume the changed hook signatures (entry-view/answer-view/face-id-step/employee-step) — those are fixed in B4/B5. Confirm no errors inside the api/ folder itself.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/api/endpoints.ts frontend/src/sections/app/survey-kiosk/api
git commit -m "feat(kiosk-api): public identify/otp/lookup + kiosk-token due/start/submit"
```

---

## Task B3: Public route + redirect old kiosk

**Files:**
- Modify: `frontend/src/routes/paths.ts` (add `scan`)
- Create: `frontend/src/routes/sections/public.tsx`
- Modify: `frontend/src/routes/sections/index.tsx` (include public routes)
- Modify: `frontend/src/routes/sections/dashboard.tsx` (remove kiosk routes; redirect)
- Create: `frontend/src/pages/public/scan.tsx`

**Interfaces:**
- Produces: `/scan` public route (no AuthGuard/DashboardLayout) rendering the scan flow; `/kiosk*` → redirect to `/scan`.

- [ ] **Step 1: Add the path**

In `frontend/src/routes/paths.ts`, add a top-level `scan: '/scan',` (e.g. after `home`), and keep `app.kiosk` for the redirect source.

- [ ] **Step 2: Create the public route group**

```tsx
// frontend/src/routes/sections/public.tsx
import { Suspense, lazy } from 'react';
import { LoadingScreen } from 'src/components/loading-screen';

const ScanPage = lazy(() => import('src/pages/public/scan'));

export const publicRoutes = [
  {
    path: 'scan',
    element: (
      <Suspense fallback={<LoadingScreen />}>
        <ScanPage />
      </Suspense>
    ),
  },
];
```

- [ ] **Step 3: Register it + redirect the old kiosk**

In `frontend/src/routes/sections/index.tsx`:

```tsx
import { Navigate, useRoutes } from 'react-router-dom';
import { paths } from 'src/routes/paths';
import { mainRoutes } from './main';
import { authRoutes } from './auth';
import { dashboardRoutes } from './dashboard';
import { publicRoutes } from './public';

export default function Router() {
  return useRoutes([
    { path: '/', element: <Navigate to={paths.login} replace /> },
    ...publicRoutes,
    ...authRoutes,
    ...dashboardRoutes,
    ...mainRoutes,
    { path: '/kiosk', element: <Navigate to={paths.scan} replace /> },
    { path: '/kiosk/*', element: <Navigate to={paths.scan} replace /> },
    { path: '*', element: <Navigate to="/404" replace /> },
  ]);
}
```

In `frontend/src/routes/sections/dashboard.tsx`, delete the two kiosk route objects (lines 69-84) and the two `KioskEntryPage`/`KioskAnswerPage` lazy imports (lines 13-14). (The scan flow is public now.) In `src/pages/home.tsx`, change the `survey:submit` redirect target from `/kiosk` to `paths.scan` so the employee/kiosk role still lands on the scanner.

- [ ] **Step 4: Create the page**

```tsx
// frontend/src/pages/public/scan.tsx
import { Helmet } from 'react-helmet-async';
import ScanView from 'src/sections/app/survey-kiosk/scan-view';

export default function ScanPage() {
  return (
    <>
      <Helmet>
        <title>Decor Center — Survey Kiosk</title>
      </Helmet>
      <ScanView />
    </>
  );
}
```

- [ ] **Step 5: Typecheck (will fail until B4 creates scan-view — expected)**

Run: `make typecheck`
Expected: error `Cannot find module 'src/sections/app/survey-kiosk/scan-view'` — resolved in B4. Do not commit yet; continue to B4.

---

## Task B4: Scan flow view + OTP/confirm components

**Files:**
- Create: `frontend/src/sections/app/survey-kiosk/components/otp-step.tsx`
- Create: `frontend/src/sections/app/survey-kiosk/components/confirm-step.tsx`
- Modify: `frontend/src/sections/app/survey-kiosk/components/index.tsx` (export new steps)
- Modify: `frontend/src/sections/app/survey-kiosk/components/face-id-step.tsx` (use `KioskEmployee` type)
- Rename/replace: `frontend/src/sections/app/survey-kiosk/entry-view.tsx` → `scan-view.tsx`
- Modify: `frontend/src/sections/app/survey-kiosk/answer-view.tsx` (thread token; loop back to `/scan`)

**Interfaces:**
- Consumes: hooks from B2; existing `FaceIdStep`, `DueSurveysStep`, `ThankYouStep`, `QuestionStep`, `SurveyPanel`.
- Produces: `ScanView` default export driving `scan → confirm → otp → due → (navigate to answer)`, and `answer-view` looping back to `/scan`.

- [ ] **Step 1: Point FaceIdStep at the public identify type**

In `face-id-step.tsx`: change `import type { Employee } from '../../employees/api/types';` to `import type { KioskEmployee } from '../api/types';`, and replace every `Employee` usage in that file with `KioskEmployee` (props `onIdentified: (employee: KioskEmployee, faceBlob: Blob) => void`, the `useState<KioskEmployee | null>`, and the `IdentifiedEmployeeBanner` prop type). The banner reads `employee.photo`, `employee.fullName`, `employee.specialtyName` — all present on `KioskEmployee`. No other change; the mutation now returns the public shape.

- [ ] **Step 2: Create the confirm step**

```tsx
// frontend/src/sections/app/survey-kiosk/components/confirm-step.tsx
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { KioskEmployee } from '../api/types';

type Props = {
  employee: KioskEmployee;
  isSending: boolean;
  onSendCode: () => void;
  onRescan: () => void;
};

export default function ConfirmStep({ employee, isSending, onSendCode, onRescan }: Props) {
  return (
    <Stack spacing={3} alignItems="center" textAlign="center" sx={{ py: { xs: 5, md: 8 } }}>
      <Avatar src={employee.photo ?? undefined} alt={employee.fullName} sx={{ width: 96, height: 96 }}>
        {employee.fullName.charAt(0)}
      </Avatar>
      <Stack spacing={0.5}>
        <Typography variant="h4">{employee.fullName}</Typography>
        <Typography variant="body2" color="text.secondary">{employee.specialtyName}</Typography>
      </Stack>
      <Typography variant="body1">
        Отправить SMS-код на {employee.phoneMasked}?
      </Typography>
      <Stack direction="row" spacing={2}>
        <Button variant="outlined" size="large" onClick={onRescan} disabled={isSending}>
          Это не я
        </Button>
        <Button variant="contained" size="large" onClick={onSendCode} disabled={isSending}>
          Отправить код
        </Button>
      </Stack>
    </Stack>
  );
}
```

- [ ] **Step 3: Create the OTP step**

```tsx
// frontend/src/sections/app/survey-kiosk/components/otp-step.tsx
import { useState } from 'react';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

type Props = {
  phoneMasked: string;
  isVerifying: boolean;
  errorText: string | null;
  onVerify: (code: string) => void;
  onBack: () => void;
};

export default function OtpStep({ phoneMasked, isVerifying, errorText, onVerify, onBack }: Props) {
  const [code, setCode] = useState('');
  const canSubmit = code.trim().length >= 4 && !isVerifying;

  return (
    <Stack spacing={3} alignItems="center" textAlign="center" sx={{ py: { xs: 5, md: 8 } }}>
      <Typography variant="h4">Введите код из SMS</Typography>
      <Typography variant="body2" color="text.secondary">
        Код отправлен на {phoneMasked}
      </Typography>
      <TextField
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder="0000"
        inputProps={{ inputMode: 'numeric', style: { fontSize: 32, letterSpacing: 12, textAlign: 'center' } }}
        error={!!errorText}
        helperText={errorText ?? ' '}
        sx={{ width: 220 }}
        autoFocus
      />
      <Stack direction="row" spacing={2}>
        <Button variant="outlined" size="large" onClick={onBack} disabled={isVerifying}>
          Назад
        </Button>
        <Button variant="contained" size="large" disabled={!canSubmit} onClick={() => onVerify(code)}>
          Подтвердить
        </Button>
      </Stack>
    </Stack>
  );
}
```

- [ ] **Step 4: Export the new steps**

In `frontend/src/sections/app/survey-kiosk/components/index.tsx`, add:

```typescript
export { default as ConfirmStep } from './confirm-step';
export { default as OtpStep } from './otp-step';
export { default as ManualPickStep } from './manual-pick-step';
```

(`ManualPickStep` is created in B5; adding the export now is fine — Task B5 creates the file before the next typecheck that includes it. If typechecking B4 alone, create B5's file first or temporarily omit this line and add it in B5.)

- [ ] **Step 5: Write the scan-view state machine**

Create `frontend/src/sections/app/survey-kiosk/scan-view.tsx` (replaces `entry-view.tsx`; delete `entry-view.tsx` and its page `src/pages/app/survey-kiosk-entry.tsx` which is no longer routed):

```tsx
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import { useSnackbar } from 'src/components/snackbar';
import { paths } from 'src/routes/paths';
import { errorReader } from 'src/utils/error-reader';
import type { KioskEmployee } from './api/types';
import type { Test } from '../admin-surveys/api/types';
import {
  useDueSurveysQuery,
  useRequestOtpMutation,
  useStartSurveyMutation,
  useVerifyOtpMutation,
} from './api/use-survey-kiosk-api';
import { ConfirmStep, DueSurveysStep, FaceIdStep, OtpStep, SurveyPanel } from './components';

type Phase = 'scan' | 'confirm' | 'otp' | 'due';

export default function ScanView() {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  const [phase, setPhase] = useState<Phase>('scan');
  const [employee, setEmployee] = useState<KioskEmployee | null>(null);
  const [faceBlob, setFaceBlob] = useState<Blob | null>(null);
  const [fallback, setFallback] = useState(false);
  const [kioskToken, setKioskToken] = useState<string | null>(null);
  const [otpPhoneMasked, setOtpPhoneMasked] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);

  const requestOtpMutation = useRequestOtpMutation();
  const verifyOtpMutation = useVerifyOtpMutation();
  const startMutation = useStartSurveyMutation();
  const dueQuery = useDueSurveysQuery(phase === 'due' && employee ? employee.id : null, kioskToken);

  const reset = useCallback(() => {
    setPhase('scan');
    setEmployee(null);
    setFaceBlob(null);
    setFallback(false);
    setKioskToken(null);
    setOtpPhoneMasked('');
    setOtpError(null);
  }, []);

  const handleIdentified = useCallback((emp: KioskEmployee, blob: Blob) => {
    setEmployee(emp);
    setFaceBlob(blob);
    setFallback(false);
    setPhase('confirm');
  }, []);

  const handleSendCode = useCallback(() => {
    if (!employee) return;
    requestOtpMutation.mutate(employee.id, {
      onSuccess: (data) => {
        setOtpPhoneMasked(data.phoneMasked);
        setOtpError(null);
        setPhase('otp');
      },
      onError: (err) => enqueueSnackbar(errorReader(err), { variant: 'error' }),
    });
  }, [employee, requestOtpMutation, enqueueSnackbar]);

  const handleVerify = useCallback(
    (code: string) => {
      if (!employee) return;
      verifyOtpMutation.mutate(
        { employeeId: employee.id, code, fallback },
        {
          onSuccess: (data) => {
            setKioskToken(data.kioskToken);
            setPhase('due');
          },
          onError: (err) => setOtpError(errorReader(err)),
        }
      );
    },
    [employee, fallback, verifyOtpMutation]
  );

  const handlePick = useCallback(
    (test: Test) => {
      if (!employee || !kioskToken || startMutation.isPending) return;
      startMutation.mutate(
        {
          payload: {
            employee: employee.id,
            test: test.id,
            faceImage: faceBlob ? new File([faceBlob], 'frame.jpg', { type: 'image/jpeg' }) : undefined,
          },
          kioskToken,
        },
        {
          onSuccess: (data) =>
            navigate('/scan/answer', {
              state: { start: data, employeeName: employee.fullName, kioskToken },
            }),
          onError: (err) => enqueueSnackbar(errorReader(err), { variant: 'error' }),
        }
      );
    },
    [employee, kioskToken, faceBlob, startMutation, navigate, enqueueSnackbar]
  );

  if (phase === 'scan') {
    return <FaceIdStep onIdentified={handleIdentified} onBack={reset} />;
  }

  return (
    <SurveyPanel>
      <Box sx={{ minHeight: 480 }}>
        {phase === 'confirm' && employee && (
          <ConfirmStep
            employee={employee}
            isSending={requestOtpMutation.isPending}
            onSendCode={handleSendCode}
            onRescan={reset}
          />
        )}
        {phase === 'otp' && employee && (
          <OtpStep
            phoneMasked={otpPhoneMasked}
            isVerifying={verifyOtpMutation.isPending}
            errorText={otpError}
            onVerify={handleVerify}
            onBack={reset}
          />
        )}
        {phase === 'due' && employee && (
          <DueSurveysStep
            tests={dueQuery.data ?? []}
            isLoading={dueQuery.isPending}
            employeeName={employee.fullName}
            onPick={handlePick}
            onBack={reset}
          />
        )}
      </Box>
    </SurveyPanel>
  );
}
```

> The answer screen is a dedicated public route `'/scan/answer'`, created in Step 6. `otpPhoneMasked` is filled from the `request-otp` response (authoritative for BOTH the primary and manual paths — the manual path has no phone on the `KioskEmployee` object).

- [ ] **Step 6: Add a public answer route + thread the token**

Add to `publicRoutes` (in `routes/sections/public.tsx`) a child:

```tsx
const AnswerPage = lazy(() => import('src/pages/public/scan-answer'));
// ...
export const publicRoutes = [
  { path: 'scan', element: (<Suspense fallback={<LoadingScreen />}><ScanPage /></Suspense>) },
  { path: 'scan/answer', element: (<Suspense fallback={<LoadingScreen />}><AnswerPage /></Suspense>) },
];
```

Create `frontend/src/pages/public/scan-answer.tsx` (mirrors `scan.tsx`, renders `AnswerView`).

In `answer-view.tsx`:
- Read `kioskToken` from `state`: `const kioskToken = state?.kioskToken as string | undefined;`
- If `!start || !kioskToken` → `<Navigate to={paths.scan} replace />`.
- Pass the token to submit: `submitMutation.mutate({ sessionId: start.session.id, payload: { answers: items }, kioskToken }, ...)`.
- `ThankYouStep.onFinish` → `navigate(paths.scan, { replace: true })` (returns to the camera — the kiosk loop). Optionally add a 5s auto-return: `useEffect(() => { if (done) { const t = setTimeout(() => navigate(paths.scan, { replace: true }), 5000); return () => clearTimeout(t); } }, [done, navigate]);`

- [ ] **Step 7: Typecheck**

Run: `make typecheck`
Expected: no errors (after B5's `manual-pick-step.tsx` exists; if typechecking before B5, temporarily comment the ManualPickStep export).

- [ ] **Step 8: Manual smoke test**

Run backend (`make run-backend`) and frontend (`make run-frontend`). Seed an employee with a photo + phone (admin UI). Open `http://localhost:3000/scan` in a browser with a camera → the scanner should identify → confirm → enter `0000` → due list → answer → thank-you → auto-return. Grant camera permission when prompted.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/sections/app/survey-kiosk frontend/src/routes frontend/src/pages/public frontend/src/pages/home.tsx
git rm frontend/src/pages/app/survey-kiosk-entry.tsx frontend/src/pages/app/survey-kiosk-answer.tsx 2>/dev/null || true
git commit -m "feat(scan): public camera-first kiosk flow with SMS OTP"
```

---

## Task B5: Manual fallback (employees-lookup) after repeated face failures

**Files:**
- Create: `frontend/src/sections/app/survey-kiosk/components/manual-pick-step.tsx`
- Modify: `frontend/src/sections/app/survey-kiosk/components/face-id-step.tsx` (surface a “can’t recognise me” affordance after N failures)
- Modify: `frontend/src/sections/app/survey-kiosk/scan-view.tsx` (wire the manual phase)

**Interfaces:**
- Consumes: `useEmployeesLookupQuery` (B2); `EmployeeLookupItem`.
- Produces: `ManualPickStep` (name search → pick) that leads to the same OTP flow with `fallback=true`.

- [ ] **Step 1: Create the manual pick step**

```tsx
// frontend/src/sections/app/survey-kiosk/components/manual-pick-step.tsx
import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useDebounce } from 'src/hooks/use-debounce';
import { useEmployeesLookupQuery } from '../api/use-survey-kiosk-api';
import type { EmployeeLookupItem } from '../api/types';

type Props = {
  onPick: (item: EmployeeLookupItem) => void;
  onBack: () => void;
};

export default function ManualPickStep({ onPick, onBack }: Props) {
  const [term, setTerm] = useState('');
  const q = useDebounce(term, 350);
  const query = useEmployeesLookupQuery(q);
  const items = query.data ?? [];

  return (
    <Stack spacing={3} sx={{ px: { xs: 3, md: 5 }, py: { xs: 4, md: 6 } }}>
      <Typography variant="h4" textAlign="center">Найдите себя по имени</Typography>
      <TextField
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Введите имя (мин. 2 буквы)"
        autoFocus
      />
      <Box sx={{ minHeight: 240 }}>
        <List>
          {items.map((item) => (
            <ListItemButton key={item.id} onClick={() => onPick(item)}>
              <ListItemText primary={item.fullName} />
            </ListItemButton>
          ))}
        </List>
      </Box>
      <Button variant="outlined" onClick={onBack}>Назад к камере</Button>
    </Stack>
  );
}
```

- [ ] **Step 2: Surface the fallback trigger in FaceIdStep**

In `face-id-step.tsx`, add an optional prop `onManualFallback?: () => void` to `Props`, count consecutive `onError` identify failures in local state, and when the count reaches 3 render a text button “Не получается — выбрать по имени” that calls `onManualFallback?.()`. (Place it near the existing `identifyError` alert block, ~line 780.)

- [ ] **Step 3: Wire the manual phase in scan-view**

In `scan-view.tsx`:
- Add `'manual'` to the `Phase` union.
- Pass `onManualFallback={() => setPhase('manual')}` to `<FaceIdStep .../>`.
- Add a handler:

```tsx
  const handleManualPick = useCallback((item: EmployeeLookupItem) => {
    setEmployee({ id: item.id, fullName: item.fullName, specialtyName: '', photo: null, phoneMasked: '' });
    setFaceBlob(null);
    setFallback(true);
    setPhase('otp-request'); // send code immediately, then OTP
  }, []);
```

To keep one path, instead of a new `'otp-request'` phase, call `requestOtp` directly here and jump to `'otp'` on success (reuse `handleSendCode` logic by extracting a `sendCodeFor(employeeId)` helper). Render `{phase === 'manual' && <ManualPickStep onPick={handleManualPick} onBack={reset} />}`. After OTP verify with `fallback=true`, the backend accepts the code alone (no face), and `start` runs with `require_face_match=false`.

- [ ] **Step 4: Typecheck + lint**

Run: `make typecheck && make lint-frontend`
Expected: no errors.

- [ ] **Step 5: Manual test the fallback**

With a covered camera (or a non-matching face), let identify fail 3× → “выбрать по имени” → search → pick → enter `0000` → due → answer. Confirm it completes without a face match.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/sections/app/survey-kiosk
git commit -m "feat(scan): manual name fallback (OTP-only) after face failures"
```

---

## Task B6: Full verification

- [ ] **Step 1: Frontend gates**

Run: `make typecheck && make lint-frontend && make build-frontend`
Expected: all pass; production build succeeds.

- [ ] **Step 2: Backend gates**

Run: `cd backend && .venv/bin/python -m pytest && .venv/bin/ruff check .`
Expected: all green.

- [ ] **Step 3: End-to-end manual pass**

With both servers up: primary path (`/scan` → face → 0000 → survey → thank-you → loop) AND fallback path (3 face failures → name → 0000 → survey). Confirm admin login + Employees/Surveys/Results are unchanged. Confirm `/kiosk` redirects to `/scan`.

- [ ] **Step 4: Final commit / branch is ready**

```bash
git status   # working tree clean
```

Then use superpowers:finishing-a-development-branch to open the PR.

---

## Self-review notes (spec coverage)

- Phone field → A1, B1. SMS port/mock/Eskiz → A2. OTP model/service → A3/A4. Kiosk token + permission → A5. Public identify/request-otp/verify-otp/employees-lookup → A6. Token gate + fallback face-gate → A7. Throttling → A8. Env docs → A9. Public route + redirect old kiosk → B3. Camera-first scan flow + OTP UI → B4. Manual fallback (SMS-only) → B5. Verification → B6.
- Type consistency: backend emits snake_case (`phone_masked`, `kiosk_token`); the frontend humps layer consumes camelCase (`phoneMasked`, `kioskToken`) — asserted on both sides. `KioskEmployee`/`StartSurveyPayload.faceImage?`/hook signatures are defined in B2 and consumed in B4/B5.
- Out of scope (documented, not built): real Eskiz send, anti-spoofing/liveness, “remember device for N minutes”.
