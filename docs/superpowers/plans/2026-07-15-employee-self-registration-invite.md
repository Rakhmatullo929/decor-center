# Employee Self-Registration via One-Time Invite Link — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Пригласить сотрудника" button on `/employees` that mints a one-time link; the invited person self-registers (name, phone, prior experience, face photo) as an **inactive** employee, whom an admin later activates — stamping the hire date at activation.

**Architecture:** A new DB-backed `EmployeeInvite` model (mirroring the existing `OtpChallenge`: hashed token, single-use, expiring) backs the link. Three endpoints under `employee-invites/`: admin `create`, public `validate`, public `register`. The register endpoint reuses the existing `EmployeeSerializer` face-seeding path to create an inactive employee. Admin activation reuses the existing `PATCH /employees/{id}/ {is_active:true}` — extended to stamp `hire_date`. Frontend adds an invite dialog, a public `register/:token` page with camera/upload face capture, and a "pending" chip.

**Tech Stack:** Django + DRF + SimpleJWT (backend, pytest); React 18 + MUI + React Query + axios (frontend, Jest + React Testing Library).

## Global Constraints

- Backend API base path: `/api/v1/` (Django, `backend/config/api_v1.py`). AUTH_USER_MODEL = `accounts.User`; roles are `admin` / `employee` (`apps/accounts/models.py`).
- Default DRF permission is `IsAuthenticated`; public endpoints are opt-in per action via `get_permissions` returning `AllowAny()`, and rate-limited with `ScopedRateThrottle` (pattern: `apps/surveys/views.py:269-283`).
- Raw secrets are **never** stored — store `sha256` hash only (pattern: `OtpChallenge.code_hash`, `apps/surveys/models.py:227`).
- Employee face embedding is computed **server-side** from one uploaded photo via `EmployeeSerializer.create → _seed_display_photo → add_face_photo` (`apps/employees/serializers.py:59-82`, `apps/employees/face_enrollment.py:190`). Inactive employees are already excluded from every kiosk lookup (`is_active=True` filters), so no extra kiosk gating is needed.
- Phone format is E.164, validated by `RegexField(r"^\+\d{9,15}$")` (`apps/employees/serializers.py:18`).
- Frontend axios wrapper auto-converts camelCase↔snake_case on JSON (not FormData) and skips auth when the 2nd arg `isPublic` is `true` (`src/lib/api/request.ts:42`, `src/lib/api/http-client.ts`). FormData bodies must use snake_case keys (pattern: `buildEmployeeBody`, `src/sections/app/employees/api/employees-requests.ts:10`).
- Backend tests: `cd backend && pytest <path> -v` (pytest-django, `DJANGO_SETTINGS_MODULE=config.settings.test`, testpaths=`tests`). Frontend tests: `cd frontend && CI=true yarn test <path>` (react-scripts/Jest). Test helpers: backend fixtures in `backend/tests/conftest.py` + `factories.py`; frontend `render` from `src/test-utils`, locale mock pattern in `src/sections/app/employees/components/__tests__/employee-table-row.test.tsx`.
- Ruff lint (line-length 100, rules E/F/I/W/UP/B) must pass on backend: `cd backend && ruff check apps/`.

---

## File Structure

**Backend (`backend/`)**
- `apps/employees/models.py` — add `EmployeeInvite` model. *(modify)*
- `apps/employees/migrations/0004_employeeinvite.py` — generated migration. *(create)*
- `apps/employees/services.py` — add token helpers (`hash_invite_token`, `create_employee_invite`, `get_invite_by_token`). *(modify)*
- `apps/employees/serializers.py` — add `EmployeeInviteCreateSerializer`; extend `EmployeeSerializer` (`is_self_registered` field, anonymous-safe `_current_user`, `update` stamps `hire_date`). *(modify)*
- `apps/employees/views.py` — add `EmployeeInviteViewSet`; annotate `EmployeeViewSet.queryset` with `is_self_registered`. *(modify)*
- `config/api_v1.py` — register `employee-invites` route. *(modify)*
- `config/settings/base.py` — `DECOR["EMPLOYEE_INVITE_TTL_DAYS"]` + two throttle scopes. *(modify)*
- `tests/test_employee_invites.py` — backend tests. *(create)*

**Frontend (`frontend/src/`)**
- `lib/api/endpoints.ts` — add `employeeInvites` block. *(modify)*
- `sections/app/employees/api/types.ts` — invite/register types + `isSelfRegistered`. *(modify)*
- `sections/app/employees/api/employee-invites-requests.ts` — request functions. *(create)*
- `sections/app/employees/api/use-employee-invites-api.ts` — React Query hooks. *(create)*
- `sections/app/employees/components/invite-employee-dialog.tsx` — admin invite dialog. *(create)*
- `sections/app/employees/components/index.tsx` — export the dialog. *(modify)*
- `sections/app/employees/view.tsx` — add the invite button + dialog. *(modify)*
- `sections/app/employees/components/employee-table-row.tsx` — pending chip. *(modify)*
- `sections/app/employee-register/face-capture.tsx` — camera/upload face widget. *(create)*
- `sections/app/employee-register/register-view.tsx` — public registration flow. *(create)*
- `pages/public/register.tsx` — thin page. *(create)*
- `routes/sections/public.tsx` — add `register/:token` route. *(modify)*
- `routes/paths.ts` — add `register` path helper. *(modify)*
- `locales/langs/ru/employees.json` + `locales/langs/uz/employees.json` — invite/register/status strings. *(modify)*
- Tests: `api/__tests__/employee-invites-requests.test.ts`, `components/__tests__/invite-employee-dialog.test.tsx`, `sections/app/employee-register/__tests__/register-view.test.tsx`, plus additions to `components/__tests__/employee-table-row.test.tsx`. *(create/modify)*

---

## Task 1: `EmployeeInvite` model + token services

**Files:**
- Modify: `backend/apps/employees/models.py`
- Modify: `backend/apps/employees/services.py`
- Modify: `backend/config/settings/base.py`
- Create: `backend/apps/employees/migrations/0004_employeeinvite.py` (generated)
- Test: `backend/tests/test_employee_invites.py`

**Interfaces:**
- Produces:
  - `EmployeeInvite` model with fields `token_hash, specialty(FK), expires_at, is_used, used_at, created_by(FK User), employee(FK Employee, related_name="invites")`; methods `is_expired() -> bool`, `is_valid() -> bool`.
  - `hash_invite_token(raw: str) -> str`
  - `create_employee_invite(specialty, created_by=None) -> tuple[EmployeeInvite, str]` (returns invite + **raw** token)
  - `get_invite_by_token(raw: str) -> EmployeeInvite | None`
  - `settings.DECOR["EMPLOYEE_INVITE_TTL_DAYS"]` (int, default 7)

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_employee_invites.py`:

```python
import pytest
from django.utils import timezone
from datetime import timedelta

from apps.employees.models import EmployeeInvite
from apps.employees.services import (
    create_employee_invite,
    get_invite_by_token,
    hash_invite_token,
)

from .factories import SpecialtyFactory

pytestmark = pytest.mark.django_db


def test_create_invite_stores_hashed_token_and_returns_raw():
    specialty = SpecialtyFactory()
    invite, raw = create_employee_invite(specialty=specialty)
    assert len(raw) >= 32
    # Raw token is never stored; only its hash.
    assert invite.token_hash == hash_invite_token(raw)
    assert EmployeeInvite.objects.filter(token_hash=hash_invite_token(raw)).exists()
    assert not EmployeeInvite.objects.filter(token_hash=raw).exists()
    assert invite.is_valid() is True


def test_get_invite_by_token_roundtrip_and_unknown():
    specialty = SpecialtyFactory()
    invite, raw = create_employee_invite(specialty=specialty)
    assert get_invite_by_token(raw) == invite
    assert get_invite_by_token("nope") is None
    assert get_invite_by_token("") is None


def test_is_valid_reflects_used_and_expired():
    specialty = SpecialtyFactory()
    invite, _ = create_employee_invite(specialty=specialty)

    invite.is_used = True
    assert invite.is_valid() is False

    invite.is_used = False
    invite.expires_at = timezone.now() - timedelta(seconds=1)
    assert invite.is_expired() is True
    assert invite.is_valid() is False
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_employee_invites.py -v`
Expected: FAIL — `ImportError: cannot import name 'EmployeeInvite'`.

- [ ] **Step 3: Add the model**

In `backend/apps/employees/models.py`, append at the end of the file (after `EmployeeFacePhoto`):

```python
class EmployeeInvite(TimeStampedModel):
    """One-time link that lets a person self-register as an (inactive) employee.

    Mirrors OtpChallenge: only the sha256 of the raw token is stored; the raw
    token lives only in the invite URL. Single-use (is_used) with an expiry.
    """

    token_hash = models.CharField(max_length=64, unique=True, db_index=True)
    specialty = models.ForeignKey(
        Specialty, on_delete=models.PROTECT, related_name="invites"
    )
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    used_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="employee_invites",
    )
    employee = models.ForeignKey(
        Employee,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="invites",
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"EmployeeInvite<specialty={self.specialty_id} used={self.is_used}>"

    def is_expired(self) -> bool:
        from django.utils import timezone

        return timezone.now() >= self.expires_at

    def is_valid(self) -> bool:
        return not self.is_used and not self.is_expired()
```

- [ ] **Step 4: Add the settings knob**

In `backend/config/settings/base.py`, inside the `DECOR = { ... }` dict (after the `KIOSK_OTP_MAX_ATTEMPTS` line, ~line 176), add:

```python
    # ── Employee self-registration invite links ────────────────────────────
    "EMPLOYEE_INVITE_TTL_DAYS": env.int("DECOR_EMPLOYEE_INVITE_TTL_DAYS", default=7),
```

And inside `REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]` (after the `kiosk_lookup` line, ~line 125), add:

```python
        "invite_validate": env("DECOR_THROTTLE_INVITE_VALIDATE", default="30/min"),
        "invite_register": env("DECOR_THROTTLE_INVITE_REGISTER", default="10/min"),
```

- [ ] **Step 5: Add the token services**

In `backend/apps/employees/services.py`, add these imports at the top (keep existing imports) and append the functions:

```python
import hashlib
from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from django.utils.crypto import get_random_string

from .models import EmployeeInvite


def hash_invite_token(raw_token: str) -> str:
    """sha256 of the raw invite token (the only form stored in the DB)."""
    return hashlib.sha256(raw_token.encode()).hexdigest()


def create_employee_invite(specialty, created_by=None):
    """Mint a one-time invite. Returns (invite, raw_token). Store only the hash."""
    raw_token = get_random_string(48)
    ttl_days = settings.DECOR["EMPLOYEE_INVITE_TTL_DAYS"]
    invite = EmployeeInvite.objects.create(
        token_hash=hash_invite_token(raw_token),
        specialty=specialty,
        expires_at=timezone.now() + timedelta(days=ttl_days),
        created_by=created_by,
    )
    return invite, raw_token


def get_invite_by_token(raw_token: str):
    """Look up an invite by raw token (any state). Returns None if unknown/blank."""
    if not raw_token:
        return None
    try:
        return EmployeeInvite.objects.select_related("specialty").get(
            token_hash=hash_invite_token(raw_token)
        )
    except EmployeeInvite.DoesNotExist:
        return None
```

Note: `apps/employees/services.py` already imports some of `django.db.transaction` etc.; keep existing imports and only add the missing ones above (avoid duplicate import lines — merge into the existing import block if a name is already imported).

- [ ] **Step 6: Generate the migration**

Run: `cd backend && python manage.py makemigrations employees`
Expected: `Migrations for 'employees': apps/employees/migrations/0004_employeeinvite.py - Create model EmployeeInvite`.

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd backend && pytest tests/test_employee_invites.py -v`
Expected: PASS (3 passed).

- [ ] **Step 8: Lint**

Run: `cd backend && ruff check apps/employees/`
Expected: no errors (fix import ordering if flagged).

- [ ] **Step 9: Commit**

```bash
git add backend/apps/employees/models.py backend/apps/employees/services.py backend/config/settings/base.py backend/apps/employees/migrations/0004_employeeinvite.py backend/tests/test_employee_invites.py
git commit -m "feat(employees): EmployeeInvite model + one-time token services"
```

---

## Task 2: Admin `create` invite endpoint

**Files:**
- Modify: `backend/apps/employees/serializers.py`
- Modify: `backend/apps/employees/views.py`
- Modify: `backend/config/api_v1.py`
- Test: `backend/tests/test_employee_invites.py`

**Interfaces:**
- Consumes: `create_employee_invite` (Task 1).
- Produces:
  - `EmployeeInviteCreateSerializer` (input: `specialty` PK of an active specialty).
  - `EmployeeInviteViewSet` (GenericViewSet) with `create` action → `POST /api/v1/employee-invites/` (admin only), returns `{"token": <raw>, "expires_at": <iso>}` (201). `get_permissions`/`get_throttles` scaffolding for later actions.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_employee_invites.py`:

```python
INVITES_URL = "/api/v1/employee-invites/"


def test_admin_creates_invite_returns_token_and_expiry(admin_client):
    specialty = SpecialtyFactory()
    resp = admin_client.post(INVITES_URL, {"specialty": specialty.id}, format="json")
    assert resp.status_code == 201, resp.data
    assert resp.data["token"]
    assert resp.data["expires_at"]
    # Token in the response must not be what is stored (only its hash is).
    assert not EmployeeInvite.objects.filter(token_hash=resp.data["token"]).exists()
    assert EmployeeInvite.objects.filter(token_hash=hash_invite_token(resp.data["token"])).exists()


def test_non_admin_cannot_create_invite(employee_client):
    specialty = SpecialtyFactory()
    resp = employee_client.post(INVITES_URL, {"specialty": specialty.id}, format="json")
    assert resp.status_code == 403


def test_anonymous_cannot_create_invite(api_client):
    specialty = SpecialtyFactory()
    resp = api_client.post(INVITES_URL, {"specialty": specialty.id}, format="json")
    assert resp.status_code in (401, 403)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_employee_invites.py -k invite -v`
Expected: FAIL — 404 (route not registered) / KeyError.

- [ ] **Step 3: Add the create serializer**

In `backend/apps/employees/serializers.py`, add after the imports and before `EmployeeSerializer` (keep existing `from .models import Employee, EmployeeFacePhoto, Specialty` — no change needed):

```python
class EmployeeInviteCreateSerializer(serializers.Serializer):
    """Admin input for minting a one-time invite: only the specialty (role)."""

    specialty = serializers.PrimaryKeyRelatedField(
        queryset=Specialty.objects.filter(is_active=True)
    )
```

- [ ] **Step 4: Add the viewset**

In `backend/apps/employees/views.py`, add imports at the top:

```python
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.throttling import ScopedRateThrottle

from apps.accounts.permissions import IsAdmin
```

Extend the existing `.serializers` import to include `EmployeeInviteCreateSerializer`, and the existing `.services` import to include `create_employee_invite, get_invite_by_token`:

```python
from .serializers import (
    EmployeeFacePhotoSerializer,
    EmployeeInviteCreateSerializer,
    EmployeeSerializer,
    SpecialtySerializer,
)
from .services import (
    create_employee_invite,
    delete_employee_with_related,
    get_invite_by_token,
)
```

Append the viewset at the end of `views.py`:

```python
class EmployeeInviteViewSet(viewsets.GenericViewSet):
    """One-time employee self-registration invites.

    - create   POST /employee-invites/            admin only  -> {token, expires_at}
    - validate GET  /employee-invites/validate/   public      -> {valid, reason, specialty_name}
    - register POST /employee-invites/register/    public      -> 201 {status: "pending"}
    """

    queryset = EmployeeInvite.objects.all()
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    _THROTTLE_SCOPES = {"validate": "invite_validate", "register": "invite_register"}

    def get_permissions(self):
        if self.action in ("validate", "register"):
            return [AllowAny()]
        return [IsAdmin()]

    def get_throttles(self):
        scope = self._THROTTLE_SCOPES.get(self.action)
        if scope:
            self.throttle_scope = scope
            return [ScopedRateThrottle()]
        return super().get_throttles()

    def create(self, request):
        serializer = EmployeeInviteCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invite, raw_token = create_employee_invite(
            specialty=serializer.validated_data["specialty"],
            created_by=request.user,
        )
        return Response(
            {"token": raw_token, "expires_at": invite.expires_at},
            status=status.HTTP_201_CREATED,
        )
```

Add `EmployeeInvite` to the existing models import in `views.py`:

```python
from .models import Employee, EmployeeFacePhoto, EmployeeInvite, Specialty
```

- [ ] **Step 5: Register the route**

In `backend/config/api_v1.py`, extend the employees import and add the router line:

```python
from apps.employees.views import (
    EmployeeInviteViewSet,
    EmployeeViewSet,
    SpecialtyViewSet,
)
```

```python
router.register("employee-invites", EmployeeInviteViewSet, basename="employee-invite")
```
(add directly after the `router.register("employees", ...)` line.)

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd backend && pytest tests/test_employee_invites.py -k invite -v`
Expected: PASS (create + non-admin 403 + anonymous 401/403).

- [ ] **Step 7: Commit**

```bash
git add backend/apps/employees/serializers.py backend/apps/employees/views.py backend/config/api_v1.py backend/tests/test_employee_invites.py
git commit -m "feat(employees): admin endpoint to mint one-time invite links"
```

---

## Task 3: Public `validate` invite endpoint

**Files:**
- Modify: `backend/apps/employees/views.py`
- Test: `backend/tests/test_employee_invites.py`

**Interfaces:**
- Consumes: `get_invite_by_token` (Task 1), `EmployeeInvite.is_used/is_expired` (Task 1).
- Produces: `GET /api/v1/employee-invites/validate/?token=<raw>` (public) → `{"valid": bool, "reason": "ok"|"used"|"expired"|"not_found", "specialty_name"?: str}`.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_employee_invites.py` (add `timezone`/`timedelta` are already imported at top):

```python
VALIDATE_URL = "/api/v1/employee-invites/validate/"


def test_validate_public_valid_token(api_client):
    specialty = SpecialtyFactory(name="Дизайнер")
    _, raw = create_employee_invite(specialty=specialty)
    resp = api_client.get(VALIDATE_URL, {"token": raw})
    assert resp.status_code == 200
    assert resp.data == {"valid": True, "reason": "ok", "specialty_name": "Дизайнер"}


def test_validate_unknown_used_and_expired(api_client):
    specialty = SpecialtyFactory()
    assert api_client.get(VALIDATE_URL, {"token": "nope"}).data == {
        "valid": False,
        "reason": "not_found",
    }

    invite, raw = create_employee_invite(specialty=specialty)
    invite.is_used = True
    invite.save(update_fields=["is_used"])
    assert api_client.get(VALIDATE_URL, {"token": raw}).data["reason"] == "used"

    invite2, raw2 = create_employee_invite(specialty=specialty)
    invite2.expires_at = timezone.now() - timedelta(seconds=1)
    invite2.save(update_fields=["expires_at"])
    assert api_client.get(VALIDATE_URL, {"token": raw2}).data["reason"] == "expired"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_employee_invites.py -k validate -v`
Expected: FAIL — 404 (action not defined).

- [ ] **Step 3: Add the validate action**

In `backend/apps/employees/views.py`, inside `EmployeeInviteViewSet` (after `create`), add:

```python
    @action(detail=False, methods=["get"])
    def validate(self, request):
        invite = get_invite_by_token(request.query_params.get("token") or "")
        if invite is None:
            return Response({"valid": False, "reason": "not_found"})
        if invite.is_used:
            return Response({"valid": False, "reason": "used"})
        if invite.is_expired():
            return Response({"valid": False, "reason": "expired"})
        return Response(
            {"valid": True, "reason": "ok", "specialty_name": invite.specialty.name}
        )
```

(`action` is already imported in `views.py`.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && pytest tests/test_employee_invites.py -k validate -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/apps/employees/views.py backend/tests/test_employee_invites.py
git commit -m "feat(employees): public validate endpoint for invite links"
```

---

## Task 4: Public `register` endpoint (self-registration)

**Files:**
- Modify: `backend/apps/employees/serializers.py` (anonymous-safe `_current_user`)
- Modify: `backend/apps/employees/views.py` (register action)
- Test: `backend/tests/test_employee_invites.py`

**Interfaces:**
- Consumes: `get_invite_by_token` (Task 1), `EmployeeSerializer` create path (existing).
- Produces: `POST /api/v1/employee-invites/register/` (public, multipart: `token, full_name, phone, work_experience, photo`) → creates `Employee(is_active=False, hire_date=None, specialty=invite.specialty)`, seeds `face_embedding`, marks the invite used and links `employee`; returns `201 {"status": "pending"}`. Invalid/used/expired token → `400 {"code": "invite_invalid"}`.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_employee_invites.py`. Add these imports at the top of the file if missing:

```python
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.employees.models import Employee
from .conftest import png_bytes
```

Then the tests:

```python
REGISTER_URL = "/api/v1/employee-invites/register/"


def _reg_photo():
    return SimpleUploadedFile("face.png", png_bytes(), content_type="image/png")


def test_register_creates_inactive_employee_and_consumes_invite(api_client):
    specialty = SpecialtyFactory()
    invite, raw = create_employee_invite(specialty=specialty)

    resp = api_client.post(
        REGISTER_URL,
        {
            "token": raw,
            "full_name": "Yangi Xodim",
            "phone": "+998901112233",
            "work_experience": 4,
            "photo": _reg_photo(),
        },
        format="multipart",
    )
    assert resp.status_code == 201, resp.data
    assert resp.data == {"status": "pending"}

    employee = Employee.objects.get(full_name="Yangi Xodim")
    assert employee.is_active is False
    assert employee.hire_date is None
    assert employee.specialty_id == specialty.id
    assert employee.work_experience == 4
    assert employee.face_embedding is not None  # seeded from the photo

    invite.refresh_from_db()
    assert invite.is_used is True
    assert invite.used_at is not None
    assert invite.employee_id == employee.id


def test_register_second_use_of_same_token_is_rejected(api_client):
    specialty = SpecialtyFactory()
    _, raw = create_employee_invite(specialty=specialty)
    first = api_client.post(
        REGISTER_URL,
        {"token": raw, "full_name": "A", "phone": "+998901112233",
         "work_experience": 1, "photo": _reg_photo()},
        format="multipart",
    )
    assert first.status_code == 201
    second = api_client.post(
        REGISTER_URL,
        {"token": raw, "full_name": "B", "phone": "+998901112244",
         "work_experience": 1, "photo": _reg_photo()},
        format="multipart",
    )
    assert second.status_code == 400
    assert second.data["code"] == "invite_invalid"
    assert Employee.objects.filter(full_name="B").count() == 0


def test_register_unknown_token_rejected(api_client):
    resp = api_client.post(
        REGISTER_URL,
        {"token": "nope", "full_name": "X", "phone": "+998901112233",
         "work_experience": 1, "photo": _reg_photo()},
        format="multipart",
    )
    assert resp.status_code == 400
    assert resp.data["code"] == "invite_invalid"


def test_register_missing_photo_is_rejected(api_client):
    specialty = SpecialtyFactory()
    _, raw = create_employee_invite(specialty=specialty)
    resp = api_client.post(
        REGISTER_URL,
        {"token": raw, "full_name": "X", "phone": "+998901112233", "work_experience": 1},
        format="multipart",
    )
    assert resp.status_code == 400
    assert not EmployeeInvite.objects.get(token_hash=hash_invite_token(raw)).is_used


def test_inactive_self_registered_employee_is_not_identifiable(api_client, face_image):
    # Register via invite -> inactive employee with a face embedding.
    specialty = SpecialtyFactory()
    _, raw = create_employee_invite(specialty=specialty)
    api_client.post(
        REGISTER_URL,
        {"token": raw, "full_name": "Ghost", "phone": "+998901112233",
         "work_experience": 1, "photo": SimpleUploadedFile("f.png", png_bytes(), content_type="image/png")},
        format="multipart",
    )
    # Kiosk identify only searches active employees -> 404.
    resp = api_client.post(
        "/api/v1/survey-sessions/identify/", {"face_image": face_image}, format="multipart"
    )
    assert resp.status_code == 404
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_employee_invites.py -k register -v`
Expected: FAIL — 404 (register action not defined).

- [ ] **Step 3: Make `EmployeeSerializer._current_user` anonymous-safe**

In `backend/apps/employees/serializers.py`, replace the `_current_user` method body so an anonymous request (public register) resolves to `None` instead of an `AnonymousUser` (which cannot be assigned to the `created_by` FK):

```python
    def _current_user(self):
        request = self.context.get("request")
        user = getattr(request, "user", None) if request is not None else None
        return user if (user is not None and user.is_authenticated) else None
```

- [ ] **Step 4: Add the register action**

In `backend/apps/employees/views.py`, add `from django.utils import timezone` to the imports, then inside `EmployeeInviteViewSet` (after `validate`) add:

```python
    @action(detail=False, methods=["post"])
    def register(self, request):
        invite = get_invite_by_token(request.data.get("token") or "")
        if invite is None or not invite.is_valid():
            return Response(
                {"detail": "Invite link is invalid or already used.", "code": "invite_invalid"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = {
            "full_name": request.data.get("full_name"),
            "phone": request.data.get("phone"),
            "specialty": invite.specialty_id,
            "is_active": False,
            "photo": request.FILES.get("photo"),
        }
        work_experience = request.data.get("work_experience")
        if work_experience not in (None, ""):
            data["work_experience"] = work_experience

        # No request in context -> face-photo created_by resolves to None (anonymous).
        serializer = EmployeeSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            employee = serializer.save()
            invite.is_used = True
            invite.used_at = timezone.now()
            invite.employee = employee
            invite.save(update_fields=["is_used", "used_at", "employee", "updated_at"])
        return Response({"status": "pending"}, status=status.HTTP_201_CREATED)
```

(`transaction` and `status` are already imported in `views.py`.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && pytest tests/test_employee_invites.py -v`
Expected: PASS (all invite tests green).

- [ ] **Step 6: Guard against regressions in the existing employee suite**

Run: `cd backend && pytest tests/test_employees.py tests/test_kiosk_public_api.py -q`
Expected: PASS (the `_current_user` change is behaviour-preserving for authenticated admins).

- [ ] **Step 7: Lint + commit**

```bash
cd backend && ruff check apps/employees/ && cd ..
git add backend/apps/employees/serializers.py backend/apps/employees/views.py backend/tests/test_employee_invites.py
git commit -m "feat(employees): public self-registration endpoint (inactive employee via invite)"
```

---

## Task 5: Activation stamps `hire_date`

**Files:**
- Modify: `backend/apps/employees/serializers.py` (`EmployeeSerializer.update`)
- Test: `backend/tests/test_employee_invites.py`

**Interfaces:**
- Produces: `PATCH /api/v1/employees/{id}/ {"is_active": true}` on an employee whose `hire_date is None` sets `hire_date = today` (only on a `False→True` transition, only when the admin did not supply a hire_date).

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_employee_invites.py`:

```python
from django.utils import timezone as _tz  # noqa: E402  (top-of-file import also fine)


def test_activation_stamps_hire_date_when_missing(admin_client):
    specialty = SpecialtyFactory()
    _, raw = create_employee_invite(specialty=specialty)
    from rest_framework.test import APIClient
    APIClient().post(
        REGISTER_URL,
        {"token": raw, "full_name": "Pending Person", "phone": "+998901112233",
         "work_experience": 2, "photo": _reg_photo()},
        format="multipart",
    )
    employee = Employee.objects.get(full_name="Pending Person")
    assert employee.hire_date is None

    resp = admin_client.patch(
        f"/api/v1/employees/{employee.id}/", {"is_active": True}, format="json"
    )
    assert resp.status_code == 200, resp.data
    employee.refresh_from_db()
    assert employee.is_active is True
    assert employee.hire_date == _tz.localdate()


def test_activation_does_not_overwrite_existing_hire_date(admin_client):
    specialty = SpecialtyFactory()
    employee = EmployeeFactory(specialty=specialty, is_active=False, hire_date="2020-01-01")
    resp = admin_client.patch(
        f"/api/v1/employees/{employee.id}/", {"is_active": True}, format="json"
    )
    assert resp.status_code == 200
    employee.refresh_from_db()
    assert str(employee.hire_date) == "2020-01-01"
```

Add `from .factories import EmployeeFactory` to the imports at the top of the test file if not already present.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_employee_invites.py -k activation -v`
Expected: FAIL — `hire_date` stays `None` after activation.

- [ ] **Step 3: Implement in `EmployeeSerializer.update`**

In `backend/apps/employees/serializers.py`, add `from django.utils import timezone` to the imports, then update the `update` method — insert the hire-date stamp before the transaction:

```python
    def update(self, instance, validated_data):
        photo = validated_data.pop("photo", None)
        # Stamp hire_date on first activation. Self-registered employees have no
        # hire_date until an admin approves them; approving = "Работает с сегодня".
        if (
            validated_data.get("is_active") is True
            and not instance.is_active
            and instance.hire_date is None
            and not validated_data.get("hire_date")
        ):
            validated_data["hire_date"] = timezone.localdate()
        with transaction.atomic():
            employee = super().update(instance, validated_data)
            if photo is not None:
                image_bytes, filename = self._read_upload(photo)
                self._seed_display_photo(employee, image_bytes, filename)
        employee.refresh_from_db()
        return employee
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && pytest tests/test_employee_invites.py -k activation -v`
Expected: PASS (both cases).

- [ ] **Step 5: Commit**

```bash
git add backend/apps/employees/serializers.py backend/tests/test_employee_invites.py
git commit -m "feat(employees): stamp hire_date on first activation"
```

---

## Task 6: Expose `is_self_registered` on the employee API

**Files:**
- Modify: `backend/apps/employees/serializers.py` (`EmployeeSerializer` field)
- Modify: `backend/apps/employees/views.py` (`EmployeeViewSet.queryset` annotation)
- Test: `backend/tests/test_employee_invites.py`

**Interfaces:**
- Produces: `EmployeeSerializer` output gains `is_self_registered: bool` — `True` iff an `EmployeeInvite` points at that employee. Powers the frontend "pending" chip precisely (never false-positives on admin-created employees).

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_employee_invites.py`:

```python
def test_is_self_registered_flag(admin_client):
    specialty = SpecialtyFactory()
    _, raw = create_employee_invite(specialty=specialty)
    from rest_framework.test import APIClient
    APIClient().post(
        REGISTER_URL,
        {"token": raw, "full_name": "Self Reg", "phone": "+998901112233",
         "work_experience": 1, "photo": _reg_photo()},
        format="multipart",
    )
    admin_made = EmployeeFactory(specialty=specialty, full_name="Admin Made")

    resp = admin_client.get("/api/v1/employees/", {"is_active": "false", "search": "Self Reg"})
    assert resp.data["results"][0]["is_self_registered"] is True

    resp2 = admin_client.get(f"/api/v1/employees/{admin_made.id}/")
    assert resp2.data["is_self_registered"] is False
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_employee_invites.py -k self_registered -v`
Expected: FAIL — `KeyError: 'is_self_registered'`.

- [ ] **Step 3: Add the serializer field**

In `backend/apps/employees/serializers.py`, add the field + method to `EmployeeSerializer` and include it in `Meta.fields`:

```python
    is_self_registered = serializers.SerializerMethodField()
```

Add `"is_self_registered",` to the `fields` list (e.g. right before `"created_at"`). Add the method:

```python
    def get_is_self_registered(self, obj) -> bool:
        annotated = getattr(obj, "is_self_registered", None)
        if annotated is not None:
            return bool(annotated)
        return obj.invites.exists()
```

- [ ] **Step 4: Annotate the list queryset**

In `backend/apps/employees/views.py`, add the import:

```python
from django.db.models import Exists, OuterRef, ProtectedError
```
(merge with the existing `from django.db.models import ProtectedError` line — replace it with the line above.)

Change `EmployeeViewSet.queryset` to:

```python
    queryset = Employee.objects.select_related("specialty").annotate(
        is_self_registered=Exists(
            EmployeeInvite.objects.filter(employee=OuterRef("pk"))
        )
    )
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && pytest tests/test_employee_invites.py -k self_registered -v`
Expected: PASS.

- [ ] **Step 6: Full backend regression + lint**

Run: `cd backend && pytest tests/test_employees.py tests/test_employee_invites.py tests/test_api_v1_routes.py -q && ruff check apps/employees/`
Expected: PASS, no lint errors.

- [ ] **Step 7: Commit**

```bash
git add backend/apps/employees/serializers.py backend/apps/employees/views.py backend/tests/test_employee_invites.py
git commit -m "feat(employees): expose is_self_registered on employee API"
```

---

## Task 7: Frontend API layer for invites

**Files:**
- Modify: `frontend/src/lib/api/endpoints.ts`
- Modify: `frontend/src/sections/app/employees/api/types.ts`
- Create: `frontend/src/sections/app/employees/api/employee-invites-requests.ts`
- Create: `frontend/src/sections/app/employees/api/use-employee-invites-api.ts`
- Test: `frontend/src/sections/app/employees/api/__tests__/employee-invites-requests.test.ts`

**Interfaces:**
- Produces:
  - `API_ENDPOINTS.employeeInvites.{create, validate, register}`
  - Types `CreateInviteResponse {token, expiresAt}`, `ValidateInviteResponse {valid, reason, specialtyName?}`, `RegisterEmployeePayload {token, fullName, phone, workExperience, photo}`; `Employee.isSelfRegistered?: boolean`
  - `createInvite(specialty: number)`, `validateInvite(token: string)`, `registerEmployee(payload)`, `buildRegisterBody(payload) -> FormData`
  - Hooks `useCreateInviteMutation()`, `useRegisterEmployeeMutation()`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/sections/app/employees/api/__tests__/employee-invites-requests.test.ts`:

```ts
import { buildRegisterBody } from '../employee-invites-requests';

describe('buildRegisterBody', () => {
  it('builds multipart FormData with snake_case keys', () => {
    const file = new File(['x'], 'face.jpg', { type: 'image/jpeg' });
    const body = buildRegisterBody({
      token: 'abc',
      fullName: 'Yangi Xodim',
      phone: '+998901112233',
      workExperience: 4,
      photo: file,
    });
    expect(body instanceof FormData).toBe(true);
    expect(body.get('token')).toBe('abc');
    expect(body.get('full_name')).toBe('Yangi Xodim');
    expect(body.get('phone')).toBe('+998901112233');
    expect(body.get('work_experience')).toBe('4');
    expect(body.get('photo')).toBe(file);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && CI=true yarn test src/sections/app/employees/api/__tests__/employee-invites-requests.test.ts`
Expected: FAIL — cannot find module `../employee-invites-requests`.

- [ ] **Step 3: Add endpoints**

In `frontend/src/lib/api/endpoints.ts`, add after the `employees` block:

```ts
  employeeInvites: {
    create: `${API_V1}/employee-invites/`,
    validate: `${API_V1}/employee-invites/validate/`,
    register: `${API_V1}/employee-invites/register/`,
  },
```

- [ ] **Step 4: Add types**

In `frontend/src/sections/app/employees/api/types.ts`, add `isSelfRegistered` to `Employee` (optional — the API always returns it; optional keeps existing test fixtures valid):

```ts
  /** True iff this employee self-registered via an invite link (drives the "pending" chip). */
  isSelfRegistered?: boolean;
```

And append the invite types:

```ts
export type CreateInviteResponse = {
  token: string;
  /** ISO datetime the link expires. */
  expiresAt: string;
};

export type InviteInvalidReason = 'ok' | 'used' | 'expired' | 'not_found';

export type ValidateInviteResponse = {
  valid: boolean;
  reason: InviteInvalidReason;
  specialtyName?: string;
};

export type RegisterEmployeePayload = {
  token: string;
  fullName: string;
  phone: string;
  workExperience: number;
  photo: File;
};
```

- [ ] **Step 5: Add the request functions**

Create `frontend/src/sections/app/employees/api/employee-invites-requests.ts`:

```ts
import { request, API_ENDPOINTS } from 'src/utils/axios';

import type {
  CreateInviteResponse,
  RegisterEmployeePayload,
  ValidateInviteResponse,
} from './types';

/** Admin: mint a one-time invite link scoped to a specialty. */
export function createInvite(specialty: number) {
  return request<CreateInviteResponse>({
    method: 'POST',
    url: API_ENDPOINTS.employeeInvites.create,
    data: { specialty },
  });
}

/** Public: check whether an invite token is usable (no auth). */
export function validateInvite(token: string) {
  return request<ValidateInviteResponse>(
    { method: 'GET', url: API_ENDPOINTS.employeeInvites.validate, params: { token } },
    true
  );
}

/** FormData bypasses the camelCase->snake_case transform, so keys are snake_case here. */
export function buildRegisterBody(payload: RegisterEmployeePayload): FormData {
  const formData = new FormData();
  formData.append('token', payload.token);
  formData.append('full_name', payload.fullName);
  formData.append('phone', payload.phone);
  formData.append('work_experience', String(payload.workExperience));
  formData.append('photo', payload.photo);
  return formData;
}

/** Public: submit self-registration (no auth). */
export function registerEmployee(payload: RegisterEmployeePayload) {
  return request<{ status: string }>(
    {
      method: 'POST',
      url: API_ENDPOINTS.employeeInvites.register,
      data: buildRegisterBody(payload),
    },
    true
  );
}
```

- [ ] **Step 6: Add the hooks**

Create `frontend/src/sections/app/employees/api/use-employee-invites-api.ts`:

```ts
import { useMutate } from 'src/hooks/api';

import { createInvite, registerEmployee } from './employee-invites-requests';
import type { CreateInviteResponse, RegisterEmployeePayload } from './types';

export function useCreateInviteMutation() {
  return useMutate<CreateInviteResponse, number>((specialty) => createInvite(specialty));
}

/** Face/validation errors are rendered inside the registration form. */
export function useRegisterEmployeeMutation() {
  return useMutate<{ status: string }, RegisterEmployeePayload>(
    (payload) => registerEmployee(payload),
    { skipGlobalErrorNotification: true }
  );
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd frontend && CI=true yarn test src/sections/app/employees/api/__tests__/employee-invites-requests.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/lib/api/endpoints.ts frontend/src/sections/app/employees/api/types.ts frontend/src/sections/app/employees/api/employee-invites-requests.ts frontend/src/sections/app/employees/api/use-employee-invites-api.ts frontend/src/sections/app/employees/api/__tests__/employee-invites-requests.test.ts
git commit -m "feat(employees): frontend API layer for invite links"
```

---

## Task 8: Invite button + dialog on the Employees page

**Files:**
- Create: `frontend/src/sections/app/employees/components/invite-employee-dialog.tsx`
- Modify: `frontend/src/sections/app/employees/components/index.tsx`
- Modify: `frontend/src/sections/app/employees/view.tsx`
- Modify: `frontend/src/locales/langs/ru/employees.json`, `frontend/src/locales/langs/uz/employees.json`
- Test: `frontend/src/sections/app/employees/components/__tests__/invite-employee-dialog.test.tsx`

**Interfaces:**
- Consumes: `useCreateInviteMutation` (Task 7), `useSpecialtyOptionsQuery` (existing), `useCopyToClipboard` (existing).
- Produces: `<InviteEmployeeDialog open onClose />` — pick specialty → generate → show `${window.location.origin}/register/${token}` with a copy button. New locale keys under `employees.invite.*`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/sections/app/employees/components/__tests__/invite-employee-dialog.test.tsx`:

```tsx
import userEvent from '@testing-library/user-event';

import { render, screen } from 'src/test-utils';

import InviteEmployeeDialog from '../invite-employee-dialog';

jest.mock('src/locales/use-locales', () => ({
  __esModule: true,
  default: () => ({ tx: (k: string) => k, currentLang: { value: 'ru' } }),
}));

// useSnackbar is called at render; mock it (no SnackbarProvider in test-utils).
jest.mock('src/components/snackbar', () => ({
  useSnackbar: () => ({ enqueueSnackbar: jest.fn() }),
}));

const mockMutate = jest.fn();
// The mock fires onSuccess synchronously so the success view renders inside act().
jest.mock('../../api/use-employee-invites-api', () => ({
  useCreateInviteMutation: () => ({
    mutate: (specialty: number, opts: { onSuccess?: (d: unknown) => void }) => {
      mockMutate(specialty);
      opts?.onSuccess?.({ token: 'TOKEN123', expiresAt: '2026-07-22T10:00:00Z' });
    },
    isPending: false,
  }),
}));

jest.mock('../../../specialties/api/use-specialties-api', () => ({
  useSpecialtyOptionsQuery: () => ({ data: { results: [{ id: 3, name: 'Designer' }] } }),
}));

describe('InviteEmployeeDialog', () => {
  beforeEach(() => jest.clearAllMocks());

  it('generates a link and shows the copyable URL', async () => {
    const user = userEvent.setup();
    render(<InviteEmployeeDialog open onClose={jest.fn()} />);

    // open the MUI select and pick "Designer"
    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Designer' }));

    await user.click(screen.getByText('employees.invite.generate'));

    expect(mockMutate).toHaveBeenCalledWith(3);
    expect(await screen.findByDisplayValue(/register\/TOKEN123$/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && CI=true yarn test src/sections/app/employees/components/__tests__/invite-employee-dialog.test.tsx`
Expected: FAIL — cannot find module `../invite-employee-dialog`.

- [ ] **Step 3: Add the locale strings**

In `frontend/src/locales/langs/ru/employees.json`, add an `invite` block (top level, e.g. after `actions`):

```json
  "invite": {
    "action": "Пригласить сотрудника",
    "title": "Пригласить сотрудника",
    "description": "Выберите специальность и создайте одноразовую ссылку. Сотрудник сам заполнит свои данные и фото лица. До активации администратором он будет неактивен.",
    "generate": "Создать ссылку",
    "ready": "Ссылка создана. Скопируйте и отправьте её сотруднику.",
    "expires": "Действует до {{date}}",
    "copied": "Ссылка скопирована",
    "close": "Закрыть"
  },
```

In `frontend/src/locales/langs/uz/employees.json`, add the same block translated:

```json
  "invite": {
    "action": "Xodimni taklif qilish",
    "title": "Xodimni taklif qilish",
    "description": "Mutaxassislikni tanlang va bir martalik havola yarating. Xodim o‘z ma’lumotlari va yuz rasmini o‘zi kiritadi. Administrator faollashtirmaguncha u faol bo‘lmaydi.",
    "generate": "Havola yaratish",
    "ready": "Havola yaratildi. Uni nusxalab, xodimga yuboring.",
    "expires": "{{date}} gacha amal qiladi",
    "copied": "Havola nusxalandi",
    "close": "Yopish"
  },
```

- [ ] **Step 4: Create the dialog**

Create `frontend/src/sections/app/employees/components/invite-employee-dialog.tsx`:

```tsx
import { useEffect, useState } from 'react';
// @mui
import LoadingButton from '@mui/lab/LoadingButton';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
// hooks
import { useCopyToClipboard } from 'src/hooks/use-copy-to-clipboard';
import useLocales from 'src/locales/use-locales';
// utils
import { fDate } from 'src/utils/format-time';
// components
import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
//
import { useSpecialtyOptionsQuery } from '../../specialties/api/use-specialties-api';
import { useCreateInviteMutation } from '../api/use-employee-invites-api';

type Props = {
  open: boolean;
  onClose: VoidFunction;
};

export default function InviteEmployeeDialog({ open, onClose }: Props) {
  const { tx } = useLocales();
  const { enqueueSnackbar } = useSnackbar();
  const { copy } = useCopyToClipboard();

  const specialtyOptionsQuery = useSpecialtyOptionsQuery();
  const specialtyOptions = specialtyOptionsQuery.data?.results ?? [];

  const createMutation = useCreateInviteMutation();

  const [specialty, setSpecialty] = useState<number | ''>('');
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSpecialty('');
      setInviteUrl(null);
      setExpiresAt(null);
    }
  }, [open]);

  const handleGenerate = () => {
    if (specialty === '') return;
    createMutation.mutate(Number(specialty), {
      onSuccess: (data) => {
        setInviteUrl(`${window.location.origin}/register/${data.token}`);
        setExpiresAt(data.expiresAt);
      },
    });
  };

  const handleCopy = async () => {
    if (!inviteUrl) return;
    const ok = await copy(inviteUrl);
    if (ok) enqueueSnackbar(tx('employees.invite.copied'));
  };

  return (
    <Dialog fullWidth maxWidth="sm" open={open} onClose={onClose}>
      <DialogTitle>{tx('employees.invite.title')}</DialogTitle>

      <DialogContent>
        {!inviteUrl ? (
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {tx('employees.invite.description')}
            </Typography>
            <TextField
              select
              fullWidth
              label={`${tx('employees.form.specialty')} *`}
              value={specialty === '' ? '' : String(specialty)}
              onChange={(event) => setSpecialty(Number(event.target.value))}
            >
              {specialtyOptions.map((option) => (
                <MenuItem key={option.id} value={String(option.id)}>
                  {option.name}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        ) : (
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="success">{tx('employees.invite.ready')}</Alert>
            <TextField
              fullWidth
              value={inviteUrl}
              InputProps={{
                readOnly: true,
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={handleCopy} edge="end" aria-label={tx('employees.invite.copied')}>
                      <Iconify icon="solar:copy-bold" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            {expiresAt && (
              <Typography variant="caption" color="text.secondary">
                {tx('employees.invite.expires', { date: fDate(expiresAt) })}
              </Typography>
            )}
          </Stack>
        )}
      </DialogContent>

      <DialogActions>
        <Button variant="outlined" color="inherit" onClick={onClose}>
          {tx('employees.invite.close')}
        </Button>
        {!inviteUrl && (
          <LoadingButton
            variant="contained"
            loading={createMutation.isPending}
            disabled={specialty === ''}
            onClick={handleGenerate}
          >
            {tx('employees.invite.generate')}
          </LoadingButton>
        )}
      </DialogActions>
    </Dialog>
  );
}
```

- [ ] **Step 5: Export it**

In `frontend/src/sections/app/employees/components/index.tsx`, add the export line (match the file's existing export style):

```tsx
export { default as InviteEmployeeDialog } from './invite-employee-dialog';
```

- [ ] **Step 6: Wire the button into the view**

In `frontend/src/sections/app/employees/view.tsx`:

1. Add `import Stack from '@mui/material/Stack';` with the other `@mui/material/*` imports.
2. Add `InviteEmployeeDialog` to the components import:
```tsx
import {
  EmployeeTableRow,
  EmployeesTableToolbar,
  EmployeeUpsertDialog,
  InviteEmployeeDialog,
} from './components';
```
3. Add the dialog boolean near `const upsertDialog = useBoolean();`:
```tsx
  const inviteDialog = useBoolean();
```
4. Replace the `action={ canWrite && ( <Button ... create ... /> ) }` block with a two-button row:
```tsx
        action={
          canWrite && (
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                startIcon={<Iconify icon="solar:link-bold" />}
                onClick={inviteDialog.onTrue}
              >
                {tx('employees.invite.action')}
              </Button>
              <Button
                variant="contained"
                startIcon={<Iconify icon="mingcute:add-line" />}
                onClick={handleOpenCreate}
              >
                {tx('employees.actions.create')}
              </Button>
            </Stack>
          )
        }
```
5. Render the dialog next to `<EmployeeUpsertDialog ... />`:
```tsx
      <InviteEmployeeDialog open={inviteDialog.value} onClose={inviteDialog.onFalse} />
```

- [ ] **Step 7: Keep the existing view test green**

`view.tsx` imports components via the `./components` barrel, which now re-exports `InviteEmployeeDialog`. `view.test.tsx` renders the real dialog (even closed, its hooks run), and the real `useCreateInviteMutation → useMutate → useErrorHandler` needs the AuthProvider that `test-utils` does not supply — which is exactly why the test already mocks `../api/use-employees-api`. Add the sibling mock to `src/sections/app/employees/__tests__/view.test.tsx` (next to the other `jest.mock` calls):

```tsx
jest.mock('../api/use-employee-invites-api', () => ({
  useCreateInviteMutation: () => ({ mutate: jest.fn(), isPending: false }),
}));
```

Then run: `cd frontend && CI=true yarn test src/sections/app/employees/components/__tests__/invite-employee-dialog.test.tsx src/sections/app/employees/__tests__/view.test.tsx`
Expected: PASS (both the new dialog test and the existing view test).

- [ ] **Step 8: Commit**

```bash
git add frontend/src/sections/app/employees/components/invite-employee-dialog.tsx frontend/src/sections/app/employees/components/index.tsx frontend/src/sections/app/employees/view.tsx frontend/src/sections/app/employees/__tests__/view.test.tsx frontend/src/locales/langs/ru/employees.json frontend/src/locales/langs/uz/employees.json frontend/src/sections/app/employees/components/__tests__/invite-employee-dialog.test.tsx
git commit -m "feat(employees): invite button + link-generation dialog"
```

---

## Task 9: `FaceCapture` widget (camera + upload)

**Files:**
- Create: `frontend/src/sections/app/employee-register/face-capture.tsx`
- Test: `frontend/src/sections/app/employee-register/__tests__/face-capture.test.tsx`

**Interfaces:**
- Consumes: `captureFrame` (existing `src/utils/camera.ts`).
- Produces: `<FaceCapture value={File|null} onChange={(file: File|null) => void} />` — live camera capture (primary) with an upload fallback and a retake button; emits a `File` (JPEG/any image) or `null`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/sections/app/employee-register/__tests__/face-capture.test.tsx`:

```tsx
import userEvent from '@testing-library/user-event';

import { render, screen } from 'src/test-utils';

import FaceCapture from '../face-capture';

jest.mock('src/locales/use-locales', () => ({
  __esModule: true,
  default: () => ({ tx: (k: string) => k, currentLang: { value: 'ru' } }),
}));

describe('FaceCapture', () => {
  it('accepts an uploaded file via the upload fallback and can retake', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const { container } = render(<FaceCapture value={null} onChange={onChange} />);

    // switch to upload mode
    await user.click(screen.getByText('employees.register.face.upload'));

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'face.jpg', { type: 'image/jpeg' });
    await user.upload(input, file);

    expect(onChange).toHaveBeenCalledWith(file);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && CI=true yarn test src/sections/app/employee-register/__tests__/face-capture.test.tsx`
Expected: FAIL — cannot find module `../face-capture`.

- [ ] **Step 3: Add the locale strings** (used by this widget and the register view)

In `frontend/src/locales/langs/ru/employees.json`, add a `register` block (top level):

```json
  "register": {
    "title": "Регистрация сотрудника",
    "subtitle": "Заполните свои данные. После проверки администратор активирует вашу учётную запись.",
    "specialty": "Специальность",
    "fullName": "Ф.И.О.",
    "phone": "Телефон",
    "workExperience": "Стаж (лет)",
    "submit": "Отправить",
    "face": {
      "title": "Фото лица",
      "hint": "Смотрите прямо в камеру. Фото используется для входа через распознавание лица.",
      "capture": "Сделать фото",
      "retake": "Переснять",
      "upload": "Загрузить файл",
      "useCamera": "Использовать камеру",
      "cameraUnavailable": "Камера недоступна. Загрузите фото файлом.",
      "required": "Добавьте фото лица"
    },
    "success": {
      "title": "Регистрация отправлена",
      "body": "Ожидайте активации администратором. После активации вы сможете входить через распознавание лица."
    },
    "invalid": {
      "not_found": "Ссылка недействительна.",
      "used": "Эта ссылка уже использована.",
      "expired": "Срок действия ссылки истёк.",
      "generic": "Ссылка недействительна или устарела."
    }
  },
```

In `frontend/src/locales/langs/uz/employees.json`, add the translated block:

```json
  "register": {
    "title": "Xodim ro‘yxatdan o‘tishi",
    "subtitle": "Ma’lumotlaringizni to‘ldiring. Tekshiruvdan so‘ng administrator hisobingizni faollashtiradi.",
    "specialty": "Mutaxassislik",
    "fullName": "F.I.Sh.",
    "phone": "Telefon",
    "workExperience": "Ish staji (yil)",
    "submit": "Yuborish",
    "face": {
      "title": "Yuz rasmi",
      "hint": "To‘g‘ridan-to‘g‘ri kameraga qarang. Rasm yuzni tanib kirish uchun ishlatiladi.",
      "capture": "Rasmga olish",
      "retake": "Qayta olish",
      "upload": "Fayl yuklash",
      "useCamera": "Kameradan foydalanish",
      "cameraUnavailable": "Kamera mavjud emas. Rasmni fayl orqali yuklang.",
      "required": "Yuz rasmini qo‘shing"
    },
    "success": {
      "title": "Ro‘yxatdan o‘tish yuborildi",
      "body": "Administrator faollashtirishini kuting. Faollashtirilgach, yuzni tanib kirishingiz mumkin."
    },
    "invalid": {
      "not_found": "Havola yaroqsiz.",
      "used": "Bu havola allaqachon ishlatilgan.",
      "expired": "Havola muddati tugagan.",
      "generic": "Havola yaroqsiz yoki eskirgan."
    }
  },
```

- [ ] **Step 4: Create the widget**

Create `frontend/src/sections/app/employee-register/face-capture.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
// @mui
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
// hooks
import useLocales from 'src/locales/use-locales';
// utils
import { captureFrame } from 'src/utils/camera';
// components
import Iconify from 'src/components/iconify';

type Mode = 'camera' | 'upload';

type Props = {
  value: File | null;
  onChange: (file: File | null) => void;
};

export default function FaceCapture({ value, onChange }: Props) {
  const { tx } = useLocales();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<Mode>('camera');
  const [cameraError, setCameraError] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  // Run the camera only in camera mode while no photo has been captured yet.
  useEffect(() => {
    if (mode !== 'camera' || value) return undefined;

    let active = true;
    let stream: MediaStream | null = null;

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError(true);
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCameraError(false);
      } catch {
        if (active) setCameraError(true);
      }
    })();

    return () => {
      active = false;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [mode, value]);

  const setFile = (file: File) => {
    setPreview(URL.createObjectURL(file));
    onChange(file);
  };

  const handleCapture = async () => {
    const video = videoRef.current;
    if (!video) return;
    const blob = await captureFrame(video);
    if (!blob) return;
    setFile(new File([blob], 'face.jpg', { type: 'image/jpeg' }));
  };

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) setFile(file);
  };

  const handleRetake = () => {
    setPreview(null);
    onChange(null);
  };

  return (
    <Stack spacing={1.5}>
      <Typography variant="subtitle2">{tx('employees.register.face.title')}</Typography>
      <Typography variant="caption" color="text.secondary">
        {tx('employees.register.face.hint')}
      </Typography>

      <Box
        sx={{
          position: 'relative',
          width: 1,
          aspectRatio: '4 / 3',
          borderRadius: 2,
          overflow: 'hidden',
          bgcolor: 'grey.900',
        }}
      >
        {value && preview ? (
          <Box
            component="img"
            src={preview}
            alt="face"
            sx={{ width: 1, height: 1, objectFit: 'cover' }}
          />
        ) : mode === 'camera' && !cameraError ? (
          <Box
            component="video"
            ref={videoRef}
            autoPlay
            muted
            playsInline
            sx={{ width: 1, height: 1, objectFit: 'cover', transform: 'scaleX(-1)' }}
          />
        ) : (
          <Stack sx={{ height: 1, px: 3 }} alignItems="center" justifyContent="center" spacing={1}>
            <Iconify icon="solar:gallery-add-bold" width={32} sx={{ color: 'grey.500' }} />
            <Typography variant="body2" sx={{ color: 'common.white', textAlign: 'center' }}>
              {tx('employees.register.face.cameraUnavailable')}
            </Typography>
          </Stack>
        )}
      </Box>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={handleUpload}
      />

      <Stack direction="row" spacing={1} flexWrap="wrap">
        {value ? (
          <Button variant="outlined" color="inherit" onClick={handleRetake} startIcon={<Iconify icon="solar:restart-bold" />}>
            {tx('employees.register.face.retake')}
          </Button>
        ) : mode === 'camera' && !cameraError ? (
          <>
            <Button variant="contained" onClick={handleCapture} startIcon={<Iconify icon="solar:camera-bold" />}>
              {tx('employees.register.face.capture')}
            </Button>
            <Button variant="text" color="inherit" onClick={() => setMode('upload')}>
              {tx('employees.register.face.upload')}
            </Button>
          </>
        ) : (
          <>
            <Button variant="contained" onClick={() => fileInputRef.current?.click()} startIcon={<Iconify icon="solar:upload-bold" />}>
              {tx('employees.register.face.upload')}
            </Button>
            <Button variant="text" color="inherit" onClick={() => { setCameraError(false); setMode('camera'); }}>
              {tx('employees.register.face.useCamera')}
            </Button>
          </>
        )}
      </Stack>
    </Stack>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && CI=true yarn test src/sections/app/employee-register/__tests__/face-capture.test.tsx`
Expected: PASS. (jsdom has no `getUserMedia`, so the widget starts in camera mode but shows the fallback; the test switches to upload and uploads a file.)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/sections/app/employee-register/face-capture.tsx frontend/src/sections/app/employee-register/__tests__/face-capture.test.tsx frontend/src/locales/langs/ru/employees.json frontend/src/locales/langs/uz/employees.json
git commit -m "feat(register): FaceCapture widget (camera + upload fallback)"
```

---

## Task 10: Public registration page + route

**Files:**
- Create: `frontend/src/sections/app/employee-register/register-view.tsx`
- Create: `frontend/src/pages/public/register.tsx`
- Modify: `frontend/src/routes/sections/public.tsx`
- Modify: `frontend/src/routes/paths.ts`
- Test: `frontend/src/sections/app/employee-register/__tests__/register-view.test.tsx`

**Interfaces:**
- Consumes: `validateInvite` (Task 7), `useRegisterEmployeeMutation` (Task 7), `FaceCapture` (Task 9), `useFetch` (existing), `paths` (existing).
- Produces: `<EmployeeRegisterView />` — reads `:token` from the URL, validates it, renders the form (full name, phone, work experience, face), submits, shows a success screen. Route `register/:token` in `publicRoutes` (no auth guard). `paths.register(token)` helper.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/sections/app/employee-register/__tests__/register-view.test.tsx`:

```tsx
import { Route, Routes } from 'react-router-dom';

import { render, screen } from 'src/test-utils';

import EmployeeRegisterView from '../register-view';

jest.mock('src/locales/use-locales', () => ({
  __esModule: true,
  default: () => ({ tx: (k: string) => k, currentLang: { value: 'ru' } }),
}));

// error-reader imports axios (ESM) which CRA's Jest cannot transform.
jest.mock('src/utils/error-reader', () => ({ errorReader: () => 'mock-error' }));

const validateMock = jest.fn();
jest.mock('../../employees/api/employee-invites-requests', () => ({
  validateInvite: (token: string) => validateMock(token),
}));

jest.mock('../../employees/api/use-employee-invites-api', () => ({
  useRegisterEmployeeMutation: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

// FaceCapture needs no camera in these tests.
jest.mock('../face-capture', () => ({
  __esModule: true,
  default: () => <div data-testid="face-capture" />,
}));

// test-utils already provides a MemoryRouter — pass the URL via routerEntries, and
// supply the :token Route so useParams resolves. Do NOT nest another Router.
function renderAt(token: string) {
  return render(
    <Routes>
      <Route path="/register/:token" element={<EmployeeRegisterView />} />
    </Routes>,
    { routerEntries: [`/register/${token}`] }
  );
}

describe('EmployeeRegisterView', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows an error state for an invalid token', async () => {
    validateMock.mockResolvedValue({ valid: false, reason: 'used' });
    renderAt('BAD');
    expect(await screen.findByText('employees.register.invalid.used')).toBeInTheDocument();
  });

  it('shows the form for a valid token', async () => {
    validateMock.mockResolvedValue({ valid: true, reason: 'ok', specialtyName: 'Designer' });
    renderAt('GOOD');
    expect(await screen.findByText('employees.register.submit')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Designer')).toBeInTheDocument();
    expect(screen.getByTestId('face-capture')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && CI=true yarn test src/sections/app/employee-register/__tests__/register-view.test.tsx`
Expected: FAIL — cannot find module `../register-view`.

- [ ] **Step 3: Create the view**

Create `frontend/src/sections/app/employee-register/register-view.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
// @mui
import LoadingButton from '@mui/lab/LoadingButton';
import Alert from '@mui/material/Alert';
import Card from '@mui/material/Card';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
// hooks
import useLocales from 'src/locales/use-locales';
// utils
import { errorReader } from 'src/utils/error-reader';
// components
import Iconify from 'src/components/iconify';
//
import { validateInvite } from '../employees/api/employee-invites-requests';
import { useRegisterEmployeeMutation } from '../employees/api/use-employee-invites-api';
import type { ValidateInviteResponse } from '../employees/api/types';
import FaceCapture from './face-capture';

const PHONE_RE = /^\+\d{9,15}$/;

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <Container maxWidth="sm" sx={{ py: { xs: 4, md: 8 } }}>
      <Card sx={{ p: { xs: 3, md: 4 } }}>{children}</Card>
    </Container>
  );
}

export default function EmployeeRegisterView() {
  const { tx } = useLocales();
  const { token = '' } = useParams();

  // Plain fetch (not react-query): the shared useFetch error handler logs the user
  // out / redirects to /login on 4xx — wrong for a public, unauthenticated page.
  const [loading, setLoading] = useState(true);
  const [validation, setValidation] = useState<ValidateInviteResponse | null>(null);

  const registerMutation = useRegisterEmployeeMutation();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [workExperience, setWorkExperience] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [formError, setFormError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let active = true;
    if (!token) {
      setValidation({ valid: false, reason: 'not_found' });
      setLoading(false);
      return undefined;
    }
    validateInvite(token)
      .then((data) => {
        if (active) {
          setValidation(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setValidation({ valid: false, reason: 'not_found' });
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [token]);

  if (loading) {
    return (
      <CenteredCard>
        <Stack alignItems="center" sx={{ py: 4 }}>
          <CircularProgress />
        </Stack>
      </CenteredCard>
    );
  }

  if (!validation?.valid) {
    const reason = validation?.reason;
    const key =
      reason === 'not_found' || reason === 'used' || reason === 'expired' ? reason : 'generic';
    return (
      <CenteredCard>
        <Stack spacing={2} alignItems="center" textAlign="center">
          <Iconify icon="solar:link-broken-bold" width={48} sx={{ color: 'error.main' }} />
          <Typography variant="h6">{tx(`employees.register.invalid.${key}`)}</Typography>
        </Stack>
      </CenteredCard>
    );
  }

  if (submitted) {
    return (
      <CenteredCard>
        <Stack spacing={2} alignItems="center" textAlign="center">
          <Iconify icon="solar:check-circle-bold" width={56} sx={{ color: 'success.main' }} />
          <Typography variant="h5">{tx('employees.register.success.title')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {tx('employees.register.success.body')}
          </Typography>
        </Stack>
      </CenteredCard>
    );
  }

  const handleSubmit = async () => {
    setFormError('');
    if (!fullName.trim() || !PHONE_RE.test(phone) || workExperience === '') {
      setFormError(tx('employees.validation.phoneInvalid'));
      return;
    }
    if (!photo) {
      setFormError(tx('employees.register.face.required'));
      return;
    }
    try {
      await registerMutation.mutateAsync({
        token,
        fullName: fullName.trim(),
        phone,
        workExperience: Number(workExperience),
        photo,
      });
      setSubmitted(true);
    } catch (error) {
      setFormError(errorReader(error as Parameters<typeof errorReader>[0]));
    }
  };

  return (
    <CenteredCard>
      <Stack spacing={2.5}>
        <Stack spacing={0.5}>
          <Typography variant="h5">{tx('employees.register.title')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {tx('employees.register.subtitle')}
          </Typography>
        </Stack>

        {!!formError && <Alert severity="error">{formError}</Alert>}

        <TextField
          label={tx('employees.register.specialty')}
          value={validation.specialtyName ?? ''}
          InputProps={{ readOnly: true }}
          fullWidth
        />

        <TextField
          label={`${tx('employees.register.fullName')} *`}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          fullWidth
        />

        <TextField
          label={`${tx('employees.register.phone')} *`}
          placeholder="+998901234567"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          fullWidth
        />

        <TextField
          label={`${tx('employees.register.workExperience')} *`}
          type="number"
          value={workExperience}
          onChange={(e) => setWorkExperience(e.target.value)}
          InputProps={{ inputProps: { min: 0 } }}
          fullWidth
        />

        <FaceCapture value={photo} onChange={setPhoto} />

        <LoadingButton
          variant="contained"
          size="large"
          loading={registerMutation.isPending}
          onClick={handleSubmit}
        >
          {tx('employees.register.submit')}
        </LoadingButton>
      </Stack>
    </CenteredCard>
  );
}
```

- [ ] **Step 4: Create the page**

Create `frontend/src/pages/public/register.tsx`:

```tsx
import { Helmet } from 'react-helmet-async';

import EmployeeRegisterView from 'src/sections/app/employee-register/register-view';

export default function RegisterPage() {
  return (
    <>
      <Helmet>
        <title>Decor Center — Регистрация сотрудника</title>
      </Helmet>
      <EmployeeRegisterView />
    </>
  );
}
```

- [ ] **Step 5: Add the route + path helper**

In `frontend/src/routes/sections/public.tsx`, add the lazy import and the route:

```tsx
const RegisterPage = lazy(() => import('src/pages/public/register'));
```

Add to the `publicRoutes` array:

```tsx
  {
    path: 'register/:token',
    element: <KioskLayout />,
    children: [{ index: true, element: <RegisterPage /> }],
  },
```

In `frontend/src/routes/paths.ts`, add after the `scanOtp` helper:

```ts
  /** Public one-time employee self-registration link. */
  register: (token: string) => `/register/${token}`,
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd frontend && CI=true yarn test src/sections/app/employee-register/__tests__/register-view.test.tsx`
Expected: PASS (invalid-token error state + valid-token form).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/sections/app/employee-register/register-view.tsx frontend/src/pages/public/register.tsx frontend/src/routes/sections/public.tsx frontend/src/routes/paths.ts frontend/src/sections/app/employee-register/__tests__/register-view.test.tsx
git commit -m "feat(register): public self-registration page + route"
```

---

## Task 11: "Ожидает активации" chip on the employees table

**Files:**
- Modify: `frontend/src/sections/app/employees/components/employee-table-row.tsx`
- Modify: `frontend/src/locales/langs/ru/employees.json`, `frontend/src/locales/langs/uz/employees.json`
- Test: `frontend/src/sections/app/employees/components/__tests__/employee-table-row.test.tsx`

**Interfaces:**
- Consumes: `Employee.isSelfRegistered` (Task 7 type / Task 6 API).
- Produces: a `warning` chip labelled `employees.status.pendingActivation` rendered next to the status `Label` when `row.isSelfRegistered && !row.hireDate`.

- [ ] **Step 1: Write the failing test**

Add to `frontend/src/sections/app/employees/components/__tests__/employee-table-row.test.tsx`:

```tsx
  it('shows the pending-activation chip for a self-registered, never-activated employee', () => {
    renderRow({
      row: { ...archivedEmployee, isSelfRegistered: true, hireDate: null },
    });
    expect(screen.getByText('employees.status.pendingActivation')).toBeInTheDocument();
  });

  it('does not show the pending chip once a hire date exists', () => {
    renderRow({
      row: { ...archivedEmployee, isSelfRegistered: true, hireDate: '2026-07-15' },
    });
    expect(screen.queryByText('employees.status.pendingActivation')).not.toBeInTheDocument();
  });

  it('does not show the pending chip for admin-created employees', () => {
    renderRow({
      row: { ...archivedEmployee, isSelfRegistered: false, hireDate: null },
    });
    expect(screen.queryByText('employees.status.pendingActivation')).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && CI=true yarn test src/sections/app/employees/components/__tests__/employee-table-row.test.tsx`
Expected: FAIL — text `employees.status.pendingActivation` not found.

- [ ] **Step 3: Add the locale string**

In `frontend/src/locales/langs/ru/employees.json`, add a `status` block (top level):

```json
  "status": {
    "pendingActivation": "Ожидает активации"
  },
```

In `frontend/src/locales/langs/uz/employees.json`:

```json
  "status": {
    "pendingActivation": "Faollashtirilishi kutilmoqda"
  },
```

- [ ] **Step 4: Render the chip**

In `frontend/src/sections/app/employees/components/employee-table-row.tsx`, replace the status `TableCell` (the `<Label ...>` block, lines ~76-80) with a stacked status + chip:

```tsx
        <TableCell>
          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
            <Label color={row.isActive ? 'success' : 'default'}>
              {tx(row.isActive ? 'common.status.active' : 'common.status.inactive')}
            </Label>
            {row.isSelfRegistered && !row.hireDate && (
              <Label color="warning">{tx('employees.status.pendingActivation')}</Label>
            )}
          </Stack>
        </TableCell>
```

(`Stack` and `Label` are already imported in this file.)

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && CI=true yarn test src/sections/app/employees/components/__tests__/employee-table-row.test.tsx`
Expected: PASS (all row tests, including the 3 new ones).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/sections/app/employees/components/employee-table-row.tsx frontend/src/locales/langs/ru/employees.json frontend/src/locales/langs/uz/employees.json frontend/src/sections/app/employees/components/__tests__/employee-table-row.test.tsx
git commit -m "feat(employees): pending-activation chip for self-registered employees"
```

---

## Task 12: End-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Full backend suite**

Run: `cd backend && pytest -q`
Expected: all pass (new `test_employee_invites.py` + no regressions). If migrations are unapplied in a dev DB, run `python manage.py migrate` first.

- [ ] **Step 2: Full frontend suite + typecheck**

Run: `cd frontend && CI=true yarn test && yarn tsc --noEmit`
Expected: tests pass; no type errors. (If `yarn tsc` isn't a script, use `npx tsc --noEmit`.)

- [ ] **Step 3: Manual smoke (dev servers running)**

Follow the `/run` or `verify` skill to launch backend + frontend, then:
1. As an admin, open `/employees` → click **Пригласить сотрудника** → pick a specialty → **Создать ссылку** → copy the URL.
2. Open the URL (ideally a second browser/incognito with camera) → confirm the specialty shows read-only → fill name, phone (`+998...`), experience → capture a face (or upload) → **Отправить** → success screen.
3. Back as admin on `/employees` → **Неактивные** tab → the new person appears with the **Ожидает активации** chip → open row menu → **Активировать**.
4. Confirm the employee moves to **Активные**, and (via API or edit dialog) that `hire_date` is today.
5. Reopen the same invite URL → confirm it now shows "already used".

- [ ] **Step 4: Finish the branch**

Use superpowers:finishing-a-development-branch to open a PR or merge.

---

## Self-Review notes (spec coverage)

- One-time link (single-use + 7-day safety expiry): Task 1 (model/services) + Task 4 (consume on register). ✅
- Admin pre-assigns specialty: Task 2 (create takes specialty) + Task 8 (dialog). ✅
- Employee self-enters name/phone/experience + face: Task 9 (face) + Task 10 (form). ✅
- Created inactive; kiosk lockout already enforced: Task 4 (`is_active=False`) + Task 4 test `test_inactive_self_registered_employee_is_not_identifiable`. ✅
- hire_date stamped at activation: Task 5. ✅
- Both camera and upload: Task 9. ✅
- Pending chip (precise via `is_self_registered`): Task 6 (API) + Task 11 (UI). ✅
- Public endpoints AllowAny + throttled: Task 2 (`get_throttles` scaffold) + Tasks 3/4 (public actions) + Task 1 (throttle rates). ✅
- Token hashed at rest: Task 1 + tests. ✅
