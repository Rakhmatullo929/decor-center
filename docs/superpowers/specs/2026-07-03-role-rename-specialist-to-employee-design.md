# Rename role `specialist` → `employee`

**Date:** 2026-07-03
**Branch:** feat/decor-center-port

## Problem

The app carries a login role named `specialist` (labeled "Сотрудник" in the UI) plus a
dead `medic` role leftover from a prior ported application. This makes it look as if
"Специалист" and "Сотрудник" are two distinct things, when the intended model is just
two roles: **Администратор** and **Сотрудник**.

The backend already has exactly two roles (`admin`, `specialist`), so this is a naming
cleanup, not a structural change. We make the identifier match the concept everywhere:
`specialist` → `employee`, and drop the dead `medic` role.

## Non-goals

- The `Specialty` reference table (`apps/employees/models.py`) is **unchanged** — it is a
  profession lookup attached to each `Employee` via FK, not a role. Keep the
  `/specialties` page, nav item, seeders, and i18n as-is.
- Job-title strings in `frontend/src/_mock/assets.ts` ("Quality Assurance Specialist",
  "Social Media Specialist") are demo data, not roles — leave them.

## Target model

Two roles: `admin` (Administrator) and `employee` (Сотрудник). `medic` removed entirely.

## Backend changes

- `apps/accounts/models.py` — `Roles.SPECIALIST = "specialist", "Сотрудник"` →
  `Roles.EMPLOYEE = "employee", "Сотрудник"`; `User.role` default → `Roles.EMPLOYEE`;
  update docstring.
- `apps/accounts/permissions.py` — `IsSpecialist` → `IsEmployee`;
  `IsAdminOrSpecialist` → `IsAdminOrEmployee`; update `allowed_roles`.
- `apps/accounts/permission_catalog.py` — `Roles.SPECIALIST` key → `Roles.EMPLOYEE`;
  fix the "three fixed roles" comment to say two.
- `apps/surveys/views.py` — import and use `IsAdminOrEmployee`.
- `apps/core/management/commands/seed_initial_data.py` — kiosk account
  `username="specialist"` → `"employee"`; env var `DECOR_SPECIALIST_PASSWORD` →
  `DECOR_EMPLOYEE_PASSWORD` (keep the same fallback password behavior).
- **Migration** `apps/accounts/migrations/0002_*.py`:
  - `AlterField` on `role` with new `choices` + `default="employee"`.
  - Data migration: `User.objects.filter(role="specialist").update(role="employee")`
    (reversible: reverse maps `employee` → `specialist`).

## Frontend changes

- `src/auth/api/types.ts` — `UserRole = 'admin' | 'employee'` (drop `specialist`, `medic`).
- `src/layouts/dashboard/layout.tsx` — `isSpecialist` → `isEmployee`;
  `role === 'specialist'` → `role === 'employee'`.
- `src/hooks/use-app-user-profile.ts` — accept only `admin` / `employee`.
- `src/sections/app/survey-kiosk/components/employee-step.tsx` — badge
  `"SPECIALIST ACCESS"` → `"EMPLOYEE ACCESS"`; update the adjacent comment.
- `src/locales/langs/ru/common.json` & `.../uz/common.json` — replace the
  `specialist` / `medic` keys with a single `employee` key ("Сотрудник" / "Xodim").
  Update any references to the old keys.

## Tests

Rename fixtures and assertions from `specialist` to `employee`:

- `tests/conftest.py` — `specialist_user` → `employee_user`, `specialist_client` →
  `employee_client`.
- `tests/factories.py` — default `role = Roles.EMPLOYEE`.
- Assertions of role value `"specialist"` → `"employee"` and fixture renames in:
  `test_roles_and_permissions.py`, `test_seed_initial_data.py`, `test_auth.py`,
  `test_scaffolding.py`, `test_employees.py`, `test_surveys_api.py`,
  `test_face_enrollment_api.py`, `test_dashboard_surveys.py`.
- `test_roles_and_permissions.py` — `permissions_for_role("specialist")` →
  `permissions_for_role("employee")`; permission-class name list uses `IsEmployee`,
  `IsAdminOrEmployee`.
- `test_seed_initial_data.py` — expected usernames `{"admin", "employee"}`.

## Verification

- Backend: `pytest` green.
- Frontend: `tsc`, `eslint`, `vitest`, `build` all green.

## Behavioral note

The kiosk login username changes from `specialist` to `employee` (password fallback
unchanged). Anyone with the old `specialist` credentials logs in as `employee` after the
data migration renames the role; the username itself is reseeded idempotently.
