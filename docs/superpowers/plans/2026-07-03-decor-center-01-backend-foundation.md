# Backend Foundation & Port Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fork the `depo` reference repo into `decor-center`, strip every medical/instructions/assessments/TTS/AI-test-gen/scoring/medic piece, rename all `depo`/`DEPO_`/`Depo` tokens to `decor`/`DECOR_`/`Decor`, add `Employee.hire_date`/`work_experience`, and land a booting backend where `docker compose up` + migrate + seed succeed and the ported employees/integrations/auth pytest suite is green with ruff clean.

**Architecture:** Django 5.2 + DRF backend copied 1:1 from `depo`, then reduced to four local apps (`apps.core`, `apps.accounts`, `apps.employees`, `apps.integrations`). The face-recognition pipeline (base/registry/mocks/insightface) is preserved verbatim minus the AI test-generator port; a mock face backend is pinned in dev/CI and InsightFace stays available for prod. `apps.surveys` is intentionally NOT added here — Plan 2 creates it and appends it to `INSTALLED_APPS`.

**Tech Stack:** Python 3.12, Django 5.2, DRF 3.16, SimpleJWT, PostgreSQL 18, django-environ, Pillow, openpyxl, insightface/onnxruntime/opencv (prod face), pytest + pytest-django + factory-boy, ruff. Docker Compose for the stack.

## Global Constraints
- Backend framework: Django 5.2 + DRF (settings module `config.settings.{base,dev,prod,test}`).
- Python virtualenv lives at `backend/.venv`; every backend command runs through `backend/.venv/bin/python`.
- Database: PostgreSQL 18 (dev container on host port 5433; DB/user/password all `decor`).
- Rename EVERY token: `DEPO_`→`DECOR_`, `DEPO`→`DECOR`, `Depo`→`Decor`, `depo`→`decor`. No `depo`/`DEPO`/`Depo` token may remain anywhere under `backend/` (excluding `.venv`) or in root infra files after the rename tasks.
- NO scoring, NO pass/fail, NO TTS/audio, NO AI question generation anywhere.
- Roles are exactly `admin` and `specialist` (specialist is displayed "Сотрудник" and is the kiosk role). Role `medic` is fully removed.
- `Employee.face_embedding` and `EmployeeFacePhoto.embedding` stay `editable=False` and are NEVER serialized.
- Face backend: `MockFaceRecognitionService` in dev/CI, `InsightFaceAdapter` in prod (selected via `DECOR_FACE_BACKEND`).
- i18n stays ru+uz (frontend concern; backend untouched here).
- Commit after every task with the exact commands shown. Co-author trailer:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- Absolute paths everywhere. Reference source root: `/Users/rakhmatulloazizov/Downloads/rakhmatullo/June-2026/depo`. Target root: `/Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center`.

---

### Task 1: Copy the depo repo into decor-center + create the venv

**Files:**
- Create: everything under `/Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center/` except the pre-existing `docs/` and `.git/`
- Create: `/Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center/backend/.venv/`

**Interfaces:**
- Consumes: reference repo at `/Users/rakhmatulloazizov/Downloads/rakhmatullo/June-2026/depo`
- Produces: a working tree copy (`backend/`, `frontend/`, `deploy/`, root infra files) and an installed backend venv with dev requirements.

- [ ] **Step 1: Write the failing check** — the target must not yet contain a backend. Expect this to print `MISSING`:
```bash
test -d /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center/backend && echo PRESENT || echo MISSING
```
- [ ] **Step 2: Run it to verify it fails (prints MISSING).**
- [ ] **Step 3: Copy the repo (excluding caches, venv, node_modules, media, build, secrets, and the pre-existing docs) then build the venv.**
```bash
rsync -a \
  --exclude='.git/' \
  --exclude='docs/' \
  --exclude='**/.venv/' \
  --exclude='**/node_modules/' \
  --exclude='**/__pycache__/' \
  --exclude='**/*.pyc' \
  --exclude='**/.pytest_cache/' \
  --exclude='**/.ruff_cache/' \
  --exclude='backend/.env' \
  --exclude='backend/media/' \
  --exclude='frontend/build/' \
  /Users/rakhmatulloazizov/Downloads/rakhmatullo/June-2026/depo/ \
  /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center/

python3 -m venv /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center/backend/.venv
/Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center/backend/.venv/bin/pip install --upgrade pip
/Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center/backend/.venv/bin/pip install -r /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center/backend/requirements/dev.txt
```
- [ ] **Step 4: Verify the copy + venv.** Expect `PRESENT`, a Django version line, and `apps` listing including `assessments medical instructions` (still present — removed in Task 2):
```bash
test -d /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center/backend && echo PRESENT
/Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center/backend/.venv/bin/python -c "import django; print(django.get_version())"
ls /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center/backend/apps
```
- [ ] **Step 5: Commit.**
```bash
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center && \
printf '%s\n' 'backend/.venv/' 'backend/.env' '__pycache__/' '*.pyc' '.pytest_cache/' '.ruff_cache/' 'backend/media/' 'frontend/node_modules/' 'frontend/build/' > .gitignore && \
git add -A && git commit -m "Copy depo reference as decor-center base + backend venv

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Delete dropped apps, commands, fixtures, tests, and TZ docs

**Files:**
- Delete: `backend/apps/medical/`, `backend/apps/instructions/`, `backend/apps/assessments/`
- Delete: `backend/apps/core/management/commands/seed_demo_data.py`
- Delete: `backend/fixtures/01_users.yaml`, `backend/fixtures/04_questions.yaml`, `backend/fixtures/05_medical_checks.yaml`, `backend/fixtures/02_specialties.yaml`, `backend/fixtures/03_employees.yaml`
- Delete: `backend/tests/test_assessment_flow.py`, `test_dashboard_and_export.py`, `test_instructions.py`, `test_medical.py`, `test_questions.py`, `test_question_audio_signal.py`, `test_results_filters.py`, `test_seed_demo_data.py`, `test_submit_reverification.py`
- Delete: `TZ_Lokomotiv_Depo_Buxoro.md`, `Technical_Specification_Locomotive_Depot_EN.md`, `backend/media/` (if copied)

**Interfaces:**
- Consumes: nothing
- Produces: an `apps/` tree of only `core accounts employees integrations` and a `tests/` tree of only the ported files. `fixtures/` retains only `employees_import.json` + `specialties_uz.txt`.

- [ ] **Step 1: Write the failing check** — expect deleted apps still present (prints the three dirs):
```bash
ls /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center/backend/apps | grep -E 'medical|instructions|assessments'
```
- [ ] **Step 2: Run it to verify it fails (the three dirs print).**
- [ ] **Step 3: Delete everything dropped.**
```bash
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center && \
rm -rf backend/apps/medical backend/apps/instructions backend/apps/assessments && \
rm -f backend/apps/core/management/commands/seed_demo_data.py && \
rm -f backend/fixtures/01_users.yaml backend/fixtures/02_specialties.yaml backend/fixtures/03_employees.yaml backend/fixtures/04_questions.yaml backend/fixtures/05_medical_checks.yaml && \
rm -f backend/tests/test_assessment_flow.py backend/tests/test_dashboard_and_export.py backend/tests/test_instructions.py backend/tests/test_medical.py backend/tests/test_questions.py backend/tests/test_question_audio_signal.py backend/tests/test_results_filters.py backend/tests/test_seed_demo_data.py backend/tests/test_submit_reverification.py && \
rm -f TZ_Lokomotiv_Depo_Buxoro.md Technical_Specification_Locomotive_Depot_EN.md && \
rm -rf backend/media
```
- [ ] **Step 4: Verify.** Expect exactly `accounts core employees integrations __init__.py` (order may vary) and NO grep matches:
```bash
ls /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center/backend/apps
ls /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center/backend/apps | grep -E 'medical|instructions|assessments' && echo "STILL PRESENT" || echo "OK removed"
ls /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center/backend/tests
```
- [ ] **Step 5: Commit.**
```bash
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center && git add -A && git commit -m "Drop medical/instructions/assessments apps, demo seed, and their fixtures/tests

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Global token rename depo→decor / DEPO→DECOR / Depo→Decor

**Files:**
- Modify (in place, case-sensitive sed): all files under `backend/` (excluding `.venv/`), plus root `docker-compose.yml`, `docker-compose.prod.yml`, `Makefile`, `README.md`, `DEPLOYMENT.md`, `.env.prod.example`, `.github/workflows/ci.yml`, `.github/workflows/deploy-production.yml`, `deploy/**`.

**Interfaces:**
- Consumes: nothing
- Produces: zero `depo`/`DEPO`/`Depo` tokens outside `.venv/`. Notably renames: `settings.DEPO`→`settings.DECOR`, `DEPO_*` env keys→`DECOR_*`, `DepoTokenObtainPairSerializer`→`DecorTokenObtainPairSerializer`, `DepoUserAdmin`→`DecorUserAdmin`, DB name `depo`→`decor`, container names `depo-*`→`decor-*`.

- [ ] **Step 1: Write the failing check** — expect many matches before renaming:
```bash
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center && \
grep -rIl -e 'depo' -e 'DEPO' -e 'Depo' backend --include='*.py' --include='*.txt' --include='*.toml' --include='Dockerfile*' --include='*.sh' --include='*.env*' | grep -v '/.venv/' | wc -l
```
- [ ] **Step 2: Run it to verify it fails (non-zero count).**
- [ ] **Step 3: Apply the three case-sensitive substitutions across all tracked, non-venv files.**
```bash
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center && \
grep -rIl -e 'depo' -e 'DEPO' -e 'Depo' . \
  --exclude-dir=.git --exclude-dir=.venv --exclude-dir=node_modules --exclude-dir=build \
  --exclude-dir=__pycache__ --exclude-dir=.pytest_cache --exclude-dir=.ruff_cache \
  --exclude-dir=docs \
| while read -r f; do
    sed -i '' -e 's/DEPO/DECOR/g' -e 's/Depo/Decor/g' -e 's/depo/decor/g' "$f"
  done
```
- [ ] **Step 4: Verify.** Expect `0` and `CLEAN`:
```bash
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center && \
grep -rIl -e 'depo' -e 'DEPO' -e 'Depo' . \
  --exclude-dir=.git --exclude-dir=.venv --exclude-dir=node_modules --exclude-dir=build \
  --exclude-dir=__pycache__ --exclude-dir=.pytest_cache --exclude-dir=.ruff_cache --exclude-dir=docs \
  | wc -l
grep -rIn -e 'depo' -e 'DEPO' -e 'Depo' backend --include='*.py' | grep -v '/.venv/' >/dev/null && echo "DIRTY" || echo "CLEAN"
```
- [ ] **Step 5: Commit.**
```bash
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center && git add -A && git commit -m "Rename all depo/DEPO/Depo tokens to decor/DECOR/Decor

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Rewrite `config/settings/base.py` — INSTALLED_APPS, DECOR dict, SPECTACULAR

After Task 3 the settings file mentions `apps.medical/instructions/assessments` (now deleted) and still has scoring/TTS/testgen keys in the `DECOR` dict. Fix it.

**Files:**
- Modify: `backend/config/settings/base.py` (INSTALLED_APPS local apps; the whole `DECOR = {...}` block; SPECTACULAR title/description; DATABASES default)
- Modify: `backend/config/settings/test.py` (trim the `DECOR` override block)
- Test: `backend/tests/test_settings_smoke.py`

**Interfaces:**
- Consumes: nothing
- Produces: `settings.DECOR` dict with exactly these keys — `FACE_SIMILARITY_THRESHOLD`, `FACE_RECOGNITION_BACKEND`, `FACE_INSIGHTFACE_MODEL`, `FACE_DET_SIZE`, `FACE_MAX_PHOTOS_PER_EMPLOYEE`, `FACE_MIN_FACE_PIXELS`, `FACE_BLUR_MIN_VARIANCE`, `ANTI_SPOOFING_BACKEND`, `ANTI_SPOOFING_ENABLED`, `ANTI_SPOOFING_THRESHOLD`, `FACE_WARMUP_ON_STARTUP`, `REVERIFY_ON_SUBMIT`. `INSTALLED_APPS` local apps = `apps.core, apps.accounts, apps.employees, apps.integrations` (NO surveys yet — Plan 2 appends it).

- [ ] **Step 1: Write the failing test** at `backend/tests/test_settings_smoke.py`:
```python
from django.conf import settings


def test_installed_apps_are_reduced():
    local = [a for a in settings.INSTALLED_APPS if a.startswith("apps.")]
    assert local == ["apps.core", "apps.accounts", "apps.employees", "apps.integrations"]
    assert "apps.medical" not in settings.INSTALLED_APPS
    assert "apps.instructions" not in settings.INSTALLED_APPS
    assert "apps.assessments" not in settings.INSTALLED_APPS


def test_decor_dict_has_only_face_keys():
    keys = set(settings.DECOR)
    assert keys == {
        "FACE_SIMILARITY_THRESHOLD",
        "FACE_RECOGNITION_BACKEND",
        "FACE_INSIGHTFACE_MODEL",
        "FACE_DET_SIZE",
        "FACE_MAX_PHOTOS_PER_EMPLOYEE",
        "FACE_MIN_FACE_PIXELS",
        "FACE_BLUR_MIN_VARIANCE",
        "ANTI_SPOOFING_BACKEND",
        "ANTI_SPOOFING_ENABLED",
        "ANTI_SPOOFING_THRESHOLD",
        "FACE_WARMUP_ON_STARTUP",
        "REVERIFY_ON_SUBMIT",
    }
    # scoring / TTS / testgen knobs are gone
    for gone in ("QUESTIONS_PER_TEST", "PASS_THRESHOLD", "TESTGEN_LANGUAGE",
                 "TEST_GENERATOR_BACKEND", "TTS_VOICE_UZ", "UZBEKVOICE_API_KEY", "TTS_ASYNC"):
        assert gone not in settings.DECOR


def test_reverify_default_off():
    assert settings.DECOR["REVERIFY_ON_SUBMIT"] == "off"
```
- [ ] **Step 2: Run it to verify it fails.** Expect a failure on the DECOR key set (still holds TTS/testgen keys):
```bash
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center/backend && .venv/bin/python -m pytest tests/test_settings_smoke.py -q
```
Expected: `test_decor_dict_has_only_face_keys` FAILS (AssertionError on key set).
- [ ] **Step 3: Edit `backend/config/settings/base.py`.** Replace the local-apps portion of `INSTALLED_APPS` (the `# Local apps` block) with exactly:
```python
    # Local apps
    "apps.core",
    "apps.accounts",
    "apps.employees",
    "apps.integrations",
```
Replace the `DATABASES` default with `postgres://localhost:5432/decor` (Task 3 already did this via sed — confirm). Replace the entire `SPECTACULAR_SETTINGS` and `DECOR = {...}` block (everything from `SPECTACULAR_SETTINGS = {` to the end of file) with:
```python
SPECTACULAR_SETTINGS = {
    "TITLE": "Decor Center — Employee Opinion Survey API",
    "DESCRIPTION": "Employee opinion-survey platform for decor-center (no scoring, no pass/fail).",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

# Face-recognition configuration (env-overridable). No scoring / TTS / AI-testgen knobs.
DECOR = {
    "FACE_SIMILARITY_THRESHOLD": env.float("DECOR_FACE_SIMILARITY_THRESHOLD", default=0.6),
    "FACE_RECOGNITION_BACKEND": env(
        "DECOR_FACE_BACKEND", default="apps.integrations.mocks.MockFaceRecognitionService"
    ),
    # InsightFace adapter tuning (only used when FACE_RECOGNITION_BACKEND is InsightFaceAdapter)
    "FACE_INSIGHTFACE_MODEL": env("DECOR_FACE_INSIGHTFACE_MODEL", default="buffalo_sc"),
    "FACE_DET_SIZE": env.int("DECOR_FACE_DET_SIZE", default=640),
    # Multi-photo face enrollment
    "FACE_MAX_PHOTOS_PER_EMPLOYEE": env.int("DECOR_FACE_MAX_PHOTOS", default=5),
    "FACE_MIN_FACE_PIXELS": env.int("DECOR_FACE_MIN_FACE_PIXELS", default=80),
    "FACE_BLUR_MIN_VARIANCE": env.float("DECOR_FACE_BLUR_MIN_VARIANCE", default=0.0),  # 0 = off
    "ANTI_SPOOFING_BACKEND": env(
        "DECOR_ANTI_SPOOFING_BACKEND", default="apps.integrations.mocks.MockAntiSpoofingService"
    ),
    "ANTI_SPOOFING_ENABLED": env.bool("DECOR_ANTI_SPOOFING_ENABLED", default=False),
    "ANTI_SPOOFING_THRESHOLD": env.float("DECOR_ANTI_SPOOFING_THRESHOLD", default=0.5),
    "FACE_WARMUP_ON_STARTUP": env.bool("DECOR_FACE_WARMUP_ON_STARTUP", default=False),
    # Submit-time face re-verification for surveys defaults OFF (opinion surveys, no integrity gate).
    "REVERIFY_ON_SUBMIT": env("DECOR_REVERIFY_ON_SUBMIT", default="off"),
}
```
Then edit `backend/config/settings/test.py` so its override block reads exactly (drop the `TEST_GENERATOR_BACKEND` and `TTS_ASYNC` lines):
```python
"""Test settings: fast hashing, throwaway media, deterministic mock integrations."""
import tempfile

from .dev import *  # noqa: F403
from .dev import DECOR

PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
MEDIA_ROOT = tempfile.mkdtemp(prefix="decor-test-media-")

# Pin the mock integration backends so the suite is deterministic and free of heavy
# ML deps, regardless of what backend/.env selects for dev/prod.
DECOR = {
    **DECOR,
    "FACE_RECOGNITION_BACKEND": "apps.integrations.mocks.MockFaceRecognitionService",
    "ANTI_SPOOFING_BACKEND": "apps.integrations.mocks.MockAntiSpoofingService",
    # Pin submit-time re-verify OFF so submit tests stay deterministic.
    "REVERIFY_ON_SUBMIT": "off",
}
```
- [ ] **Step 4: Run test to verify it passes.**
```bash
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center/backend && .venv/bin/python -m pytest tests/test_settings_smoke.py -q
```
Expected: `3 passed`.
- [ ] **Step 5: Commit.**
```bash
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center && git add -A && git commit -m "Reduce settings: 4 local apps, face-only DECOR dict, survey API title

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: accounts — drop the `medic` role, permissions, and catalog; regenerate the migration

**Files:**
- Modify: `backend/apps/accounts/models.py` (drop `MEDIC` from `Roles`; relabel `SPECIALIST` display to "Сотрудник")
- Modify: `backend/apps/accounts/permissions.py` (drop `IsMedic`, `IsAdminOrMedic`, `IsAdminOrMedicOrSpecialist`)
- Modify: `backend/apps/accounts/permission_catalog.py` (rewrite `ROLE_PERMISSIONS`)
- Delete + regenerate: `backend/apps/accounts/migrations/0001_initial.py`
- Test: `backend/tests/test_roles_and_permissions.py`

**Interfaces:**
- Consumes: nothing
- Produces: `Roles = {ADMIN='admin', SPECIALIST='specialist'}`; permission classes `HasAnyRole`, `IsAdmin`, `IsSpecialist`, `IsAdminOrSpecialist`, `IsAdminOrReadOnly`. `permissions_for_role('admin')` includes `employees:write`, `tests:write`, `results:read`, `dashboard:read`; `permissions_for_role('specialist')` = `['employees:read', 'survey:submit']`.

- [ ] **Step 1: Write the failing test** at `backend/tests/test_roles_and_permissions.py`:
```python
import pytest

from apps.accounts import permissions as perms
from apps.accounts.models import Roles
from apps.accounts.permission_catalog import permissions_for_role


def test_roles_are_admin_and_specialist_only():
    values = {r.value for r in Roles}
    assert values == {"admin", "specialist"}
    assert Roles.SPECIALIST.label == "Сотрудник"


def test_medic_permission_classes_are_gone():
    assert not hasattr(perms, "IsMedic")
    assert not hasattr(perms, "IsAdminOrMedic")
    assert not hasattr(perms, "IsAdminOrMedicOrSpecialist")
    for name in ("HasAnyRole", "IsAdmin", "IsSpecialist", "IsAdminOrSpecialist", "IsAdminOrReadOnly"):
        assert hasattr(perms, name)


def test_permission_catalog():
    admin = permissions_for_role("admin")
    assert "employees:write" in admin
    assert "tests:write" in admin
    assert "results:read" in admin
    assert "dashboard:read" in admin
    assert permissions_for_role("specialist") == ["employees:read", "survey:submit"]
    assert permissions_for_role("medic") == []
```
- [ ] **Step 2: Run it to verify it fails.**
```bash
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center/backend && .venv/bin/python -m pytest tests/test_roles_and_permissions.py -q
```
Expected: fails (`Roles` still has `MEDIC`; `IsMedic` still present).
- [ ] **Step 3: Implement.** Set `backend/apps/accounts/models.py` to:
```python
from django.contrib.auth.models import AbstractUser
from django.db import models


class Roles(models.TextChoices):
    """System roles: admin console + specialist (kiosk device account, shown as "Сотрудник")."""

    ADMIN = "admin", "Administrator"
    SPECIALIST = "specialist", "Сотрудник"


class User(AbstractUser):
    role = models.CharField(max_length=20, choices=Roles.choices, default=Roles.SPECIALIST)

    def __str__(self):
        return f"{self.username} ({self.role})"
```
In `backend/apps/accounts/permissions.py` delete the three medic classes so the file is exactly:
```python
"""Role-based permission classes — enforced server-side."""
from rest_framework.permissions import SAFE_METHODS, BasePermission

from .models import Roles


class HasAnyRole(BasePermission):
    """Allow only authenticated users whose role is in `allowed_roles`."""

    allowed_roles: frozenset = frozenset()

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role in self.allowed_roles)


class IsAdmin(HasAnyRole):
    allowed_roles = frozenset({Roles.ADMIN})


class IsSpecialist(HasAnyRole):
    allowed_roles = frozenset({Roles.SPECIALIST})


class IsAdminOrSpecialist(HasAnyRole):
    allowed_roles = frozenset({Roles.ADMIN, Roles.SPECIALIST})


class IsAdminOrReadOnly(BasePermission):
    """Authenticated users may read; only admins may write."""

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if request.method in SAFE_METHODS:
            return True
        return user.role == Roles.ADMIN
```
Set `backend/apps/accounts/permission_catalog.py` `ROLE_PERMISSIONS` to:
```python
ROLE_PERMISSIONS: dict[str, list[str]] = {
    Roles.ADMIN: [
        "dashboard:read",
        "employees:read",
        "employees:write",
        "specialties:read",
        "specialties:write",
        "tests:read",
        "tests:write",
        "questions:read",
        "questions:write",
        "results:read",
        "results:detail",
    ],
    Roles.SPECIALIST: [
        "employees:read",
        "survey:submit",
    ],
}
```
Regenerate the migration (its old form still lists the `medic` choice):
```bash
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center/backend && \
rm -f apps/accounts/migrations/0001_initial.py && \
DJANGO_SETTINGS_MODULE=config.settings.dev .venv/bin/python manage.py makemigrations accounts
```
- [ ] **Step 4: Run test to verify it passes.**
```bash
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center/backend && .venv/bin/python -m pytest tests/test_roles_and_permissions.py -q
```
Expected: `3 passed`. Also confirm the new migration has no `medic`:
```bash
grep -c medic /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center/backend/apps/accounts/migrations/0001_initial.py || echo "no medic"
```
- [ ] **Step 5: Commit.**
```bash
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center && git add -A && git commit -m "accounts: drop medic role, medic permission classes, rewrite catalog; regen migration

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: integrations — drop the AI test-generator port (keep the face pipeline)

**Files:**
- Modify: `backend/apps/integrations/base.py` (remove `GeneratedQuestion` dataclass + `TestGeneratorService` ABC)
- Modify: `backend/apps/integrations/registry.py` (remove `get_test_generator_service` + `TestGeneratorService` import)
- Modify: `backend/apps/integrations/mocks.py` (remove `MockTestGeneratorService` + `GeneratedQuestion` import)
- Test: `backend/tests/test_integrations_face_only.py`

**Interfaces:**
- Consumes: nothing
- Produces: `apps.integrations.registry.get_face_recognition_service()` and `get_anti_spoofing_service()` remain; `get_test_generator_service` is gone. Face service methods unchanged: `compare(embedding, image_bytes)->(bool,float)`, `extract_embedding(image_bytes)->list`, `compare_embeddings(e1,e2)->(bool,float)`, `identify_best_match(candidates, image_bytes)->(id|None,float)`, `detect`, `warmup`. `NoFaceDetectedError` and `DetectedFace` stay.

- [ ] **Step 1: Write the failing test** at `backend/tests/test_integrations_face_only.py`:
```python
from apps.integrations import base, mocks, registry


def test_test_generator_port_is_removed():
    assert not hasattr(base, "TestGeneratorService")
    assert not hasattr(base, "GeneratedQuestion")
    assert not hasattr(mocks, "MockTestGeneratorService")
    assert not hasattr(registry, "get_test_generator_service")


def test_face_pipeline_intact():
    assert hasattr(registry, "get_face_recognition_service")
    assert hasattr(registry, "get_anti_spoofing_service")
    assert hasattr(base, "NoFaceDetectedError")
    assert hasattr(base, "DetectedFace")
    svc = registry.get_face_recognition_service()
    for method in ("compare", "extract_embedding", "compare_embeddings", "identify_best_match", "detect", "warmup"):
        assert hasattr(svc, method)
```
- [ ] **Step 2: Run it to verify it fails.**
```bash
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center/backend && .venv/bin/python -m pytest tests/test_integrations_face_only.py -q
```
Expected: `test_test_generator_port_is_removed` FAILS (`TestGeneratorService` still exists).
- [ ] **Step 3: Implement.** In `backend/apps/integrations/base.py`, delete the `GeneratedQuestion` dataclass and the `TestGeneratorService` class (the last two definitions). The file must end after `AntiSpoofingService`. Remove the now-unused `GeneratedQuestion` mention in the module docstring's "Claude API / TTS" line (leave a face-only docstring). In `backend/apps/integrations/registry.py` set the file to exactly:
```python
"""Resolve active integration backends from settings (DECOR dict)."""
from django.conf import settings
from django.utils.module_loading import import_string

from .base import AntiSpoofingService, FaceRecognitionService


def get_face_recognition_service() -> FaceRecognitionService:
    return import_string(settings.DECOR["FACE_RECOGNITION_BACKEND"])()


def get_anti_spoofing_service() -> AntiSpoofingService:
    return import_string(settings.DECOR["ANTI_SPOOFING_BACKEND"])()
```
In `backend/apps/integrations/mocks.py`: remove `GeneratedQuestion` and `TestGeneratorService` from the `from .base import (...)` block, and delete the entire `MockTestGeneratorService` class at the bottom. The remaining imports must be `AntiSpoofingService, DetectedFace, FaceRecognitionService, NoFaceDetectedError`.
- [ ] **Step 4: Run test to verify it passes.**
```bash
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center/backend && .venv/bin/python -m pytest tests/test_integrations_face_only.py -q
```
Expected: `2 passed`.
- [ ] **Step 5: Commit.**
```bash
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center && git add -A && git commit -m "integrations: remove AI test-generator port, keep face pipeline

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: employees — add `hire_date` + `work_experience`; update serializer/admin/views/import; regenerate migrations

**Files:**
- Modify: `backend/apps/employees/models.py` (two new `Employee` fields)
- Modify: `backend/apps/employees/serializers.py` (add fields to `EmployeeSerializer.Meta.fields`)
- Modify: `backend/apps/employees/admin.py` (`list_display` + `list_filter`)
- Modify: `backend/apps/employees/views.py` (`ordering_fields`)
- Modify: `backend/apps/employees/management/commands/import_employees.py` (parse optional `hire_date`/`work_experience`)
- Delete + regenerate: `backend/apps/employees/migrations/0001_initial.py`, `0002_employeefacephoto.py`, `0003_backfill_face_photos.py`
- Test: `backend/tests/test_employee_new_fields.py`

**Interfaces:**
- Consumes: `apps.accounts` migration (Task 5) for the `AUTH_USER_MODEL` FK on `EmployeeFacePhoto`.
- Produces: `Employee.hire_date: DateField(null=True, blank=True, verbose_name="Работает с")`, `Employee.work_experience: PositiveIntegerField(null=True, blank=True, verbose_name="Стаж")`. `EmployeeSerializer.Meta.fields` includes `'hire_date'` and `'work_experience'` (and still excludes `face_embedding`). A single fresh `employees/migrations/0001_initial.py` holding `Specialty`, `Employee` (with both new fields), and `EmployeeFacePhoto`.

- [ ] **Step 1: Write the failing test** at `backend/tests/test_employee_new_fields.py`:
```python
import pytest

from apps.employees.models import Employee
from apps.employees.serializers import EmployeeSerializer

from .factories import EmployeeFactory, SpecialtyFactory

pytestmark = pytest.mark.django_db


def test_model_has_new_fields():
    f = {fld.name for fld in Employee._meta.get_fields()}
    assert "hire_date" in f
    assert "work_experience" in f


def test_serializer_exposes_new_fields_but_not_embedding():
    fields = EmployeeSerializer.Meta.fields
    assert "hire_date" in fields
    assert "work_experience" in fields
    assert "face_embedding" not in fields


def test_serialized_employee_roundtrips_new_fields():
    emp = EmployeeFactory(hire_date="2020-01-15", work_experience=5)
    data = EmployeeSerializer(emp).data
    assert data["hire_date"] == "2020-01-15"
    assert data["work_experience"] == 5
    assert "face_embedding" not in data


def test_import_reads_optional_new_fields(tmp_path):
    import json

    from django.core.management import call_command

    SpecialtyFactory(name="teplovoz mashinisti")
    path = tmp_path / "roster.json"
    path.write_text(json.dumps([
        {"name": "Ivanov Ivan", "speciality": "teplovoz mashinisti",
         "hire_date": "2019-03-01", "work_experience": 7},
        {"name": "Petrov Petr", "speciality": "teplovoz mashinisti"},
    ], ensure_ascii=False), encoding="utf-8")
    call_command("import_employees", "--file", str(path))
    ivanov = Employee.objects.get(full_name="Ivanov Ivan")
    assert str(ivanov.hire_date) == "2019-03-01"
    assert ivanov.work_experience == 7
    petrov = Employee.objects.get(full_name="Petrov Petr")
    assert petrov.hire_date is None
    assert petrov.work_experience is None
```
(Note: this test needs the ported `tests/factories.py` from Task 10. Sequence Task 10 before running the full suite; you can run this file after Task 10.)
- [ ] **Step 2: Run it to verify it fails.** Run after Task 10's scaffolding exists; before implementing the fields it fails on `hire_date`:
```bash
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center/backend && .venv/bin/python -m pytest tests/test_employee_new_fields.py -q
```
Expected: fails (no `hire_date` field / serializer missing keys).
- [ ] **Step 3: Implement.** In `backend/apps/employees/models.py`, add the two fields to `Employee` right after `photo` (keep `face_embedding` editable=False):
```python
    hire_date = models.DateField("Работает с", null=True, blank=True)
    work_experience = models.PositiveIntegerField("Стаж", null=True, blank=True)
```
In `backend/apps/employees/serializers.py`, extend `EmployeeSerializer.Meta.fields` to:
```python
        fields = [
            "id",
            "full_name",
            "specialty",
            "specialty_name",
            "photo",
            "hire_date",
            "work_experience",
            "is_active",
            "created_at",
        ]
```
In `backend/apps/employees/admin.py` set:
```python
@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ["full_name", "specialty", "hire_date", "work_experience", "is_active", "created_at"]
    list_filter = ["specialty", "is_active", "hire_date"]
    search_fields = ["full_name"]
```
In `backend/apps/employees/views.py`, change `EmployeeViewSet.ordering_fields` to:
```python
    ordering_fields = ["full_name", "hire_date", "created_at"]
```
In `backend/apps/employees/management/commands/import_employees.py`, carry the optional fields. Change the resolved tuple to include them: in the resolve loop replace `resolved.append((full_name, specialty))` with logic that reads `hire_date`/`work_experience`:
```python
            hire_date = (record.get("hire_date") or None) or None
            work_experience = record.get("work_experience")
            resolved.append((full_name, specialty, hire_date, work_experience))
```
and update the create loop:
```python
            for full_name, specialty, hire_date, work_experience in resolved:
                if full_name in existing:
                    skipped += 1
                    continue
                Employee.objects.create(
                    full_name=full_name,
                    specialty=specialty,
                    photo="",
                    hire_date=hire_date,
                    work_experience=work_experience,
                )
                existing.add(full_name)
                created += 1
```
Regenerate the employees migrations into a single fresh `0001_initial` (fresh DB, no legacy data — the backfill data migration is dropped; `backfill_legacy_samples` stays in `face_enrollment.py` for reindex/tests):
```bash
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center/backend && \
rm -f apps/employees/migrations/0001_initial.py apps/employees/migrations/0002_employeefacephoto.py apps/employees/migrations/0003_backfill_face_photos.py && \
DJANGO_SETTINGS_MODULE=config.settings.dev .venv/bin/python manage.py makemigrations employees
```
- [ ] **Step 4: Run test to verify it passes** (after Task 10 scaffolding is in place) and confirm the fresh migration folds both fields:
```bash
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center/backend && .venv/bin/python -m pytest tests/test_employee_new_fields.py -q
grep -E "hire_date|work_experience" apps/employees/migrations/0001_initial.py
```
Expected: `4 passed`; grep shows both fields in `0001_initial.py`.
- [ ] **Step 5: Commit.**
```bash
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center && git add -A && git commit -m "employees: add hire_date + work_experience across model/serializer/admin/import; fresh 0001

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: config/api_v1.py + minimal DashboardStatsView (no deleted-app imports)

After Task 2, `config/api_v1.py` and `apps/core/views.py` still import the deleted `assessments`/`instructions`/`medical` apps, so the project cannot boot. Reduce the router to `specialties`+`employees` and replace `DashboardStatsView` with a survey-agnostic placeholder (Plan 2 enriches it).

**Files:**
- Modify: `backend/config/api_v1.py`
- Modify: `backend/apps/core/views.py`
- Test: `backend/tests/test_api_v1_routes.py`

**Interfaces:**
- Consumes: `apps.employees.views.{EmployeeViewSet, SpecialtyViewSet}` (Task 7), `apps.accounts.permissions.IsAdmin`.
- Produces: `/api/v1/` exposes `specialties/`, `employees/`, `auth/*`, `dashboard/stats/`, `schema/`, `docs/`. `DashboardStatsView` (IsAdmin) returns `{"totals": {"active_employees": int, "specialties": int}}`. NO `questions/`, `test-sessions/`, `instructions/`, `medical-checks/` routes (Plan 2 adds survey routes).

- [ ] **Step 1: Write the failing test** at `backend/tests/test_api_v1_routes.py`:
```python
import pytest

pytestmark = pytest.mark.django_db


def test_dropped_routes_are_gone(admin_client):
    for path in ("/api/v1/questions/", "/api/v1/test-sessions/",
                 "/api/v1/instructions/", "/api/v1/medical-checks/"):
        assert admin_client.get(path).status_code == 404


def test_kept_routes_resolve(admin_client):
    assert admin_client.get("/api/v1/employees/").status_code == 200
    assert admin_client.get("/api/v1/specialties/").status_code == 200


def test_dashboard_returns_totals(admin_client):
    resp = admin_client.get("/api/v1/dashboard/stats/")
    assert resp.status_code == 200
    assert "active_employees" in resp.data["totals"]
    assert "specialties" in resp.data["totals"]
```
- [ ] **Step 2: Run it to verify it fails.** Before the edit the project raises `ModuleNotFoundError: apps.assessments` at import — the whole suite errors on collection:
```bash
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center/backend && .venv/bin/python -m pytest tests/test_api_v1_routes.py -q
```
Expected: collection ERROR (`No module named 'apps.assessments'`).
- [ ] **Step 3: Implement.** Set `backend/config/api_v1.py` to exactly:
```python
"""API v1 routing: all module endpoints under /api/v1/."""
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import DefaultRouter

from apps.core.views import DashboardStatsView
from apps.employees.views import EmployeeViewSet, SpecialtyViewSet

router = DefaultRouter()
router.register("specialties", SpecialtyViewSet, basename="specialty")
router.register("employees", EmployeeViewSet, basename="employee")

urlpatterns = [
    path("auth/", include("apps.accounts.urls")),
    path("dashboard/stats/", DashboardStatsView.as_view(), name="dashboard-stats"),
    path("schema/", SpectacularAPIView.as_view(), name="schema"),
    path("docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
    *router.urls,
]
```
Set `backend/apps/core/views.py` to exactly:
```python
"""Admin dashboard statistics — survey counters are added in Plan 2 (surveys app)."""
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdmin
from apps.employees.models import Employee, Specialty


class DashboardStatsView(APIView):
    """Minimal totals for the admin dashboard. Extended with survey counters in Plan 2."""

    permission_classes = [IsAdmin]

    def get(self, request):
        return Response(
            {
                "totals": {
                    "active_employees": Employee.objects.filter(is_active=True).count(),
                    "specialties": Specialty.objects.count(),
                }
            }
        )
```
- [ ] **Step 4: Run test to verify it passes** (after Task 10 scaffolding provides `admin_client`):
```bash
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center/backend && .venv/bin/python -m pytest tests/test_api_v1_routes.py -q
```
Expected: `3 passed`.
- [ ] **Step 5: Commit.**
```bash
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center && git add -A && git commit -m "api_v1: register only specialties+employees; minimal survey-agnostic dashboard

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: seed_initial_data — drop the medic account

**Files:**
- Modify: `backend/apps/core/management/commands/seed_initial_data.py` (remove the `medic` row; `DECOR_*` env vars already renamed by Task 3)
- Test: `backend/tests/test_seed_initial_data.py`

**Interfaces:**
- Consumes: `apps.accounts.models.{Roles, User}`, `apps.employees.models.Specialty`.
- Produces: `seed_initial_data` creates the specialties roster + two accounts: `admin` (staff+superuser, `Roles.ADMIN`, password from `DECOR_ADMIN_PASSWORD`) and `specialist` (kiosk, `Roles.SPECIALIST`, password from `DECOR_SPECIALIST_PASSWORD`). Idempotent.

- [ ] **Step 1: Write the failing test** at `backend/tests/test_seed_initial_data.py`:
```python
import pytest
from django.core.management import call_command

from apps.accounts.models import User
from apps.employees.models import Specialty

pytestmark = pytest.mark.django_db


def test_seed_creates_admin_and_specialist_only():
    call_command("seed_initial_data")
    usernames = set(User.objects.values_list("username", flat=True))
    assert usernames == {"admin", "specialist"}
    assert not User.objects.filter(username="medic").exists()
    admin = User.objects.get(username="admin")
    assert admin.is_superuser and admin.is_staff and admin.role == "admin"
    specialist = User.objects.get(username="specialist")
    assert specialist.role == "specialist"
    assert Specialty.objects.count() > 0


def test_seed_is_idempotent():
    call_command("seed_initial_data")
    call_command("seed_initial_data")
    assert User.objects.filter(username="admin").count() == 1
```
- [ ] **Step 2: Run it to verify it fails.**
```bash
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center/backend && .venv/bin/python -m pytest tests/test_seed_initial_data.py -q
```
Expected: fails (`medic` user is created; `usernames` set has 3 entries).
- [ ] **Step 3: Implement.** In `backend/apps/core/management/commands/seed_initial_data.py`, replace the `ACCOUNTS` list with (drop the medic row):
```python
ACCOUNTS = [
    # (username, role, is_staff, is_superuser, password_env, default_password)
    ("admin", Roles.ADMIN, True, True, "DECOR_ADMIN_PASSWORD", "admin12345!"),
    ("specialist", Roles.SPECIALIST, False, False, "DECOR_SPECIALIST_PASSWORD", "specialist12345!"),
]
```
- [ ] **Step 4: Run test to verify it passes.**
```bash
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center/backend && .venv/bin/python -m pytest tests/test_seed_initial_data.py -q
```
Expected: `2 passed`.
- [ ] **Step 5: Commit.**
```bash
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center && git add -A && git commit -m "seed_initial_data: drop medic account, keep admin + specialist (kiosk)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Port the test scaffolding (conftest + factories)

The copied `tests/factories.py` imports `apps.assessments` (deleted) and `tests/conftest.py` defines medic fixtures. Fix both so the suite can import.

**Files:**
- Modify: `backend/tests/factories.py` (drop `apps.assessments` import + `QuestionFactory`)
- Modify: `backend/tests/conftest.py` (drop `medic_user` + `medic_client` fixtures)
- Test: `backend/tests/test_scaffolding.py`

**Interfaces:**
- Consumes: `apps.accounts.models.{Roles, User}`, `apps.employees.models.{Employee, Specialty}`, `apps.integrations.mocks.MockFaceRecognitionService`.
- Produces: fixtures `api_client`, `admin_user`, `specialist_user`, `admin_client`, `specialist_client`, `face_image`, `face_image_fail`, `photo_without_face`; factories `UserFactory`, `SpecialtyFactory`, `EmployeeFactory`. NO medic fixtures, NO `QuestionFactory`.

- [ ] **Step 1: Write the failing test** at `backend/tests/test_scaffolding.py`:
```python
import pytest

from apps.accounts.models import Roles

from . import factories

pytestmark = pytest.mark.django_db


def test_factories_have_no_assessments():
    assert not hasattr(factories, "QuestionFactory")
    assert hasattr(factories, "EmployeeFactory")


def test_employee_factory_embedding_matches_face_image():
    emp = factories.EmployeeFactory()
    assert emp.face_embedding is not None and len(emp.face_embedding) == 16


def test_specialist_fixture_role(specialist_user):
    assert specialist_user.role == Roles.SPECIALIST
```
- [ ] **Step 2: Run it to verify it fails.**
```bash
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center/backend && .venv/bin/python -m pytest tests/test_scaffolding.py -q
```
Expected: collection ERROR (`No module named 'apps.assessments'` from `factories.py`).
- [ ] **Step 3: Implement.** Set `backend/tests/factories.py` to exactly:
```python
import factory
from factory.django import DjangoModelFactory

from apps.accounts.models import Roles, User
from apps.employees.models import Employee, Specialty


class UserFactory(DjangoModelFactory):
    class Meta:
        model = User

    username = factory.Sequence(lambda n: f"user{n}")
    role = Roles.SPECIALIST
    password = factory.django.Password("password123")


class SpecialtyFactory(DjangoModelFactory):
    class Meta:
        model = Specialty

    name = factory.Sequence(lambda n: f"Specialty {n}")


def _canonical_face_embedding():
    """Embedding of the canonical test photo (the `face_image` fixture's bytes).

    The mock matches by embedding identity, so a factory employee's stored embedding must
    equal the embedding of that same photo for the Face ID happy-path tests to match — and
    so enrolling that same photo onto another employee is correctly seen as a duplicate.
    """
    from apps.integrations.mocks import MockFaceRecognitionService

    from .conftest import png_bytes

    return MockFaceRecognitionService().extract_embedding(png_bytes())


class EmployeeFactory(DjangoModelFactory):
    class Meta:
        model = Employee

    full_name = factory.Sequence(lambda n: f"Employee Test {n}")
    specialty = factory.SubFactory(SpecialtyFactory)
    photo = factory.django.ImageField(filename="face.png")
    face_embedding = factory.LazyFunction(_canonical_face_embedding)
    is_active = True
```
In `backend/tests/conftest.py`, delete the `medic_user` and `medic_client` fixtures (the two `@pytest.fixture` blocks referencing `medic`). Everything else stays.
- [ ] **Step 4: Run test to verify it passes.**
```bash
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center/backend && .venv/bin/python -m pytest tests/test_scaffolding.py -q
```
Expected: `3 passed`.
- [ ] **Step 5: Commit.**
```bash
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center && git add -A && git commit -m "tests: port scaffolding (drop assessments factory + medic fixtures)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Port the employees + import pytest tests (drop medic assertions)

The copied `tests/test_employees.py` uses a `medic_client` fixture (removed in Task 10). Fix it. `tests/test_import_employees.py` is already decor-clean and passes verbatim — just confirm.

**Files:**
- Modify: `backend/tests/test_employees.py` (drop `medic_client` from the specialties test)
- Verify (no edit): `backend/tests/test_import_employees.py`

**Interfaces:**
- Consumes: Task 10 fixtures + Task 7 employees changes.
- Produces: green `test_employees.py` and `test_import_employees.py`.

- [ ] **Step 1: Write the failing state** — run the copied employees test; it errors on the missing `medic_client` fixture:
```bash
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center/backend && .venv/bin/python -m pytest tests/test_employees.py -q
```
Expected: `test_specialties_readable_by_all_roles_writable_by_admin` ERRORS (fixture `medic_client` not found).
- [ ] **Step 2: Confirm the failure is exactly the medic fixture** (grep):
```bash
grep -n medic /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center/backend/tests/test_employees.py
```
Expected: line matches inside `test_specialties_readable_by_all_roles_writable_by_admin`.
- [ ] **Step 3: Implement.** Replace the `test_specialties_readable_by_all_roles_writable_by_admin` function in `backend/tests/test_employees.py` with (admin + specialist only):
```python
def test_specialties_readable_by_all_roles_writable_by_admin(admin_client, specialist_client):
    assert admin_client.post(SPECIALTIES_URL, {"name": "New specialty"}).status_code == 201
    assert specialist_client.get(SPECIALTIES_URL).status_code == 200
    assert specialist_client.post(SPECIALTIES_URL, {"name": "Nope"}).status_code == 403
```
- [ ] **Step 4: Run tests to verify they pass.**
```bash
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center/backend && .venv/bin/python -m pytest tests/test_employees.py tests/test_import_employees.py -q
```
Expected: all pass (5 in test_employees, 3 in test_import_employees).
- [ ] **Step 5: Commit.**
```bash
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center && git add -A && git commit -m "tests: port employees + import suites (admin/specialist RBAC, no medic)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Verify the ported face/integrations pytest suite is green

These copied test files are decor-clean after Task 3's rename and depend only on the preserved face pipeline + Task 10 scaffolding. This task confirms them green as a batch (no code edits expected).

**Files:**
- Verify (no edit): `backend/tests/test_face_enrollment.py`, `test_face_enrollment_service.py`, `test_face_enrollment_api.py`, `test_face_detect.py`, `test_anti_spoofing.py`, `test_face_warmup.py`, `test_reindex_faces.py`

**Interfaces:**
- Consumes: Task 4 (`settings.DECOR`), Task 6 (face pipeline), Task 7 (`face_enrollment.py`), Task 10 scaffolding.
- Produces: green face/integrations suite. `test_face_enrollment_service.py` asserts `settings.DECOR` face knobs (all defaults) and `REVERIFY_ON_SUBMIT == "off"`.

- [ ] **Step 1: Establish the failing/passing baseline** — run the batch:
```bash
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center/backend && \
.venv/bin/python -m pytest tests/test_face_enrollment.py tests/test_face_enrollment_service.py tests/test_face_enrollment_api.py tests/test_face_detect.py tests/test_anti_spoofing.py tests/test_face_warmup.py tests/test_reindex_faces.py -q
```
- [ ] **Step 2: If any test references a stale token, confirm via grep** (must be empty):
```bash
grep -rn -e 'DEPO' -e 'settings.DEPO' /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center/backend/tests | grep -v '/.venv/' || echo "CLEAN"
```
Expected: `CLEAN`.
- [ ] **Step 3: Fix only what fails.** If `test_face_enrollment_service.py::test_face_enrollment_settings_present` fails because it still reads `settings.DEPO`, confirm Task 3 renamed it to `settings.DECOR` (it should read `decor = settings.DECOR`). No other edits should be needed; if a real failure appears, apply the systematic-debugging skill before changing production code.
- [ ] **Step 4: Re-run the batch to verify all pass.**
```bash
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center/backend && \
.venv/bin/python -m pytest tests/test_face_enrollment.py tests/test_face_enrollment_service.py tests/test_face_enrollment_api.py tests/test_face_detect.py tests/test_anti_spoofing.py tests/test_face_warmup.py tests/test_reindex_faces.py -q
```
Expected: all pass, 0 failures.
- [ ] **Step 5: Commit** (only if any file changed; otherwise skip commit):
```bash
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center && git add -A && git commit -m "tests: confirm face/integrations suite green under decor tokens

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" || echo "nothing to commit"
```

---

### Task 13: Port test_auth to admin+specialist roles (drop medic + medical permissions)

The copied `tests/test_auth.py` logs in as `medic` and asserts `medical:write` — both gone. Rewrite against the decor catalog.

**Files:**
- Modify: `backend/tests/test_auth.py`

**Interfaces:**
- Consumes: `apps.accounts` login/me endpoints + Task 5 permission catalog + Task 10 fixtures.
- Produces: green auth suite proving admin has `tests:write`/`employees:write`, specialist has `survey:submit` and lacks `tests:write`.

- [ ] **Step 1: Write the failing test** — set `backend/tests/test_auth.py` to:
```python
import pytest

from .factories import UserFactory

pytestmark = pytest.mark.django_db

LOGIN_URL = "/api/v1/auth/login/"
REFRESH_URL = "/api/v1/auth/refresh/"
LOGOUT_URL = "/api/v1/auth/logout/"
ME_URL = "/api/v1/auth/me/"


def test_login_returns_tokens_role_and_permissions(api_client):
    UserFactory(username="spec1", role="specialist")
    response = api_client.post(LOGIN_URL, {"username": "spec1", "password": "password123"})
    assert response.status_code == 200
    assert "access" in response.data
    assert "refresh" in response.data
    assert response.data["user"]["role"] == "specialist"
    assert "survey:submit" in response.data["user"]["permissions"]
    assert "tests:write" not in response.data["user"]["permissions"]


def test_login_wrong_password_rejected(api_client):
    UserFactory(username="spec1", role="specialist")
    response = api_client.post(LOGIN_URL, {"username": "spec1", "password": "wrong"})
    assert response.status_code == 401


def test_refresh_token_flow(api_client):
    UserFactory(username="admin1", role="admin")
    login = api_client.post(LOGIN_URL, {"username": "admin1", "password": "password123"})
    response = api_client.post(REFRESH_URL, {"refresh": login.data["refresh"]})
    assert response.status_code == 200
    assert "access" in response.data


def test_me_returns_current_user(admin_client, admin_user):
    response = admin_client.get(ME_URL)
    assert response.status_code == 200
    assert response.data["username"] == admin_user.username
    assert response.data["role"] == "admin"
    assert "employees:write" in response.data["permissions"]
    assert "tests:write" in response.data["permissions"]


def test_logout_blacklists_refresh_token(api_client):
    UserFactory(username="admin1", role="admin")
    login = api_client.post(LOGIN_URL, {"username": "admin1", "password": "password123"})
    refresh = login.data["refresh"]
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
    assert api_client.post(LOGOUT_URL, {"refresh": refresh}).status_code == 200
    assert api_client.post(REFRESH_URL, {"refresh": refresh}).status_code == 401


def test_me_requires_authentication(api_client):
    assert api_client.get(ME_URL).status_code == 401
```
- [ ] **Step 2: Run it to verify it fails** (against the copied file first — the copied version logs in as medic and would already differ). Run:
```bash
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center/backend && .venv/bin/python -m pytest tests/test_auth.py -q
```
Expected before writing the new file: failures on `medic`/`medical:write`. After writing the new file, Step 4 confirms green.
- [ ] **Step 3: (Implementation is the rewrite in Step 1.)** Ensure the file is saved exactly as above.
- [ ] **Step 4: Run test to verify it passes.**
```bash
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center/backend && .venv/bin/python -m pytest tests/test_auth.py -q
```
Expected: `6 passed`.
- [ ] **Step 5: Commit.**
```bash
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center && git add -A && git commit -m "tests: port auth suite to admin/specialist catalog (survey:submit, tests:write)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 14: Full suite green + ruff clean + `manage.py check`

Run the entire backend gate as one deliverable.

**Files:**
- Modify (only if lint/check surfaces issues): any backend file flagged by ruff or `manage.py check`.

**Interfaces:**
- Consumes: everything above.
- Produces: `pytest` all-green, `ruff check .` clean, `manage.py check` clean.

- [ ] **Step 1: Run the full gate (this is the failing check if anything regressed).**
```bash
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center/backend && \
.venv/bin/ruff check . && \
DJANGO_SETTINGS_MODULE=config.settings.dev .venv/bin/python manage.py check && \
.venv/bin/python -m pytest -q
```
- [ ] **Step 2: Verify expected output.** Expected: ruff `All checks passed!`; `System check identified no issues (0 silenced).`; pytest reports all tests passed (settings-smoke, roles, integrations, employee-new-fields, api-routes, seed, scaffolding, employees, import, face batch ×7, auth, health).
- [ ] **Step 3: Fix any residue.** Common issues: an unused import left after deleting the test-generator (ruff `F401`) — remove it; a lingering `apps.assessments`/`medic` reference — grep and delete:
```bash
grep -rn -e 'assessments' -e 'medic' -e 'instructions' -e 'medical' /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center/backend --include='*.py' | grep -v '/.venv/' || echo "CLEAN"
```
Apply `.venv/bin/ruff check --fix .` for autofixable lint, then re-run.
- [ ] **Step 4: Re-run the full gate to verify all green** (same command as Step 1). Expected: ruff clean, check clean, pytest all pass.
- [ ] **Step 5: Commit.**
```bash
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center && git add -A && git commit -m "Backend gate green: full pytest suite passes, ruff clean, manage.py check clean

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 15: Docker stack up — migrate + seed on a running backend

Prove the container boot path: rewrite the dev compose backend command (no `seed_demo_data`), rewrite `backend/.env.example`, create `backend/.env`, and bring up db+backend.

**Files:**
- Modify: `docker-compose.yml` (drop the `seed_demo_data` line from the backend command; drop the TTS comment)
- Modify: `backend/.env.example` (final DECOR-only keys)
- Modify: `Makefile` (drop the `seed-demo` target + the TTS wording in `seed`/`seed-demo`)
- Create: `backend/.env` (from the new example)

**Interfaces:**
- Consumes: everything above.
- Produces: `docker compose up db backend` runs `migrate` + `seed_initial_data` + `runserver`, and `GET /health/` returns `{"status":"ok"}`.

- [ ] **Step 1: Write the failing check** — the dev compose still runs `seed_demo_data` (deleted command), which would crash the container:
```bash
grep -n 'seed_demo_data' /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center/docker-compose.yml
```
Expected: one match (the failing state).
- [ ] **Step 2: Confirm the crash surface** — the referenced command no longer exists:
```bash
test -f /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center/backend/apps/core/management/commands/seed_demo_data.py && echo PRESENT || echo GONE
```
Expected: `GONE`.
- [ ] **Step 3: Implement.** In `docker-compose.yml`, set the backend `command` block to:
```yaml
    command: >
      sh -c "python manage.py migrate &&
             python manage.py seed_initial_data &&
             python manage.py runserver 0.0.0.0:8000"
```
and delete the TTS comment line above `env_file` (`# UzbekVoice TTS ...`). Set `backend/.env.example` to exactly:
```bash
# Django
DJANGO_SECRET_KEY=change-me-in-production
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1

# Database
DATABASE_URL=postgres://localhost:5432/decor

# JWT
JWT_ACCESS_MINUTES=30
JWT_REFRESH_HOURS=12

# Face match threshold. With the real InsightFace backend this is the MIN cosine similarity
# (higher = stricter; ~0.5 forgiving, ~0.6 strict). Unused by the mock backend.
DECOR_FACE_SIMILARITY_THRESHOLD=0.6

# Integration backends (dotted paths; mocks by default).
# Enable real ArcFace recognition: DECOR_FACE_BACKEND=apps.integrations.insightface_adapter.InsightFaceAdapter
DECOR_FACE_BACKEND=apps.integrations.mocks.MockFaceRecognitionService
DECOR_FACE_INSIGHTFACE_MODEL=buffalo_sc
DECOR_FACE_DET_SIZE=640

# Multi-photo face enrollment (all optional; sensible defaults in settings)
DECOR_FACE_MAX_PHOTOS=5
DECOR_FACE_MIN_FACE_PIXELS=80
DECOR_FACE_BLUR_MIN_VARIANCE=0
DECOR_ANTI_SPOOFING_BACKEND=apps.integrations.mocks.MockAntiSpoofingService
DECOR_ANTI_SPOOFING_ENABLED=False
DECOR_ANTI_SPOOFING_THRESHOLD=0.5
DECOR_FACE_WARMUP_ON_STARTUP=False

# Submit-time face re-verification (opinion surveys default OFF): off | log | block.
DECOR_REVERIFY_ON_SUBMIT=off

# Seed accounts (used by `manage.py seed_initial_data`)
DECOR_ADMIN_PASSWORD=admin12345!
DECOR_SPECIALIST_PASSWORD=specialist12345!
```
In `Makefile`, delete the `seed-demo` target block (the `.PHONY: seed-demo` + `seed-demo:` recipe) and change the `seed` target help text to `## Seed specialties + admin/specialist accounts`. Create the dev env file:
```bash
cp /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center/backend/.env.example /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center/backend/.env
```
- [ ] **Step 4: Bring up db+backend and verify health + seeded users.**
```bash
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center && \
docker compose up -d --build db backend && \
sleep 20 && \
curl -fsS http://localhost:8000/health/ && echo && \
docker compose exec -T backend python manage.py shell -c "from apps.accounts.models import User; print(sorted(User.objects.values_list('username', flat=True)))"
```
Expected: `{"status": "ok"}` and `['admin', 'specialist']`. Also confirm no `seed_demo_data` reference remains:
```bash
grep -c seed_demo_data /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center/docker-compose.yml /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center/Makefile || echo "CLEAN"
```
Then tear down:
```bash
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center && docker compose down
```
- [ ] **Step 5: Commit.**
```bash
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center && git add -A && git commit -m "docker/dev: boot backend with migrate + seed_initial_data (no demo seed); DECOR-only env

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Final acceptance (run once, after Task 15)

```bash
# 1) No stale tokens anywhere under backend (excluding venv) or root infra
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center && \
grep -rIn -e 'depo' -e 'DEPO' -e 'Depo' . \
  --exclude-dir=.git --exclude-dir=.venv --exclude-dir=node_modules --exclude-dir=build \
  --exclude-dir=__pycache__ --exclude-dir=.pytest_cache --exclude-dir=.ruff_cache --exclude-dir=docs \
  && echo "DIRTY — investigate" || echo "TOKENS CLEAN"

# 2) No references to dropped apps
grep -rn -e 'assessments' -e 'instructions' -e 'medical' -e 'medic' \
  /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center/backend --include='*.py' \
  | grep -v '/.venv/' && echo "DIRTY" || echo "APPS CLEAN"

# 3) Backend gate
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center/backend && \
.venv/bin/ruff check . && \
DJANGO_SETTINGS_MODULE=config.settings.dev .venv/bin/python manage.py check && \
.venv/bin/python -m pytest -q
```
Expected: `TOKENS CLEAN`, `APPS CLEAN`, ruff `All checks passed!`, check `no issues`, pytest all-green.
