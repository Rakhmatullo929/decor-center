# Employees page: delete, deactivate rename, Active/Inactive tabs

Date: 2026-07-15
Route: `/employees` (frontend), `EmployeeViewSet` (backend)

## Goal

On the Employees admin page (`/employees`):

1. Add a **hard delete** action for an employee.
2. Rename the existing **"archive"** action to **"deactivate"** (behaviour unchanged — it toggles `is_active`).
3. Split the list into two **tabs — Active / Inactive** — with the selected tab stored in URL
   search params so it survives a page refresh.
4. Backend filtering by active/inactive: **already exists** (`filterset_fields = ["is_active"]`),
   so no new filter is added — this design only wires the frontend to it.

## Key constraints discovered

- `Employee.is_active` (BooleanField) is the only active/inactive concept. "Archive" today is
  just `PATCH /employees/{id}/ {is_active: false}` — there is no separate archive entity.
- `EmployeeViewSet` is a DRF `ModelViewSet`, so `DELETE /employees/{id}/` already routes, but it
  has **no `perform_destroy` guard**. Three models reference `Employee` with
  `on_delete=PROTECT` — `SurveySession`, `FaceVerificationLog`, `OtpChallenge` (surveys app) —
  so deleting an employee who has any survey history currently raises `ProtectedError` → HTTP 500.
- Frontend: React 18 + MUI + React Query (custom `useFetchList`/`useMutate` wrappers). URL state
  via `useUrlQueryState` (`src/hooks/use-url-query-state.ts`). `useFetchList` already returns a
  `deleteItem(id)` cache updater. The `is_active` URL param already exists in the employees
  filter schema.

## Decisions (confirmed with user)

- **Delete = cascade**: hard-delete the employee **and all their survey history** (sessions +
  answers, Face-ID logs, OTP challenges). Irreversible. Admin-only.
- **Default tab = Active**: landing on `/employees` with no param shows Active employees.

### Design-choice defaults (called out, may be revised)

- Reuse the existing `is_active` URL param for the tabs (values `'true'`/`'false'`), rather than a
  new `status` param — least churn, already wired end-to-end.
- Change the shared `common.status.inactive` label from "Архив" → "Неактивен" (ru) / "Nofaol"
  (uz). This also updates the status chip on the Specialties page (deemed more accurate).

## Backend design (`backend/apps/employees/`)

### `services.py` — new function

```
delete_employee_with_related(employee) -> None   # @transaction.atomic
```

Deletes protected reverse relations first, then the employee, using reverse accessors so the
employees app does **not** import surveys models (keeps app-dependency direction correct):

- `employee.survey_sessions.all().delete()` — cascades to `Answer` (CASCADE), nulls
  `FaceVerificationLog.session` (SET_NULL).
- `employee.survey_face_logs.all().delete()`
- `employee.otp_challenges.all().delete()`
- `employee.delete()` — cascades `EmployeeFacePhoto` (CASCADE).

### `views.py` — `EmployeeViewSet.perform_destroy`

Calls `delete_employee_with_related(instance)`; wraps a `ProtectedError` safety net into a
`ValidationError` (HTTP 400) with a clear message, mirroring `SpecialtyViewSet`.

### Out of scope (noted)

- The employee's linked login `User` (OneToOne, SET_NULL) is left in place — harmless auth artifact.
- Physical media files (employee `photo`, face-photo files) are not removed from storage.

## Frontend design

### Tabs (`view.tsx`, `employees-table-toolbar.tsx`)

- MUI `Tabs`/`Tab` at the top of the `Card`: **Активные** (`is_active='true'`), **Неактивные**
  (`is_active='false'`).
- `FILTERS_SCHEMA.is_active` default `''` → `'true'` (Active-by-default; absent param parses to
  the default → clean URL; switching writes `?is_active=false`, resets `page=1`).
- Remove the "Статус" select from the toolbar (tabs replace it); keep search + specialty.
  Update toolbar props (`status`/`onStatus` removed) and `handleReset`.

### Rename archive → deactivate

- Locales (ru + uz): `actions.archive`→`actions.deactivate`, `dialogs.archive`→`dialogs.deactivate`,
  `toasts.archived`→`toasts.deactivated`; row icon `solar:archive-bold` → a block icon
  (`solar:forbidden-circle-bold`). Behaviour (PATCH `is_active=false`) and "Активировать" unchanged.
- `common.status.inactive`: "Архив" → "Неактивен" / "Nofaol".
- Rename in-view state/handlers `archiving`→`deactivating`, `handleConfirmArchive`→`handleConfirmDeactivate`.

### Delete action (new)

- `employees-requests.ts`: `deleteEmployee(id)` → `DELETE employees.detail(id)`.
- `use-employees-api.ts`: `useDeleteEmployeeMutation()` (default global error toast).
- Row popover: red **«Удалить»** item → `onDelete(row)`.
- View: `deleting` state + `ConfirmDialog` (strong warning about removing all survey history) →
  mutation → `employeesQuery.deleteItem(id)` + success toast. New locale keys
  `dialogs.delete.*` and `toasts.deleted`.

## Tests

- Frontend `employee-table-row.test.tsx`: deactivate label key; new delete action fires `onDelete`.
- Frontend `view.test.tsx`: deactivate rename; delete confirm→mutation→`deleteItem`; tab render +
  switch updates the query param. Add `useDeleteEmployeeMutation` to the module mock and
  `deleteItem` to the query mock.
- Frontend `employees-requests.test.ts`: `deleteEmployee` issues DELETE to the detail URL.
- Backend `test_employees.py`: admin deletes employee with survey sessions → 204 and all history
  gone; non-admin delete → 403; `?is_active=false` filter returns only inactive.

## Non-goals

- Bulk delete/deactivate. Tab counts/badges. Undo. Media-file GC. Deleting the linked `User`.
