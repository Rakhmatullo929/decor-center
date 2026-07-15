# Employee self-registration via one-time invite link

Date: 2026-07-15
Route: `/employees` (frontend, admin), new public route `register/:token` (frontend),
new `EmployeeInviteViewSet` (backend)

## Goal

On the Employees admin page (`/employees`), add an **"Пригласить сотрудника"** (Invite employee)
button. It generates a **one-time link** through which the invited person self-registers on the
public (Face-Detector / kiosk) side of the app.

- Self-registered employees are created **inactive** (`is_active=False`).
- An admin **activates** them from the frontend (existing Inactive tab + "Активировать" action).
- `hire_date` (дата найма) is stamped **at activation time**, not at registration.

## Decisions (confirmed with user)

- **One-time link**: 1 link = 1 employee. After a successful registration the link is **consumed**
  (`is_used=True`) and no longer works. A generous fixed **7-day expiry** is also kept as a safety
  net for links that are never used (configurable via a `DECOR` setting; **no** expiry selector in
  the dialog).
- **Admin pre-assigns the specialty** when generating the link. The link is pre-scoped to one
  `Specialty`; the employee cannot change it.
- Employee self-enters: **full_name, phone, work_experience (prior experience)**, and a **face
  photo**. `hire_date` is left null at registration.
- **Face capture: both** live camera (primary, selfie-style like the kiosk) **and** file upload
  fallback.
- **Inactive tab shows a "ожидает активации" chip** for self-registered employees (those with
  `hire_date IS NULL`) so admins can tell new sign-ups apart from deactivated staff.

## Key constraints discovered

- **Inactive employees are already locked out of the kiosk everywhere.** Every kiosk lookup filters
  `is_active=True` (`identify`, `employees_lookup`, OTP request/verify, due/in-progress in
  `apps/surveys/views.py`). So a self-registered inactive employee automatically cannot be
  identified, cannot receive OTP, and cannot log in until an admin flips `is_active`. **No new
  gating is required** on the survey side.
- **Admin activation already works**: `PATCH /api/v1/employees/{id}/ {"is_active": true}`
  (`is_active` is a writable field on `EmployeeSerializer`, admin-only via `IsAdminOrReadOnly`).
  We only need to make it stamp `hire_date`.
- **No invite/signup/one-time-token infrastructure exists yet.** The closest existing pattern is
  `OtpChallenge` (`apps/surveys/models.py:221-239`): a stored, hashed, single-use, expiring secret
  with `is_used` + `expires_at` + `is_expired()`. The new invite model mirrors it.
- **Employee creation already seeds the face embedding from one photo.**
  `EmployeeSerializer.create` → `_seed_display_photo` → `add_face_photo` computes
  `Employee.face_embedding` from the display photo in one transaction
  (`apps/employees/serializers.py:59-82`). The register endpoint reuses this exact path.
- Public endpoints are opt-in per-action via `get_permissions` returning `AllowAny`, and are rate
  limited with `ScopedRateThrottle` (kiosk pattern in `apps/surveys/views.py:269-283`).
- Frontend: React 18 + MUI + React Query with custom `useFetchList`/`useMutate` wrappers; axios
  wrapper auto-converts camelCase↔snake_case and skips auth when `isPublic`/`skipAuth`
  (`src/lib/api/request.ts`, `http-client.ts`). Public routes live outside `AuthGuard` in
  `routes/sections/public.tsx`. Camera capture util already exists (`src/utils/camera.ts`
  `captureFrame`), used by `survey-kiosk/components/face-id-step.tsx`.

## Backend design (`backend/apps/employees/`)

### `models.py` — new `EmployeeInvite`

Mirrors `OtpChallenge` (hashed secret, single-use, expiring):

```
class EmployeeInvite(TimeStampedModel):
    token_hash  = CharField(max_length=64, unique=True, db_index=True)  # sha256(raw token)
    specialty   = FK(Specialty, on_delete=PROTECT, related_name="invites")
    expires_at  = DateTimeField()
    is_used     = BooleanField(default=False)
    used_at     = DateTimeField(null=True, blank=True)
    created_by  = FK(AUTH_USER_MODEL, on_delete=SET_NULL, null=True, blank=True,
                     related_name="employee_invites")
    employee    = FK(Employee, on_delete=SET_NULL, null=True, blank=True,
                     related_name="invites")         # the resulting registration (usable reverse accessor)

    def is_expired(self) -> bool:   # timezone.now() >= expires_at
    def is_valid(self)   -> bool:   # not is_used and not is_expired()
```

- The **raw token is never stored** — only its sha256 lives in the DB (like `OtpChallenge.code_hash`).
  Raw token exists only in the URL handed to the invited person.
- New migration `0004_employeeinvite.py`.

### `services.py` — token helpers

```
INVITE_TTL_DAYS = settings.DECOR["EMPLOYEE_INVITE_TTL_DAYS"]  # default 7

hash_invite_token(raw: str) -> str            # sha256 hexdigest
create_employee_invite(specialty, created_by) -> tuple[EmployeeInvite, str]
    # generates get_random_string(48) URL-safe, stores hash, returns (invite, raw_token)
find_valid_invite(raw_token: str) -> EmployeeInvite | None
    # lookup by token_hash; returns the row only if is_valid()
```

### `serializers.py` — new serializers

- `EmployeeInviteCreateSerializer` — input `{specialty}` (PK of an **active** specialty), output
  `{token, expires_at}`. Admin-facing.
- `EmployeeInviteValidateSerializer` (output only) — `{valid: bool, specialty_name, reason}` where
  `reason ∈ {ok, not_found, used, expired}`.
- `EmployeeInviteRegisterSerializer` — input `{token, full_name, phone, work_experience, photo}`.
  - `work_experience`: required (form-enforced), `PositiveIntegerField`.
  - `phone`: same E.164 `RegexField` as `EmployeeSerializer`.
  - On `save()`: validate token via `find_valid_invite`; build an `EmployeeSerializer` with
    `{full_name, phone, work_experience, photo, specialty: invite.specialty_id, is_active: False}`
    and `hire_date` left null; call its `create()` to reuse the face-seeding path; then mark the
    invite used (`is_used=True`, `used_at=now`, `employee=<new>`) inside one `transaction.atomic()`.
  - **Anonymous-user caveat:** the face-enrollment path records `created_by`. On the public register
    call `request.user` is `AnonymousUser`; the register serializer must pass `user=None` for face
    photo `created_by` (guard `_current_user`/pass an explicit context flag) so the FK assignment
    doesn't fail.

### `views.py` — new `EmployeeInviteViewSet`

A `viewsets.GenericViewSet` registered as `employee-invites`, per-action permissions like the kiosk:

```
create   POST /api/v1/employee-invites/                 IsAdmin        -> {token, expires_at}
validate GET  /api/v1/employee-invites/validate/?token= AllowAny+throttle -> {valid, specialty_name, reason}
register POST /api/v1/employee-invites/register/        AllowAny+throttle -> 201 {status: "pending"}
```

- `get_permissions`: `create` → `IsAdmin`; `validate`/`register` → `AllowAny`.
- `get_throttles`: `ScopedRateThrottle` scopes `invite_validate`, `invite_register` (new rates in
  `DECOR`/DRF throttle settings, mirroring `kiosk_*`).
- `create` sets `created_by=request.user`; frontend composes the full URL from `window.location.origin`.
- `register` returns a minimal success (no JWT — the employee is inactive and must not be logged in).

### `serializers.py` (Employee) — expose `is_self_registered` (for the pending chip)

Add a read-only boolean `is_self_registered` to `EmployeeSerializer`, backed by a queryset
annotation on `EmployeeViewSet.queryset`:
`.annotate(is_self_registered=Exists(EmployeeInvite.objects.filter(employee=OuterRef("pk"))))`.
This is the precise signal for "self-registered via invite" (vs. admin-created) so the frontend chip
never false-positives on an admin-created inactive employee that happens to have no `hire_date`.

### `serializers.py` (Employee) — activation stamps `hire_date`

In `EmployeeSerializer.update`: when `is_active` transitions **`False → True`** and
`instance.hire_date is None`, set `hire_date = timezone.localdate()` before saving. This makes the
existing admin activation (`PATCH … {is_active: true}`) stamp the hire date automatically — the
confirmed rule — with **no new endpoint**. (Only fills when currently null, so admin-set hire dates
and re-activations are never overwritten.)

### `config/api_v1.py`

`router.register("employee-invites", EmployeeInviteViewSet, basename="employee-invite")`.

### `config/settings/base.py`

Add to `DECOR`: `EMPLOYEE_INVITE_TTL_DAYS = 7`. Add throttle scopes `invite_validate`,
`invite_register` to `DEFAULT_THROTTLE_RATES` (mirror kiosk rates).

## Frontend design

### Invite button + dialog (`sections/app/employees/`)

- `view.tsx`: add an **"Пригласить сотрудника"** button in the `CustomBreadcrumbs` action area next
  to the existing "Create" button, gated by the existing `canWrite`
  (`useCheckPermission().canWritePage('employees')`). Opens the invite dialog via a `useBoolean()`.
- New `components/invite-employee-dialog.tsx` (MUI `Dialog`):
  1. **Specialty** select (reuse the specialties query already used by the upsert dialog).
  2. "Создать ссылку" → `POST employee-invites/` → on success, switch the dialog to a **result view**
     showing the composed URL (`${window.location.origin}/register/${token}`) in a read-only field
     with a **copy button** (`useCopyToClipboard`) and an expiry note (`expires_at`).
- `api/employee-invites-requests.ts` + `api/use-employee-invites-api.ts`: `createInvite(specialty)`
  mutation (mirrors `employees-requests.ts` / `use-employees-api.ts`).
- `lib/api/endpoints.ts`: add an `employeeInvites` block (`create`, `validate`, `register`).

### Inactive-tab "ожидает активации" chip

- `components/employee-table-row.tsx`: render a small `Label`/chip "ожидает активации" next to the
  status when `is_self_registered && hire_date == null` — i.e. a self-registered employee that has
  never been activated. (Activation stamps `hire_date`, so the chip disappears after activation and
  won't reappear if the employee is later deactivated. Admin-created employees are never
  `is_self_registered`, so they never show it.)

### Public self-registration page (`routes/sections/public.tsx`)

- New path constant `paths.register = '/register/:token'` (public, top-level in `paths.ts`).
- Route added to `publicRoutes` **outside `AuthGuard`** (wrapped in `KioskLayout` for consistency).
- Thin page `src/pages/public/register.tsx` → `sections/app/employee-register/register-view.tsx`.
- `register-view.tsx` flow:
  1. On mount: `GET employee-invites/validate/?token=` (public, `request(..., true)`). While loading →
     spinner. `valid=false` → error state keyed by `reason` (used / expired / not_found).
  2. `valid=true` → form with the pre-assigned **specialty shown read-only**, and fields
     **ФИО, телефон (E.164), стаж**, plus a **face capture** widget:
     - Primary: live camera via `utils/camera.ts` `captureFrame` (reuse the `face-id-step.tsx`
       getUserMedia pattern) with a retake button.
     - Fallback: file upload (reuse `RHFUploadAvatar`/file input) if camera is unavailable or the
       user prefers it.
  3. Submit → `POST employee-invites/register/` as **multipart/form-data**
     (`token, full_name, phone, work_experience, photo`) via public `request(..., true)`.
  4. Success → screen "Регистрация отправлена. Ожидайте активации администратором." **No auto-login,
     no token stored.** Errors (e.g., token consumed between validate and submit) → friendly message.
- All labels via `tx()`; add strings to `locales/langs/{ru,uz}/` (new `employee-register.json` +
  `employees.json` invite keys).

## Tests

- **Backend** (`tests/test_employee_invites.py` new, plus `tests/test_employees.py`):
  - `create` invite: admin → 201 with token+expiry; non-admin → 403; token stored **hashed** (raw
    not in DB).
  - `validate`: valid token → `{valid:true, specialty_name}`; unknown/expired/used → correct `reason`.
  - `register`: valid token → creates `Employee(is_active=False, hire_date=None,
    specialty=invite.specialty)`, seeds `face_embedding`, marks invite used, links `employee`;
    second use of same token → 400/consumed; expired token → rejected; missing photo → 400.
  - Public register performs **no login** and is unauthenticated (AllowAny).
  - Activation stamps hire_date: `PATCH {is_active:true}` on an employee with `hire_date=None` sets
    `hire_date=today`; a re-activation of an employee that already has a hire_date leaves it unchanged.
  - Inactive self-registered employee is **not** identifiable / cannot request OTP (existing filters).
  - `EmployeeSerializer` returns `is_self_registered=true` for an invite-created employee and
    `false` for an admin-created one.
- **Frontend**:
  - `invite-employee-dialog.test.tsx`: create → shows URL + copy.
  - `employee-invites-requests.test.ts`: create/validate/register hit the right URLs; register uses
    multipart + public (no auth header).
  - `register-view.test.tsx`: invalid token → error state; valid → form → submit → success screen.
  - `employee-table-row.test.tsx`: pending chip shows only when `is_self_registered && !hire_date`.

## Non-goals

- Admin list/table of pending invites or manual revoke UI (model supports it; UI is future work).
- Editing the pre-assigned specialty from the registration page.
- Emailing/SMSing the link automatically (admin copies and shares it manually).
- Phone/name uniqueness enforcement (not enforced today; out of scope).
- Bulk invites. Physical media GC. Creating the login `User` at registration (provisioned lazily on
  first kiosk OTP login, as today).
