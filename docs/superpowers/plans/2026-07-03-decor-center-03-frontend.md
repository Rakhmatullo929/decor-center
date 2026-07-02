# Frontend — Admin Screens & Survey Kiosk Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the depo React/MUI frontend into decor-center — prune all scoring/TTS/medical/instructions UI, add the four admin survey CRUD screens plus employee `hire_date`/`work_experience` fields, and rebuild the kiosk flow (identify → due → start → answer single/multiple/textarea → submit → thank-you) wired to the Plan 2 `survey-sessions` API.

**Architecture:** React 18 + TypeScript + MUI dashboard shell (JWT + RBAC + i18n ru/uz) inherited 1:1 from depo. Data layer is TanStack Query wrapped by `src/hooks/api` (`useFetch`/`useFetchList`/`useMutate`) over an axios client (`src/lib/api/http-client.ts`) that camelCase↔snake_case-transforms JSON bodies but passes `FormData` untouched (so multipart face uploads use snake_case keys). Each feature lives under `src/sections/app/<feature>` with `api/{types,requests,use-*-api}` + `components` + `view.tsx`, surfaced by a thin `src/pages/app/*` Helmet wrapper and a route in `src/routes/sections/dashboard.tsx` guarded by `PermissionGuard`.

**Tech Stack:** react-scripts 5 (CRA) test runner = Jest + React Testing Library (`src/test-utils.tsx`), react-hook-form + yup, `@mui/x-date-pickers` v6 + `date-fns` v2 (available), framer-motion 10, three 0.184, humps 2, i18next.

## Global Constraints
- Django 5.2 + DRF backend (Plans 1–2); this plan is frontend-only.
- React 18 + TypeScript + MUI; reuse existing shell/theme/auth/layout verbatim.
- PostgreSQL 18 backend; irrelevant here except API shapes.
- All frontend commands run from `FRONT=/Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center/frontend` (repo produced by Plan 1 as a copy of depo).
- Reference source (copy/cite from): `REF=/Users/rakhmatulloazizov/Downloads/rakhmatullo/June-2026/depo/frontend`.
- Rename every `depo`/`DEPO_` token to `decor`/`DECOR_` (backend concern; the frontend only references `appName` i18n strings — leave `HOST_API` env-driven).
- No scoring anywhere: remove `score`/`passed`/`total`/`audioUrl`/TTS/`ModuleStep`/`ResultStep`/`SubmitFaceStep`-reverify-by-default. Surveys have no correct answers.
- i18n ru + uz only; add a `survey` namespace to both; drop `testing`/`results`/`instructions`/`medical` namespaces.
- Face backend is mocked in dev/CI (Plan 1) — the kiosk camera code is unchanged; `getUserMedia` works only on `localhost` or HTTPS.
- Commit after every task (each task ends green).
- Test command template (Jest, single file, non-watch):
  `(cd "$FRONT" && CI=true npx react-scripts test <relative-path> --watchAll=false)`
- Typecheck: `(cd "$FRONT" && npx tsc --noEmit)` · Lint: `(cd "$FRONT" && npm run lint)` · Build: `(cd "$FRONT" && npm run build)`.
- `export FRONT=/Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center/frontend` and `export REF=/Users/rakhmatulloazizov/Downloads/rakhmatullo/June-2026/depo/frontend` at the start of every shell session.

---

### Task 1: Prune obsolete depo frontend features

Removes every UI branch tied to a backend app Plan 1/2 dropped (medical, instructions, assessment scoring, old testing/results/questions), so nothing imports the soon-to-be-deleted endpoint groups. After this task the app will not typecheck/build (new screens arrive later); jest per-file tests still pass because Jest compiles only what a test imports.

**Files:**
- Delete (dirs): `src/sections/app/medical`, `src/sections/app/instructions`, `src/sections/app/results`, `src/sections/app/questions`, `src/sections/app/testing`, `src/sections/app/dashboard`
- Delete (pages): `src/pages/app/{medical,medical-create,medical-detail,medical-edit,instructions,results,result-detail,questions,testing,testing-questions,dashboard}.tsx`
- Delete (locales): `src/locales/langs/{ru,uz}/{testing,results,instructions,medical,questions,dashboard}.json`
- Modify: `src/locales/langs/ru/index.ts`, `src/locales/langs/uz/index.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a tree where `src/sections/app` contains only `employees`, `specialties` (survey-kiosk + admin/surveys arrive later); locale barrels export only `common`, `employees`, `specialties`, `profile`, `errors`.

- [ ] **Step 1: Write the failing test** — assert the locale barrel no longer references removed namespaces.
  Create `src/locales/langs/ru/__tests__/index.test.ts`:
  ```ts
  import translation from '../index';

  describe('ru locale barrel', () => {
    it('drops depo-only namespaces', () => {
      expect(translation).not.toHaveProperty('testing');
      expect(translation).not.toHaveProperty('results');
      expect(translation).not.toHaveProperty('instructions');
      expect(translation).not.toHaveProperty('medical');
      expect(translation).not.toHaveProperty('dashboard');
    });
    it('keeps the reused namespaces', () => {
      expect(translation).toHaveProperty('common');
      expect(translation).toHaveProperty('employees');
      expect(translation).toHaveProperty('specialties');
    });
  });
  ```
- [ ] **Step 2: Run test to verify it fails**
  `(cd "$FRONT" && CI=true npx react-scripts test src/locales/langs/ru/__tests__/index.test.ts --watchAll=false)`
  Expected: FAIL — `Received object has property "testing"` (barrel still imports it).
- [ ] **Step 3: Write minimal implementation**
  Delete the directories/pages/json listed above:
  ```bash
  cd "$FRONT/src"
  rm -rf sections/app/medical sections/app/instructions sections/app/results \
         sections/app/questions sections/app/testing sections/app/dashboard
  rm -f pages/app/medical.tsx pages/app/medical-create.tsx pages/app/medical-detail.tsx \
        pages/app/medical-edit.tsx pages/app/instructions.tsx pages/app/results.tsx \
        pages/app/result-detail.tsx pages/app/questions.tsx pages/app/testing.tsx \
        pages/app/testing-questions.tsx pages/app/dashboard.tsx
  rm -f locales/langs/ru/{testing,results,instructions,medical,questions,dashboard}.json
  rm -f locales/langs/uz/{testing,results,instructions,medical,questions,dashboard}.json
  ```
  Rewrite `src/locales/langs/ru/index.ts` AND `src/locales/langs/uz/index.ts` to the pruned barrel (identical for both langs):
  ```ts
  import common from './common.json';
  import employees from './employees.json';
  import specialties from './specialties.json';
  import profile from './profile.json';
  import errors from './errors.json';

  const translation = {
    common,
    employees,
    specialties,
    profile,
    errors,
  };

  export default translation;
  ```
- [ ] **Step 4: Run test to verify it passes**
  `(cd "$FRONT" && CI=true npx react-scripts test src/locales/langs/ru/__tests__/index.test.ts --watchAll=false)`
  Expected: PASS (2 tests).
- [ ] **Step 5: Commit**
  ```bash
  cd "$FRONT" && git add -A && git commit -m "prune: remove depo-only frontend features (medical/instructions/scoring/testing)"
  ```

---

### Task 2: `endpoints.ts` — surveys group + drop stale groups

**Files:**
- Modify: `src/lib/api/endpoints.ts` (full rewrite of the object)
- Test: `src/lib/api/__tests__/endpoints.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `API_ENDPOINTS.surveys.{ tests, test(id), questionBlocks, questionBlock(id), questions, question(id), sessions, session(id), identify, due, start, submit(id), adminFill, results, export }` and `API_ENDPOINTS.employees.{ list, detail, facePhotos, facePhoto }` (kept). Later tasks import these exact keys.

- [ ] **Step 1: Write the failing test**
  Create `src/lib/api/__tests__/endpoints.test.ts`:
  ```ts
  import { API_ENDPOINTS } from '../endpoints';

  describe('API_ENDPOINTS.surveys', () => {
    const s = API_ENDPOINTS.surveys;
    it('exposes admin CRUD collections', () => {
      expect(s.tests).toBe('/api/v1/tests/');
      expect(s.test(7)).toBe('/api/v1/tests/7/');
      expect(s.questionBlocks).toBe('/api/v1/question-blocks/');
      expect(s.questionBlock(3)).toBe('/api/v1/question-blocks/3/');
      expect(s.questions).toBe('/api/v1/questions/');
      expect(s.question(9)).toBe('/api/v1/questions/9/');
    });
    it('exposes survey-session actions', () => {
      expect(s.identify).toBe('/api/v1/survey-sessions/identify/');
      expect(s.due).toBe('/api/v1/survey-sessions/due/');
      expect(s.start).toBe('/api/v1/survey-sessions/start/');
      expect(s.submit(5)).toBe('/api/v1/survey-sessions/5/submit/');
      expect(s.adminFill).toBe('/api/v1/survey-sessions/admin-fill/');
      expect(s.results).toBe('/api/v1/survey-sessions/results/');
      expect(s.export).toBe('/api/v1/survey-sessions/export/');
    });
    it('keeps employees face-photo endpoints', () => {
      expect(API_ENDPOINTS.employees.facePhotos(2)).toBe('/api/v1/employees/2/face-photos/');
    });
  });
  ```
- [ ] **Step 2: Run test to verify it fails**
  `(cd "$FRONT" && CI=true npx react-scripts test src/lib/api/__tests__/endpoints.test.ts --watchAll=false)`
  Expected: FAIL — `Cannot read properties of undefined (reading 'tests')` (no `surveys` group).
- [ ] **Step 3: Write minimal implementation** — replace the whole `API_ENDPOINTS` object in `src/lib/api/endpoints.ts`:
  ```ts
  const API_V1 = '/api/v1';

  /**
   * Pathnames from the app origin (`baseURL` = `HOST_API`).
   * Django: `backend/config/api_v1.py` → `/api/v1/...`
   */
  export const API_ENDPOINTS = {
    auth: {
      login: `${API_V1}/auth/login/`,
      refresh: `${API_V1}/auth/refresh/`,
      logout: `${API_V1}/auth/logout/`,
      me: `${API_V1}/auth/me/`,
    },
    specialties: {
      list: `${API_V1}/specialties/`,
      detail: (id: number | string) => `${API_V1}/specialties/${id}/`,
    },
    employees: {
      list: `${API_V1}/employees/`,
      detail: (id: number | string) => `${API_V1}/employees/${id}/`,
      facePhotos: (id: number | string) => `${API_V1}/employees/${id}/face-photos/`,
      facePhoto: (id: number | string, photoId: number | string) =>
        `${API_V1}/employees/${id}/face-photos/${photoId}/`,
    },
    surveys: {
      // Admin CRUD
      tests: `${API_V1}/tests/`,
      test: (id: number | string) => `${API_V1}/tests/${id}/`,
      questionBlocks: `${API_V1}/question-blocks/`,
      questionBlock: (id: number | string) => `${API_V1}/question-blocks/${id}/`,
      questions: `${API_V1}/questions/`,
      question: (id: number | string) => `${API_V1}/questions/${id}/`,
      // Kiosk + results
      sessions: `${API_V1}/survey-sessions/`,
      session: (id: number | string) => `${API_V1}/survey-sessions/${id}/`,
      identify: `${API_V1}/survey-sessions/identify/`,
      due: `${API_V1}/survey-sessions/due/`,
      start: `${API_V1}/survey-sessions/start/`,
      submit: (id: number | string) => `${API_V1}/survey-sessions/${id}/submit/`,
      adminFill: `${API_V1}/survey-sessions/admin-fill/`,
      results: `${API_V1}/survey-sessions/results/`,
      export: `${API_V1}/survey-sessions/export/`,
    },
    dashboard: {
      stats: `${API_V1}/dashboard/stats/`,
    },
  } as const;
  ```
- [ ] **Step 4: Run test to verify it passes**
  `(cd "$FRONT" && CI=true npx react-scripts test src/lib/api/__tests__/endpoints.test.ts --watchAll=false)`
  Expected: PASS (3 tests).
- [ ] **Step 5: Commit**
  ```bash
  cd "$FRONT" && git add -A && git commit -m "feat(api): add surveys endpoint group, drop assessment/medical endpoints"
  ```

---

### Task 3: `permissions.ts` — survey permission pages/actions

**Files:**
- Modify: `src/auth/utils/permissions.ts:5-18` (the two exported types)
- Test: `src/auth/utils/__tests__/permissions.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `PermissionPage = 'dashboard'|'employees'|'specialties'|'tests'|'questions'|'results'|'survey'` and `PermissionAction = 'read'|'detail'|'write'|'submit'`. Guard keys used later: `tests:read`/`tests:write` (tests+blocks admin), `questions:read`/`questions:write`, `results:read`, `survey:submit` (kiosk). These must mirror `backend/apps/accounts/permission_catalog.py` (Plan 1/2), whose ADMIN role grants exactly `dashboard:read, employees:read/write, specialties:read/write, tests:read/write, questions:read/write, results:read/detail` and SPECIALIST grants `employees:read, survey:submit`.

- [ ] **Step 1: Write the failing test**
  Create `src/auth/utils/__tests__/permissions.test.ts`:
  ```ts
  import { buildPermission, checkPermission } from '../permissions';

  describe('survey permissions', () => {
    it('builds admin survey keys', () => {
      expect(buildPermission('tests', 'write')).toBe('tests:write');
      expect(buildPermission('results', 'read')).toBe('results:read');
    });
    it('builds the kiosk submit key', () => {
      expect(buildPermission('survey', 'submit')).toBe('survey:submit');
    });
    it('checks membership', () => {
      expect(checkPermission(['survey:submit'], 'survey', 'submit')).toBe(true);
      expect(checkPermission(['tests:read'], 'tests', 'write')).toBe(false);
    });
  });
  ```
- [ ] **Step 2: Run test to verify it fails**
  `(cd "$FRONT" && CI=true npx react-scripts test src/auth/utils/__tests__/permissions.test.ts --watchAll=false)`
  Expected: FAIL — TS compile error: `'survey'` / `'submit'` not assignable to `PermissionPage`/`PermissionAction`.
- [ ] **Step 3: Write minimal implementation** — replace lines 5-18 of `src/auth/utils/permissions.ts`:
  ```ts
  export type PermissionPage =
    | 'dashboard'
    | 'employees'
    | 'specialties'
    | 'tests'
    | 'questions'
    | 'results'
    | 'survey';

  export type PermissionAction = 'read' | 'detail' | 'write' | 'submit';

  export type PermissionKey = `${PermissionPage}:${PermissionAction}`;
  ```
- [ ] **Step 4: Run test to verify it passes**
  `(cd "$FRONT" && CI=true npx react-scripts test src/auth/utils/__tests__/permissions.test.ts --watchAll=false)`
  Expected: PASS (3 tests).
- [ ] **Step 5: Commit**
  ```bash
  cd "$FRONT" && git add -A && git commit -m "feat(auth): survey/kiosk permission pages and submit action"
  ```

---

### Task 4: `paths.ts` — survey admin + kiosk routes

**Files:**
- Modify: `src/routes/paths.ts` (full rewrite of the `app` block)
- Test: `src/routes/__tests__/paths.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `paths.app.surveys.{ tests, blocks(testId), questions(blockId), results }` and `paths.app.kiosk.{ root, due(employeeId), answer, thankYou }`. Also keeps `paths.home`, `paths.login`, `paths.app.{employees,specialties,dashboard}`.

- [ ] **Step 1: Write the failing test**
  Create `src/routes/__tests__/paths.test.ts`:
  ```ts
  import { paths } from '../paths';

  describe('survey + kiosk paths', () => {
    it('admin survey paths', () => {
      expect(paths.app.surveys.tests).toBe('/surveys/tests');
      expect(paths.app.surveys.blocks(4)).toBe('/surveys/tests/4/blocks');
      expect(paths.app.surveys.questions(8)).toBe('/surveys/blocks/8/questions');
      expect(paths.app.surveys.results).toBe('/surveys/results');
    });
    it('kiosk paths', () => {
      expect(paths.app.kiosk.root).toBe('/kiosk');
      expect(paths.app.kiosk.due(2)).toBe('/kiosk/2/due');
      expect(paths.app.kiosk.answer).toBe('/kiosk/answer');
      expect(paths.app.kiosk.thankYou).toBe('/kiosk/thank-you');
    });
  });
  ```
- [ ] **Step 2: Run test to verify it fails**
  `(cd "$FRONT" && CI=true npx react-scripts test src/routes/__tests__/paths.test.ts --watchAll=false)`
  Expected: FAIL — `Cannot read properties of undefined (reading 'tests')`.
- [ ] **Step 3: Write minimal implementation** — replace the whole file `src/routes/paths.ts`:
  ```ts
  export const paths = {
    login: '/login',
    home: '/home',

    page403: '/403',
    page404: '/404',
    page500: '/500',
    maintenance: '/maintenance',

    auth: {
      jwt: {
        login: '/login',
      },
    },

    app: {
      dashboard: '/dashboard',
      employees: '/employees',
      specialties: '/specialties',
      surveys: {
        tests: '/surveys/tests',
        blocks: (testId: number | string) => `/surveys/tests/${testId}/blocks`,
        questions: (blockId: number | string) => `/surveys/blocks/${blockId}/questions`,
        results: '/surveys/results',
      },
      kiosk: {
        root: '/kiosk',
        due: (employeeId: number | string) => `/kiosk/${employeeId}/due`,
        answer: '/kiosk/answer',
        thankYou: '/kiosk/thank-you',
      },
    },
  };
  ```
- [ ] **Step 4: Run test to verify it passes**
  `(cd "$FRONT" && CI=true npx react-scripts test src/routes/__tests__/paths.test.ts --watchAll=false)`
  Expected: PASS (2 tests).
- [ ] **Step 5: Commit**
  ```bash
  cd "$FRONT" && git add -A && git commit -m "feat(routes): survey admin + kiosk path builders"
  ```

---

### Task 5: Employees — `hire_date` + `work_experience` in types, schema, requests

**Files:**
- Modify: `src/sections/app/employees/api/types.ts`
- Modify: `src/sections/app/employees/api/employees-requests.ts:10-26` (`buildEmployeeBody`)
- Modify: `src/sections/app/employees/components/utils/employee-schema.ts`
- Test: `src/sections/app/employees/components/utils/__tests__/employee-schema.test.ts`, `src/sections/app/employees/api/__tests__/employees-requests.test.ts`

**Interfaces:**
- Consumes: Plan 1 `EmployeeSerializer` now emits `hire_date` (→ `hireDate: string | null`, ISO `YYYY-MM-DD`) and `work_experience` (→ `workExperience: number | null`).
- Produces: `Employee` gains `hireDate: string | null; workExperience: number | null`. `EmployeeUpsertPayload` gains `hireDate?: string | null; workExperience?: number | null`. `EmployeeFormValues` gains `hireDate: string; workExperience: number | ''`. `buildEmployeeBody` serializes both (JSON camelCase when no photo; FormData snake_case `hire_date`/`work_experience` when a photo is present).

- [ ] **Step 1: Write the failing tests**
  Create `src/sections/app/employees/components/utils/__tests__/employee-schema.test.ts`:
  ```ts
  import { buildEmployeeSchema } from '../employee-schema';

  const tx = (k: string) => k;

  describe('employee schema', () => {
    it('accepts optional hireDate + workExperience', async () => {
      const schema = buildEmployeeSchema(tx);
      const value = await schema.validate({
        fullName: 'Ivan', specialty: 1, photo: 'x', isActive: true,
        hireDate: '2024-01-15', workExperience: 3,
      });
      expect(value.hireDate).toBe('2024-01-15');
      expect(value.workExperience).toBe(3);
    });
    it('coerces empty hireDate/workExperience to null-ish', async () => {
      const schema = buildEmployeeSchema(tx);
      const value = await schema.validate({
        fullName: 'Ivan', specialty: 1, photo: 'x', isActive: true,
        hireDate: '', workExperience: '',
      });
      expect(value.hireDate).toBe('');
      expect(value.workExperience).toBeNull();
    });
  });
  ```
  Create `src/sections/app/employees/api/__tests__/employees-requests.test.ts`:
  ```ts
  import { buildEmployeeBody } from '../employees-requests';

  describe('buildEmployeeBody', () => {
    it('JSON body carries hireDate/workExperience when no photo', () => {
      const body = buildEmployeeBody({
        fullName: 'A', specialty: 1, isActive: true,
        hireDate: '2024-02-01', workExperience: 5,
      }) as Record<string, unknown>;
      expect(body).toMatchObject({ hireDate: '2024-02-01', workExperience: 5 });
      expect(body instanceof FormData).toBe(false);
    });
    it('FormData uses snake_case keys when a photo is present', () => {
      const file = new File(['x'], 'p.jpg', { type: 'image/jpeg' });
      const body = buildEmployeeBody({
        fullName: 'A', specialty: 1, isActive: true, photo: file,
        hireDate: '2024-02-01', workExperience: 5,
      }) as FormData;
      expect(body instanceof FormData).toBe(true);
      expect(body.get('hire_date')).toBe('2024-02-01');
      expect(body.get('work_experience')).toBe('5');
    });
  });
  ```
- [ ] **Step 2: Run tests to verify they fail**
  `(cd "$FRONT" && CI=true npx react-scripts test src/sections/app/employees/api/__tests__/employees-requests.test.ts src/sections/app/employees/components/utils/__tests__/employee-schema.test.ts --watchAll=false)`
  Expected: FAIL — `buildEmployeeBody` is not exported / body lacks `hireDate`.
- [ ] **Step 3: Write minimal implementation**
  In `src/sections/app/employees/api/types.ts` add fields to `Employee` (after `isActive`) and `EmployeeUpsertPayload`:
  ```ts
  export type Employee = {
    id: number;
    fullName: string;
    specialty: number;
    specialtyName: string;
    photo: string | null;
    isActive: boolean;
    /** ISO date (YYYY-MM-DD) or null — drives kiosk survey scheduling (Plan 2). */
    hireDate: string | null;
    /** Manually entered years of experience; independent of hireDate. */
    workExperience: number | null;
    createdAt: string;
  };
  ```
  ```ts
  export type EmployeeUpsertPayload = {
    fullName: string;
    specialty: number;
    photo?: File;
    isActive?: boolean;
    hireDate?: string | null;
    workExperience?: number | null;
  };
  ```
  In `src/sections/app/employees/api/employees-requests.ts` replace `buildEmployeeBody` and `export` it:
  ```ts
  export function buildEmployeeBody(payload: Partial<EmployeeUpsertPayload>): FormData | object {
    if (!payload.photo) {
      const { fullName, specialty, isActive, hireDate, workExperience } = payload;
      return {
        ...(fullName !== undefined ? { fullName } : {}),
        ...(specialty !== undefined ? { specialty } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        ...(hireDate !== undefined ? { hireDate } : {}),
        ...(workExperience !== undefined ? { workExperience } : {}),
      };
    }

    const formData = new FormData();
    if (payload.fullName !== undefined) formData.append('full_name', payload.fullName);
    if (payload.specialty !== undefined) formData.append('specialty', String(payload.specialty));
    if (payload.isActive !== undefined) formData.append('is_active', String(payload.isActive));
    if (payload.hireDate !== undefined && payload.hireDate !== null)
      formData.append('hire_date', payload.hireDate);
    if (payload.workExperience !== undefined && payload.workExperience !== null)
      formData.append('work_experience', String(payload.workExperience));
    formData.append('photo', payload.photo);
    return formData;
  }
  ```
  In `src/sections/app/employees/components/utils/employee-schema.ts` replace the file:
  ```ts
  import * as Yup from 'yup';

  export type EmployeeFormValues = {
    fullName: string;
    specialty: number | '';
    photo: File | string | null;
    isActive: boolean;
    /** '' when unset; sent as null to the API. */
    hireDate: string;
    /** '' when unset; coerced to null. */
    workExperience: number | '' | null;
  };

  export function buildEmployeeSchema(tx: (key: string) => string) {
    return Yup.object().shape({
      fullName: Yup.string().trim().max(255).required(tx('employees.validation.fullNameRequired')),
      specialty: Yup.number()
        .typeError(tx('employees.validation.specialtyRequired'))
        .required(tx('employees.validation.specialtyRequired')),
      photo: Yup.mixed<File | string>()
        .nullable()
        .test('photo-required', tx('employees.validation.photoRequired'), (value) => Boolean(value)),
      isActive: Yup.boolean().required(),
      hireDate: Yup.string().ensure(),
      workExperience: Yup.number()
        .transform((value, original) => (original === '' || original === null ? null : value))
        .nullable()
        .min(0, tx('employees.validation.workExperienceMin')),
    });
  }
  ```
- [ ] **Step 4: Run tests to verify they pass**
  `(cd "$FRONT" && CI=true npx react-scripts test src/sections/app/employees/api/__tests__/employees-requests.test.ts src/sections/app/employees/components/utils/__tests__/employee-schema.test.ts --watchAll=false)`
  Expected: PASS (4 tests).
- [ ] **Step 5: Commit**
  ```bash
  cd "$FRONT" && git add -A && git commit -m "feat(employees): hireDate + workExperience in types/schema/requests"
  ```

---

### Task 6: Employees — form fields + table columns

**Files:**
- Modify: `src/sections/app/employees/components/employee-upsert-dialog.tsx` (defaultValues + fields + submit payload)
- Modify: `src/sections/app/employees/components/employee-table-row.tsx` (two new cells)
- Modify: `src/sections/app/employees/view.tsx:172-178` (headLabel)
- Test: `src/sections/app/employees/components/__tests__/employee-table-row.test.tsx` (extend)

**Interfaces:**
- Consumes: Task 5 `EmployeeFormValues`, `Employee.hireDate/workExperience`.
- Produces: form renders a native date input (`RHFTextField type="date"`, label «Работает с») and a number input (label «Стаж»); table shows both. (Decision: native `type="date"` avoids a `LocalizationProvider` wiring — no new provider needed, satisfies the DatePicker requirement.)

- [ ] **Step 1: Write the failing test** — extend the existing row test to assert the two new cells. Append to `src/sections/app/employees/components/__tests__/employee-table-row.test.tsx` a new case (mirror the file's existing render harness; if the file mocks `use-locales` with `tx: key => key`, reuse it):
  ```tsx
  it('renders hire date and work experience', () => {
    render(
      <table><tbody>
        <EmployeeTableRow
          row={{
            id: 1, fullName: 'Ivan', specialty: 1, specialtyName: 'Fitter',
            photo: null, isActive: true, hireDate: '2024-01-15', workExperience: 3,
            createdAt: '2024-01-01T00:00:00Z',
          }}
          canWrite={false}
          onEdit={jest.fn()}
          onToggleActive={jest.fn()}
        />
      </tbody></table>
    );
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText(/2024/)).toBeInTheDocument();
  });
  ```
  (Import `render`, `screen` from `src/test-utils`; `EmployeeTableRow` default import.)
- [ ] **Step 2: Run test to verify it fails**
  `(cd "$FRONT" && CI=true npx react-scripts test src/sections/app/employees/components/__tests__/employee-table-row.test.tsx --watchAll=false)`
  Expected: FAIL — `Unable to find an element with the text: 3`.
- [ ] **Step 3: Write minimal implementation**
  In `employee-table-row.tsx`, after the `specialtyName` cell (line ~50) insert two cells:
  ```tsx
        <TableCell>{row.hireDate ? fDate(row.hireDate) : '—'}</TableCell>

        <TableCell>{row.workExperience ?? '—'}</TableCell>
  ```
  In `employees/view.tsx` replace `headLabel` (lines 172-178):
  ```tsx
    const headLabel = [
      { id: 'full_name', label: tx('employees.table.fullName') },
      { id: 'specialty', label: tx('employees.table.specialty'), width: 200 },
      { id: 'hire_date', label: tx('employees.table.hireDate'), width: 140 },
      { id: 'work_experience', label: tx('employees.table.workExperience'), width: 100 },
      { id: 'is_active', label: tx('employees.table.status'), width: 120 },
      { id: 'created_at', label: tx('employees.table.created'), width: 140 },
      ...(canWrite ? [{ id: 'actions', label: '', width: 64, align: 'right' as const }] : []),
    ];
  ```
  Also add `'hire_date'` to `SORTABLE_COLUMNS` (line 48): `const SORTABLE_COLUMNS = ['full_name', 'hire_date', 'created_at'];`
  In `employee-upsert-dialog.tsx`:
  - Extend `defaultValues` (lines 78-86):
    ```tsx
      const defaultValues = useMemo<EmployeeFormValues>(
        () => ({
          fullName: employee?.fullName ?? '',
          specialty: employee?.specialty ?? '',
          photo: employee?.photo ?? null,
          isActive: employee?.isActive ?? true,
          hireDate: employee?.hireDate ?? '',
          workExperience: employee?.workExperience ?? '',
        }),
        [employee]
      );
    ```
  - Add fields after the `specialty` `RHFSelect` (after line 231):
    ```tsx
            <RHFTextField
              name="hireDate"
              type="date"
              label={tx('employees.form.hireDate')}
              InputLabelProps={{ shrink: true }}
            />

            <RHFTextField
              name="workExperience"
              type="number"
              label={tx('employees.form.workExperience')}
              InputProps={{ inputProps: { min: 0 } }}
            />
    ```
  - In `onSubmit`, add both to create/update payloads (inside the two payload objects at lines 178-192):
    ```tsx
                  hireDate: values.hireDate || null,
                  workExperience: values.workExperience === '' ? null : Number(values.workExperience),
    ```
- [ ] **Step 4: Run test to verify it passes**
  `(cd "$FRONT" && CI=true npx react-scripts test src/sections/app/employees/components/__tests__/employee-table-row.test.tsx --watchAll=false)`
  Expected: PASS.
- [ ] **Step 5: Commit**
  ```bash
  cd "$FRONT" && git add -A && git commit -m "feat(employees): hireDate DatePicker + workExperience in form and table"
  ```

---

### Task 7: Survey admin API layer — types, requests, hooks

Creates the shared data layer consumed by all four admin screens (Tests, Blocks, Questions, Results).

**Files:**
- Create: `src/sections/app/admin-surveys/api/types.ts`
- Create: `src/sections/app/admin-surveys/api/surveys-requests.ts`
- Create: `src/sections/app/admin-surveys/api/use-surveys-api.ts`
- Test: `src/sections/app/admin-surveys/api/__tests__/surveys-requests.test.ts`

**Interfaces:**
- Consumes: `API_ENDPOINTS.surveys.*` (Task 2); `request`, `Pagination` (`src/hooks/api`).
- Produces (types other tasks import): `QuestionType = 'single'|'multiple'|'textarea'`; `TestOption = { id: string; text: string }`; `Test`, `TestUpsertPayload`, `QuestionBlock`, `QuestionBlockUpsertPayload`, `Question`, `QuestionUpsertPayload`, `SurveyResults`, `QuestionResult`, `ResultsParams`, `ResultsExportParams`. Hooks: `useTestsQuery`, `useTestOptionsQuery`, `useCreateTestMutation`, `useUpdateTestMutation`, `useDeleteTestMutation`, `useQuestionBlocksQuery`, `useCreate/Update/DeleteQuestionBlockMutation`, `useQuestionsQuery`, `useCreate/Update/DeleteQuestionMutation`, `useSurveyResultsQuery`, `useExportSurveyResultsMutation`.
- **Cross-plan note:** `SurveyResults`/`QuestionResult` shape must match Plan 2's `survey-sessions/results/` serializer; `Test`/`Question`/`QuestionBlock` mirror Plan 2 serializers (camelCased).

- [ ] **Step 1: Write the failing test**
  Create `src/sections/app/admin-surveys/api/__tests__/surveys-requests.test.ts`:
  ```ts
  import { API_ENDPOINTS } from 'src/lib/api/endpoints';

  import * as requests from '../surveys-requests';

  jest.mock('src/utils/axios', () => ({
    API_ENDPOINTS: jest.requireActual('src/lib/api/endpoints').API_ENDPOINTS,
    request: jest.fn().mockResolvedValue({ ok: true }),
  }));

  // eslint-disable-next-line import/first, @typescript-eslint/no-var-requires
  const { request } = require('src/utils/axios');

  describe('surveys-requests', () => {
    beforeEach(() => (request as jest.Mock).mockClear());

    it('fetchTests hits the tests collection', async () => {
      await requests.fetchTests({ page: 1 });
      expect(request).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'GET', url: API_ENDPOINTS.surveys.tests })
      );
    });

    it('createQuestion posts to the questions collection', async () => {
      await requests.createQuestion({ block: 3, type: 'single', order: 0, text: 'Q', options: [] });
      expect(request).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'POST', url: API_ENDPOINTS.surveys.questions })
      );
    });

    it('exportSurveyResults requests a blob', async () => {
      await requests.exportSurveyResults({ test: 5 });
      expect(request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: API_ENDPOINTS.surveys.export,
          responseType: 'blob',
        })
      );
    });
  });
  ```
- [ ] **Step 2: Run test to verify it fails**
  `(cd "$FRONT" && CI=true npx react-scripts test src/sections/app/admin-surveys/api/__tests__/surveys-requests.test.ts --watchAll=false)`
  Expected: FAIL — `Cannot find module '../surveys-requests'`.
- [ ] **Step 3: Write minimal implementation**
  Create `src/sections/app/admin-surveys/api/types.ts`:
  ```ts
  export type QuestionType = 'single' | 'multiple' | 'textarea';

  /** Stable option id survives reordering so analytics don't drift (spec §4.1). */
  export type TestOption = { id: string; text: string };

  /** Matches Plan 2 `TestSerializer` (camelCase). */
  export type Test = {
    id: number;
    title: string;
    isActive: boolean;
    isAdminConducted: boolean;
    isAfterApplication: boolean;
    afterDays: number | null;
    testDaysFrom: number | null;
    testDaysTo: number | null;
    month: number[];
    createdAt: string;
  };

  export type TestListParams = {
    page?: number;
    pageSize?: number;
    search?: string;
    ordering?: string;
    isActive?: boolean;
  };

  export type TestUpsertPayload = {
    title: string;
    isActive: boolean;
    isAdminConducted: boolean;
    isAfterApplication: boolean;
    afterDays: number | null;
    testDaysFrom: number | null;
    testDaysTo: number | null;
    month: number[];
  };

  /** Matches Plan 2 `QuestionBlockSerializer`. */
  export type QuestionBlock = {
    id: number;
    test: number;
    order: number;
    title: string;
    createdAt: string;
  };

  export type QuestionBlockUpsertPayload = {
    test: number;
    order: number;
    title: string;
  };

  /** Matches Plan 2 `QuestionSerializer`. */
  export type Question = {
    id: number;
    block: number;
    type: QuestionType;
    order: number;
    text: string;
    options: TestOption[];
    createdAt: string;
  };

  export type QuestionUpsertPayload = {
    block: number;
    type: QuestionType;
    order: number;
    text: string;
    options: TestOption[];
  };

  /** Matches Plan 2 `survey-sessions/results/` aggregate serializer. */
  export type QuestionResult = {
    question: number;
    text: string;
    type: QuestionType;
    /** Present for single/multiple: per-option selection counts. */
    options?: Array<{ id: string; text: string; count: number }>;
    /** Present for textarea: raw free-text answers. */
    textAnswers?: string[];
  };

  export type SurveyResults = {
    test: number;
    testTitle: string;
    sessionCount: number;
    questions: QuestionResult[];
  };

  export type ResultsParams = { test: number };
  export type ResultsExportParams = { test: number };
  ```
  Create `src/sections/app/admin-surveys/api/surveys-requests.ts`:
  ```ts
  import { request, API_ENDPOINTS } from 'src/utils/axios';
  import type { Pagination } from 'src/hooks/api';

  import type {
    Question,
    QuestionBlock,
    QuestionBlockUpsertPayload,
    QuestionUpsertPayload,
    ResultsExportParams,
    ResultsParams,
    SurveyResults,
    Test,
    TestListParams,
    TestUpsertPayload,
  } from './types';

  // ── Tests ──────────────────────────────────────────────────────────────
  export function fetchTests(params: TestListParams) {
    return request<Pagination<Test>>({ method: 'GET', url: API_ENDPOINTS.surveys.tests, params });
  }
  export function createTest(payload: TestUpsertPayload) {
    return request<Test>({ method: 'POST', url: API_ENDPOINTS.surveys.tests, data: payload });
  }
  export function updateTest(id: number, payload: Partial<TestUpsertPayload>) {
    return request<Test>({ method: 'PATCH', url: API_ENDPOINTS.surveys.test(id), data: payload });
  }
  export function deleteTest(id: number) {
    return request<void>({ method: 'DELETE', url: API_ENDPOINTS.surveys.test(id) });
  }

  // ── Question blocks ────────────────────────────────────────────────────
  export function fetchQuestionBlocks(testId: number) {
    return request<Pagination<QuestionBlock>>({
      method: 'GET',
      url: API_ENDPOINTS.surveys.questionBlocks,
      params: { test: testId, ordering: 'order', pageSize: 200 },
    });
  }
  export function createQuestionBlock(payload: QuestionBlockUpsertPayload) {
    return request<QuestionBlock>({
      method: 'POST',
      url: API_ENDPOINTS.surveys.questionBlocks,
      data: payload,
    });
  }
  export function updateQuestionBlock(id: number, payload: Partial<QuestionBlockUpsertPayload>) {
    return request<QuestionBlock>({
      method: 'PATCH',
      url: API_ENDPOINTS.surveys.questionBlock(id),
      data: payload,
    });
  }
  export function deleteQuestionBlock(id: number) {
    return request<void>({ method: 'DELETE', url: API_ENDPOINTS.surveys.questionBlock(id) });
  }

  // ── Questions ──────────────────────────────────────────────────────────
  export function fetchQuestions(blockId: number) {
    return request<Pagination<Question>>({
      method: 'GET',
      url: API_ENDPOINTS.surveys.questions,
      params: { block: blockId, ordering: 'order', pageSize: 200 },
    });
  }
  export function createQuestion(payload: QuestionUpsertPayload) {
    return request<Question>({ method: 'POST', url: API_ENDPOINTS.surveys.questions, data: payload });
  }
  export function updateQuestion(id: number, payload: Partial<QuestionUpsertPayload>) {
    return request<Question>({
      method: 'PATCH',
      url: API_ENDPOINTS.surveys.question(id),
      data: payload,
    });
  }
  export function deleteQuestion(id: number) {
    return request<void>({ method: 'DELETE', url: API_ENDPOINTS.surveys.question(id) });
  }

  // ── Results ────────────────────────────────────────────────────────────
  export function fetchSurveyResults(params: ResultsParams) {
    return request<SurveyResults>({ method: 'GET', url: API_ENDPOINTS.surveys.results, params });
  }
  export function exportSurveyResults(params: ResultsExportParams) {
    return request<Blob>({
      method: 'GET',
      url: API_ENDPOINTS.surveys.export,
      params,
      responseType: 'blob',
    });
  }
  ```
  Create `src/sections/app/admin-surveys/api/use-surveys-api.ts`:
  ```ts
  import { keepPreviousData } from '@tanstack/react-query';

  import { useFetch, useFetchList, useMutate } from 'src/hooks/api';

  import {
    createQuestion,
    createQuestionBlock,
    createTest,
    deleteQuestion,
    deleteQuestionBlock,
    deleteTest,
    exportSurveyResults,
    fetchQuestionBlocks,
    fetchQuestions,
    fetchSurveyResults,
    fetchTests,
    updateQuestion,
    updateQuestionBlock,
    updateTest,
  } from './surveys-requests';
  import type {
    Question,
    QuestionBlock,
    QuestionBlockUpsertPayload,
    QuestionUpsertPayload,
    ResultsExportParams,
    ResultsParams,
    SurveyResults,
    Test,
    TestListParams,
    TestUpsertPayload,
  } from './types';

  // ── Tests ──────────────────────────────────────────────────────────────
  export function useTestsQuery(params: TestListParams) {
    return useFetchList<Test>(['surveys', 'tests', params], () => fetchTests(params), {
      placeholderData: keepPreviousData,
    });
  }
  export function useTestOptionsQuery() {
    return useFetch(['surveys', 'testOptions'], () =>
      fetchTests({ pageSize: 200, ordering: 'title' })
    );
  }
  export function useCreateTestMutation() {
    return useMutate<Test, TestUpsertPayload>((payload) => createTest(payload));
  }
  export function useUpdateTestMutation() {
    return useMutate<Test, { id: number; payload: Partial<TestUpsertPayload> }>(({ id, payload }) =>
      updateTest(id, payload)
    );
  }
  export function useDeleteTestMutation() {
    return useMutate<void, number>((id) => deleteTest(id));
  }

  // ── Question blocks ────────────────────────────────────────────────────
  export function useQuestionBlocksQuery(testId: number) {
    return useFetchList<QuestionBlock>(
      ['surveys', 'blocks', testId],
      () => fetchQuestionBlocks(testId),
      { enabled: Number.isFinite(testId) }
    );
  }
  export function useCreateQuestionBlockMutation() {
    return useMutate<QuestionBlock, QuestionBlockUpsertPayload>((payload) =>
      createQuestionBlock(payload)
    );
  }
  export function useUpdateQuestionBlockMutation() {
    return useMutate<QuestionBlock, { id: number; payload: Partial<QuestionBlockUpsertPayload> }>(
      ({ id, payload }) => updateQuestionBlock(id, payload)
    );
  }
  export function useDeleteQuestionBlockMutation() {
    return useMutate<void, number>((id) => deleteQuestionBlock(id));
  }

  // ── Questions ──────────────────────────────────────────────────────────
  export function useQuestionsQuery(blockId: number) {
    return useFetchList<Question>(['surveys', 'questions', blockId], () => fetchQuestions(blockId), {
      enabled: Number.isFinite(blockId),
    });
  }
  export function useCreateQuestionMutation() {
    return useMutate<Question, QuestionUpsertPayload>((payload) => createQuestion(payload));
  }
  export function useUpdateQuestionMutation() {
    return useMutate<Question, { id: number; payload: Partial<QuestionUpsertPayload> }>(
      ({ id, payload }) => updateQuestion(id, payload)
    );
  }
  export function useDeleteQuestionMutation() {
    return useMutate<void, number>((id) => deleteQuestion(id));
  }

  // ── Results ────────────────────────────────────────────────────────────
  export function useSurveyResultsQuery(params: ResultsParams | null) {
    return useFetch<SurveyResults>(
      ['surveys', 'results', params],
      () => fetchSurveyResults(params as ResultsParams),
      { enabled: params !== null }
    );
  }
  export function useExportSurveyResultsMutation() {
    return useMutate<Blob, ResultsExportParams>((params) => exportSurveyResults(params));
  }
  ```
- [ ] **Step 4: Run test to verify it passes**
  `(cd "$FRONT" && CI=true npx react-scripts test src/sections/app/admin-surveys/api/__tests__/surveys-requests.test.ts --watchAll=false)`
  Expected: PASS (3 tests).
- [ ] **Step 5: Commit**
  ```bash
  cd "$FRONT" && git add -A && git commit -m "feat(admin-surveys): api layer (types/requests/hooks) for tests/blocks/questions/results"
  ```

---

### Task 8: Admin — Tests CRUD (list + scheduling upsert dialog)

**Files:**
- Create: `src/sections/app/admin-surveys/tests/view.tsx`
- Create: `src/sections/app/admin-surveys/tests/components/test-upsert-dialog.tsx`
- Create: `src/sections/app/admin-surveys/tests/components/test-table-row.tsx`
- Create: `src/sections/app/admin-surveys/tests/components/index.tsx`
- Create: `src/sections/app/admin-surveys/tests/components/utils/test-schema.ts`
- Test: `src/sections/app/admin-surveys/tests/components/utils/__tests__/test-schema.test.ts`

**Interfaces:**
- Consumes: Task 7 hooks/types; `useCheckPermission().canWritePage('tests')`; MUI table primitives (`src/components/table`), `RHFTextField`, `RHFSwitch`, `RHFMultiSelect`, `RHFSelect`.
- Produces: `TestsView` default export (wired by page in Task 12); `buildTestSchema(tx)` + `TestFormValues`; `TestUpsertDialog`; `TestTableRow`.

- [ ] **Step 1: Write the failing test**
  Create `src/sections/app/admin-surveys/tests/components/utils/__tests__/test-schema.test.ts`:
  ```ts
  import { buildTestSchema } from '../test-schema';

  const tx = (k: string) => k;

  describe('test schema — scheduling validation', () => {
    it('requires afterDays when isAfterApplication is on', async () => {
      const schema = buildTestSchema(tx);
      await expect(
        schema.validate({
          title: 'T', isActive: true, isAdminConducted: false,
          isAfterApplication: true, afterDays: null,
          testDaysFrom: null, testDaysTo: null, month: [],
        })
      ).rejects.toThrow('surveys.tests.validation.afterDaysRequired');
    });

    it('accepts a periodic config (month multiselect + day window)', async () => {
      const schema = buildTestSchema(tx);
      const value = await schema.validate({
        title: 'Pulse', isActive: true, isAdminConducted: false,
        isAfterApplication: false, afterDays: null,
        testDaysFrom: 1, testDaysTo: 7, month: [1, 4, 7, 10],
      });
      expect(value.month).toEqual([1, 4, 7, 10]);
      expect(value.testDaysTo).toBe(7);
    });

    it('rejects testDaysTo < testDaysFrom', async () => {
      const schema = buildTestSchema(tx);
      await expect(
        schema.validate({
          title: 'T', isActive: true, isAdminConducted: false,
          isAfterApplication: false, afterDays: null,
          testDaysFrom: 10, testDaysTo: 3, month: [],
        })
      ).rejects.toThrow('surveys.tests.validation.dayRange');
    });
  });
  ```
- [ ] **Step 2: Run test to verify it fails**
  `(cd "$FRONT" && CI=true npx react-scripts test src/sections/app/admin-surveys/tests/components/utils/__tests__/test-schema.test.ts --watchAll=false)`
  Expected: FAIL — `Cannot find module '../test-schema'`.
- [ ] **Step 3: Write minimal implementation**
  Create `src/sections/app/admin-surveys/tests/components/utils/test-schema.ts`:
  ```ts
  import * as Yup from 'yup';

  export type TestFormValues = {
    title: string;
    isActive: boolean;
    isAdminConducted: boolean;
    isAfterApplication: boolean;
    afterDays: number | null;
    testDaysFrom: number | null;
    testDaysTo: number | null;
    /** Months as strings for RHFMultiSelect; converted to number[] on submit. */
    month: number[];
  };

  const nullableInt = () =>
    Yup.number()
      .transform((value, original) => (original === '' || original === null ? null : value))
      .nullable();

  export function buildTestSchema(tx: (key: string) => string) {
    return Yup.object().shape({
      title: Yup.string().trim().max(255).required(tx('surveys.tests.validation.titleRequired')),
      isActive: Yup.boolean().required(),
      isAdminConducted: Yup.boolean().required(),
      isAfterApplication: Yup.boolean().required(),
      afterDays: nullableInt()
        .min(0, tx('surveys.tests.validation.afterDaysMin'))
        .when('isAfterApplication', {
          is: true,
          then: (s) => s.required(tx('surveys.tests.validation.afterDaysRequired')),
        }),
      testDaysFrom: nullableInt().min(1).max(31),
      testDaysTo: nullableInt()
        .min(1)
        .max(31)
        .test('day-range', tx('surveys.tests.validation.dayRange'), function validRange(to) {
          const { testDaysFrom, isAfterApplication } = this.parent as TestFormValues;
          if (isAfterApplication) return true;
          if (to == null || testDaysFrom == null) return true;
          return to >= testDaysFrom;
        }),
      month: Yup.array().of(Yup.number().required()).required(),
    });
  }
  ```
  Create `src/sections/app/admin-surveys/tests/components/test-upsert-dialog.tsx`:
  ```tsx
  import { useEffect, useMemo } from 'react';
  import { useForm } from 'react-hook-form';
  import { yupResolver } from '@hookform/resolvers/yup';
  import LoadingButton from '@mui/lab/LoadingButton';
  import Button from '@mui/material/Button';
  import Dialog from '@mui/material/Dialog';
  import DialogActions from '@mui/material/DialogActions';
  import DialogContent from '@mui/material/DialogContent';
  import DialogTitle from '@mui/material/DialogTitle';
  import Divider from '@mui/material/Divider';
  import Stack from '@mui/material/Stack';
  import Typography from '@mui/material/Typography';
  import useLocales from 'src/locales/use-locales';
  import FormProvider, { RHFMultiSelect, RHFSwitch, RHFTextField } from 'src/components/hook-form';
  import { useSnackbar } from 'src/components/snackbar';
  import { useCreateTestMutation, useUpdateTestMutation } from '../../api/use-surveys-api';
  import type { Test } from '../../api/types';
  import { buildTestSchema, type TestFormValues } from './utils/test-schema';

  const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: String(i + 1),
  }));

  type Props = {
    open: boolean;
    onClose: VoidFunction;
    test?: Test | null;
    onSaved: (test: Test, mode: 'create' | 'edit') => void;
  };

  export default function TestUpsertDialog({ open, onClose, test, onSaved }: Props) {
    const { tx } = useLocales();
    const { enqueueSnackbar } = useSnackbar();
    const isEdit = Boolean(test);

    const createMutation = useCreateTestMutation();
    const updateMutation = useUpdateTestMutation();

    const defaultValues = useMemo<TestFormValues>(
      () => ({
        title: test?.title ?? '',
        isActive: test?.isActive ?? true,
        isAdminConducted: test?.isAdminConducted ?? false,
        isAfterApplication: test?.isAfterApplication ?? false,
        afterDays: test?.afterDays ?? null,
        testDaysFrom: test?.testDaysFrom ?? null,
        testDaysTo: test?.testDaysTo ?? null,
        month: test?.month ?? [],
      }),
      [test]
    );

    const methods = useForm<TestFormValues>({
      resolver: yupResolver(buildTestSchema(tx)),
      defaultValues,
      mode: 'onChange',
    });

    const {
      reset,
      watch,
      handleSubmit,
      formState: { isSubmitting },
    } = methods;

    useEffect(() => {
      if (open) reset(defaultValues);
    }, [open, defaultValues, reset]);

    const isAfterApplication = watch('isAfterApplication');

    const onSubmit = handleSubmit(async (values) => {
      const payload = {
        title: values.title,
        isActive: values.isActive,
        isAdminConducted: values.isAdminConducted,
        isAfterApplication: values.isAfterApplication,
        afterDays: values.isAfterApplication ? Number(values.afterDays) : null,
        testDaysFrom: values.isAfterApplication ? null : values.testDaysFrom ?? null,
        testDaysTo: values.isAfterApplication ? null : values.testDaysTo ?? null,
        month: values.isAfterApplication ? [] : values.month.map(Number),
      };
      const saved = isEdit
        ? await updateMutation.mutateAsync({ id: (test as Test).id, payload })
        : await createMutation.mutateAsync(payload);
      enqueueSnackbar(tx(isEdit ? 'surveys.tests.toasts.updated' : 'surveys.tests.toasts.created'));
      onSaved(saved, isEdit ? 'edit' : 'create');
      onClose();
    });

    return (
      <Dialog fullWidth maxWidth="sm" open={open} onClose={onClose}>
        <FormProvider methods={methods} onSubmit={onSubmit}>
          <DialogTitle>
            {tx(isEdit ? 'surveys.tests.form.editTitle' : 'surveys.tests.form.createTitle')}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2.5} sx={{ pt: 1 }}>
              <RHFTextField name="title" label={`${tx('surveys.tests.form.title')} *`} autoFocus />
              <RHFSwitch name="isActive" label={tx('surveys.tests.form.active')} />
              <RHFSwitch name="isAdminConducted" label={tx('surveys.tests.form.adminConducted')} />

              <Divider />
              <Typography variant="subtitle2">{tx('surveys.tests.form.scheduling')}</Typography>
              <RHFSwitch name="isAfterApplication" label={tx('surveys.tests.form.afterApplication')} />

              {isAfterApplication ? (
                <RHFTextField
                  name="afterDays"
                  type="number"
                  label={`${tx('surveys.tests.form.afterDays')} *`}
                  InputProps={{ inputProps: { min: 0 } }}
                />
              ) : (
                <Stack spacing={2.5}>
                  <RHFMultiSelect
                    checkbox
                    chip
                    name="month"
                    label={tx('surveys.tests.form.months')}
                    options={MONTH_OPTIONS}
                    placeholder={tx('surveys.tests.form.monthsAny')}
                  />
                  <Stack direction="row" spacing={2}>
                    <RHFTextField
                      name="testDaysFrom"
                      type="number"
                      label={tx('surveys.tests.form.daysFrom')}
                      InputProps={{ inputProps: { min: 1, max: 31 } }}
                    />
                    <RHFTextField
                      name="testDaysTo"
                      type="number"
                      label={tx('surveys.tests.form.daysTo')}
                      InputProps={{ inputProps: { min: 1, max: 31 } }}
                    />
                  </Stack>
                </Stack>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button variant="outlined" color="inherit" onClick={onClose}>
              {tx('common.actions.cancel')}
            </Button>
            <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
              {tx('common.actions.save')}
            </LoadingButton>
          </DialogActions>
        </FormProvider>
      </Dialog>
    );
  }
  ```
  Create `src/sections/app/admin-surveys/tests/components/test-table-row.tsx`:
  ```tsx
  import { useNavigate } from 'react-router-dom';
  import IconButton from '@mui/material/IconButton';
  import MenuItem from '@mui/material/MenuItem';
  import TableCell from '@mui/material/TableCell';
  import TableRow from '@mui/material/TableRow';
  import Typography from '@mui/material/Typography';
  import useLocales from 'src/locales/use-locales';
  import { paths } from 'src/routes/paths';
  import CustomPopover, { usePopover } from 'src/components/custom-popover';
  import Iconify from 'src/components/iconify';
  import Label from 'src/components/label';
  import type { Test } from '../../api/types';

  type Props = {
    row: Test;
    canWrite: boolean;
    onEdit: (test: Test) => void;
    onDelete: (test: Test) => void;
  };

  function scheduleLabel(row: Test, tx: (k: string, o?: Record<string, string | number>) => string) {
    if (row.isAdminConducted) return tx('surveys.tests.schedule.adminConducted');
    if (row.isAfterApplication)
      return tx('surveys.tests.schedule.afterDays', { days: row.afterDays ?? 0 });
    const months = row.month.length ? row.month.join(', ') : tx('surveys.tests.form.monthsAny');
    return tx('surveys.tests.schedule.periodic', {
      months,
      from: row.testDaysFrom ?? 1,
      to: row.testDaysTo ?? row.testDaysFrom ?? 1,
    });
  }

  export default function TestTableRow({ row, canWrite, onEdit, onDelete }: Props) {
    const { tx } = useLocales();
    const popover = usePopover();
    const navigate = useNavigate();

    return (
      <>
        <TableRow hover>
          <TableCell>
            <Typography variant="subtitle2">{row.title}</Typography>
          </TableCell>
          <TableCell>{scheduleLabel(row, tx)}</TableCell>
          <TableCell>
            <Label color={row.isActive ? 'success' : 'default'}>
              {tx(row.isActive ? 'common.status.active' : 'common.status.inactive')}
            </Label>
          </TableCell>
          <TableCell align="right">
            <IconButton onClick={popover.onOpen}>
              <Iconify icon="eva:more-vertical-fill" />
            </IconButton>
          </TableCell>
        </TableRow>

        <CustomPopover open={popover.open} onClose={popover.onClose} arrow="top-right" sx={{ width: 220 }}>
          <MenuItem
            onClick={() => {
              popover.onClose();
              navigate(paths.app.surveys.blocks(row.id));
            }}
          >
            <Iconify icon="solar:list-bold" />
            {tx('surveys.tests.actions.manageBlocks')}
          </MenuItem>
          {canWrite && (
            <MenuItem
              onClick={() => {
                popover.onClose();
                onEdit(row);
              }}
            >
              <Iconify icon="solar:pen-bold" />
              {tx('common.actions.edit')}
            </MenuItem>
          )}
          {canWrite && (
            <MenuItem
              onClick={() => {
                popover.onClose();
                onDelete(row);
              }}
              sx={{ color: 'error.main' }}
            >
              <Iconify icon="solar:trash-bin-trash-bold" />
              {tx('common.actions.delete')}
            </MenuItem>
          )}
        </CustomPopover>
      </>
    );
  }
  ```
  Create `src/sections/app/admin-surveys/tests/components/index.tsx`:
  ```tsx
  export { default as TestUpsertDialog } from './test-upsert-dialog';
  export { default as TestTableRow } from './test-table-row';
  ```
  Create `src/sections/app/admin-surveys/tests/view.tsx`:
  ```tsx
  import { useEffect, useState } from 'react';
  import Button from '@mui/material/Button';
  import Card from '@mui/material/Card';
  import Container from '@mui/material/Container';
  import InputAdornment from '@mui/material/InputAdornment';
  import Stack from '@mui/material/Stack';
  import Table from '@mui/material/Table';
  import TableBody from '@mui/material/TableBody';
  import TableContainer from '@mui/material/TableContainer';
  import TextField from '@mui/material/TextField';
  import { useBoolean } from 'src/hooks/use-boolean';
  import { useDebounce } from 'src/hooks/use-debounce';
  import { useSnackbar } from 'src/components/snackbar';
  import { useUrlListState, useSyncTableWithUrlListState } from 'src/hooks/use-url-query-state';
  import { useCheckPermission } from 'src/auth/hooks';
  import useLocales from 'src/locales/use-locales';
  import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
  import { ConfirmDialog } from 'src/components/custom-dialog';
  import Iconify from 'src/components/iconify';
  import Scrollbar from 'src/components/scrollbar';
  import { useSettingsContext } from 'src/components/settings';
  import { TableHeadCustom, TableNoData, TablePaginationCustom, useTable } from 'src/components/table';
  import { paths } from 'src/routes/paths';
  import { useTestsQuery, useDeleteTestMutation } from '../api/use-surveys-api';
  import type { Test } from '../api/types';
  import { TestUpsertDialog, TestTableRow } from './components';

  const SORTABLE_COLUMNS = ['title', 'created_at'];

  export default function TestsView() {
    const { tx } = useLocales();
    const settings = useSettingsContext();
    const { enqueueSnackbar } = useSnackbar();
    const { canWritePage } = useCheckPermission();
    const canWrite = canWritePage('tests');

    const table = useTable();
    const list = useUrlListState({ defaultPageSize: 15, defaultOrdering: 'title' });
    useSyncTableWithUrlListState({
      page: list.page,
      rowsPerPage: list.rowsPerPage,
      tablePage: table.page,
      tableRowsPerPage: table.rowsPerPage,
      setTablePage: table.setPage,
      setTableRowsPerPage: table.setRowsPerPage,
    });

    const [searchInput, setSearchInput] = useState(list.search);
    const debouncedSearch = useDebounce(searchInput, 400);
    useEffect(() => {
      if (debouncedSearch !== list.search) list.setSearch(debouncedSearch);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearch]);

    const testsQuery = useTestsQuery({
      page: list.page,
      pageSize: list.rowsPerPage,
      ordering: list.ordering,
      ...(list.search ? { search: list.search } : {}),
    });
    const rows = testsQuery.data?.results ?? [];
    const count = testsQuery.data?.count ?? 0;
    const isLoading = testsQuery.isPending;
    const notFound = !isLoading && rows.length === 0;

    const deleteMutation = useDeleteTestMutation();
    const upsertDialog = useBoolean();
    const [editing, setEditing] = useState<Test | null>(null);
    const [deleting, setDeleting] = useState<Test | null>(null);

    const orderBy = list.ordering.startsWith('-') ? list.ordering.slice(1) : list.ordering;
    const order: 'asc' | 'desc' = list.ordering.startsWith('-') ? 'desc' : 'asc';
    const handleSort = (columnId: string) => {
      if (!SORTABLE_COLUMNS.includes(columnId)) return;
      list.setOrdering(orderBy === columnId && order === 'asc' ? `-${columnId}` : columnId);
    };

    const handleSaved = (test: Test, mode: 'create' | 'edit') => {
      if (mode === 'create') testsQuery.addItem(test);
      else testsQuery.updateItem(test);
    };

    const handleConfirmDelete = () => {
      if (!deleting) return;
      deleteMutation.mutate(deleting.id, {
        onSuccess: () => {
          testsQuery.deleteItem(deleting.id);
          enqueueSnackbar(tx('surveys.tests.toasts.deleted'));
          setDeleting(null);
        },
      });
    };

    const headLabel = [
      { id: 'title', label: tx('surveys.tests.table.title') },
      { id: 'schedule', label: tx('surveys.tests.table.schedule'), width: 320 },
      { id: 'is_active', label: tx('surveys.tests.table.status'), width: 120 },
      { id: 'actions', label: '', width: 64, align: 'right' as const },
    ];

    return (
      <Container maxWidth={settings.themeStretch ? false : 'lg'}>
        <CustomBreadcrumbs
          heading={tx('surveys.tests.title')}
          links={[{ name: tx('common.appName'), href: paths.home }, { name: tx('surveys.tests.title') }]}
          action={
            canWrite && (
              <Button
                variant="contained"
                startIcon={<Iconify icon="mingcute:add-line" />}
                onClick={() => {
                  setEditing(null);
                  upsertDialog.onTrue();
                }}
              >
                {tx('surveys.tests.actions.create')}
              </Button>
            )
          }
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        <Card>
          <Stack direction="row" alignItems="center" sx={{ p: 2.5 }}>
            <TextField
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={tx('surveys.tests.searchPlaceholder')}
              size="small"
              sx={{ width: { xs: 1, sm: 320 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
                  </InputAdornment>
                ),
              }}
            />
          </Stack>

          <TableContainer sx={{ position: 'relative', overflow: 'unset' }}>
            <Scrollbar>
              <Table size="medium" sx={{ minWidth: 720 }}>
                <TableHeadCustom order={order} orderBy={orderBy} headLabel={headLabel} onSort={handleSort} />
                <TableBody>
                  {!isLoading &&
                    rows.map((row) => (
                      <TestTableRow
                        key={row.id}
                        row={row}
                        canWrite={canWrite}
                        onEdit={(t) => {
                          setEditing(t);
                          upsertDialog.onTrue();
                        }}
                        onDelete={setDeleting}
                      />
                    ))}
                  <TableNoData notFound={notFound} title={tx('surveys.tests.empty')} />
                </TableBody>
              </Table>
            </Scrollbar>
          </TableContainer>

          <TablePaginationCustom
            count={count}
            page={table.page}
            rowsPerPage={table.rowsPerPage}
            onPageChange={list.handlePageChange}
            onRowsPerPageChange={list.handleRowsPerPageChange}
            rowsPerPageOptions={[15, 25, 50]}
          />
        </Card>

        <TestUpsertDialog
          open={upsertDialog.value}
          onClose={upsertDialog.onFalse}
          test={editing}
          onSaved={handleSaved}
        />

        <ConfirmDialog
          open={Boolean(deleting)}
          onClose={() => setDeleting(null)}
          title={tx('surveys.tests.dialogs.delete.title')}
          content={tx('surveys.tests.dialogs.delete.content')}
          cancelText={tx('common.actions.cancel')}
          action={
            <Button variant="contained" color="error" onClick={handleConfirmDelete} disabled={deleteMutation.isPending}>
              {tx('common.actions.delete')}
            </Button>
          }
        />
      </Container>
    );
  }
  ```
- [ ] **Step 4: Run test to verify it passes**
  `(cd "$FRONT" && CI=true npx react-scripts test src/sections/app/admin-surveys/tests/components/utils/__tests__/test-schema.test.ts --watchAll=false)`
  Expected: PASS (3 tests).
- [ ] **Step 5: Commit**
  ```bash
  cd "$FRONT" && git add -A && git commit -m "feat(admin-surveys): Tests CRUD with scheduling upsert dialog"
  ```

---

### Task 9: Admin — QuestionBlocks per-Test CRUD

**Files:**
- Create: `src/sections/app/admin-surveys/blocks/view.tsx`
- Create: `src/sections/app/admin-surveys/blocks/components/block-upsert-dialog.tsx`
- Test: `src/sections/app/admin-surveys/blocks/components/__tests__/block-upsert-dialog.test.tsx`

**Interfaces:**
- Consumes: `useParams().testId` (route `/surveys/tests/:testId/blocks`); Task 7 block hooks; `paths.app.surveys.questions(blockId)`.
- Produces: `BlocksView` default export; `BlockUpsertDialog` (fields: order number, title text). Blocks are reordered by editing `order`.

- [ ] **Step 1: Write the failing test**
  Create `src/sections/app/admin-surveys/blocks/components/__tests__/block-upsert-dialog.test.tsx`:
  ```tsx
  import { fireEvent, render, screen, waitFor } from 'src/test-utils';

  import BlockUpsertDialog from '../block-upsert-dialog';

  jest.mock('src/locales/use-locales', () => ({
    __esModule: true,
    default: () => ({ tx: (k: string) => k, currentLang: { value: 'ru' } }),
  }));

  const createMock = jest.fn().mockResolvedValue({ id: 1, test: 5, order: 0, title: 'B', createdAt: '' });
  jest.mock('../../../api/use-surveys-api', () => ({
    useCreateQuestionBlockMutation: () => ({ mutateAsync: createMock, isPending: false }),
    useUpdateQuestionBlockMutation: () => ({ mutateAsync: jest.fn(), isPending: false }),
  }));
  jest.mock('src/components/snackbar', () => ({
    useSnackbar: () => ({ enqueueSnackbar: jest.fn() }),
  }));

  describe('BlockUpsertDialog', () => {
    it('creates a block for the given test id', async () => {
      render(
        <BlockUpsertDialog open testId={5} block={null} onClose={jest.fn()} onSaved={jest.fn()} />
      );
      fireEvent.change(screen.getByLabelText(/surveys.blocks.form.title/), {
        target: { value: 'Intro' },
      });
      fireEvent.click(screen.getByText('common.actions.save'));
      await waitFor(() => expect(createMock).toHaveBeenCalled());
      expect(createMock.mock.calls[0][0]).toMatchObject({ test: 5, title: 'Intro' });
    });
  });
  ```
- [ ] **Step 2: Run test to verify it fails**
  `(cd "$FRONT" && CI=true npx react-scripts test src/sections/app/admin-surveys/blocks/components/__tests__/block-upsert-dialog.test.tsx --watchAll=false)`
  Expected: FAIL — `Cannot find module '../block-upsert-dialog'`.
- [ ] **Step 3: Write minimal implementation**
  Create `src/sections/app/admin-surveys/blocks/components/block-upsert-dialog.tsx`:
  ```tsx
  import { useEffect, useMemo } from 'react';
  import { useForm } from 'react-hook-form';
  import { yupResolver } from '@hookform/resolvers/yup';
  import * as Yup from 'yup';
  import LoadingButton from '@mui/lab/LoadingButton';
  import Button from '@mui/material/Button';
  import Dialog from '@mui/material/Dialog';
  import DialogActions from '@mui/material/DialogActions';
  import DialogContent from '@mui/material/DialogContent';
  import DialogTitle from '@mui/material/DialogTitle';
  import Stack from '@mui/material/Stack';
  import useLocales from 'src/locales/use-locales';
  import FormProvider, { RHFTextField } from 'src/components/hook-form';
  import { useSnackbar } from 'src/components/snackbar';
  import {
    useCreateQuestionBlockMutation,
    useUpdateQuestionBlockMutation,
  } from '../../api/use-surveys-api';
  import type { QuestionBlock } from '../../api/types';

  type BlockFormValues = { order: number; title: string };

  type Props = {
    open: boolean;
    onClose: VoidFunction;
    testId: number;
    block?: QuestionBlock | null;
    onSaved: (block: QuestionBlock, mode: 'create' | 'edit') => void;
  };

  export default function BlockUpsertDialog({ open, onClose, testId, block, onSaved }: Props) {
    const { tx } = useLocales();
    const { enqueueSnackbar } = useSnackbar();
    const isEdit = Boolean(block);

    const createMutation = useCreateQuestionBlockMutation();
    const updateMutation = useUpdateQuestionBlockMutation();

    const schema = useMemo(
      () =>
        Yup.object().shape({
          order: Yup.number()
            .transform((v, o) => (o === '' ? 0 : v))
            .min(0)
            .required(),
          title: Yup.string().ensure().max(255),
        }),
      []
    );

    const defaultValues = useMemo<BlockFormValues>(
      () => ({ order: block?.order ?? 0, title: block?.title ?? '' }),
      [block]
    );

    const methods = useForm<BlockFormValues>({
      resolver: yupResolver(schema),
      defaultValues,
      mode: 'onChange',
    });
    const {
      reset,
      handleSubmit,
      formState: { isSubmitting },
    } = methods;

    useEffect(() => {
      if (open) reset(defaultValues);
    }, [open, defaultValues, reset]);

    const onSubmit = handleSubmit(async (values) => {
      const saved = isEdit
        ? await updateMutation.mutateAsync({
            id: (block as QuestionBlock).id,
            payload: { order: values.order, title: values.title },
          })
        : await createMutation.mutateAsync({ test: testId, order: values.order, title: values.title });
      enqueueSnackbar(tx(isEdit ? 'surveys.blocks.toasts.updated' : 'surveys.blocks.toasts.created'));
      onSaved(saved, isEdit ? 'edit' : 'create');
      onClose();
    });

    return (
      <Dialog fullWidth maxWidth="xs" open={open} onClose={onClose}>
        <FormProvider methods={methods} onSubmit={onSubmit}>
          <DialogTitle>
            {tx(isEdit ? 'surveys.blocks.form.editTitle' : 'surveys.blocks.form.createTitle')}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2.5} sx={{ pt: 1 }}>
              <RHFTextField
                name="order"
                type="number"
                label={tx('surveys.blocks.form.order')}
                InputProps={{ inputProps: { min: 0 } }}
              />
              <RHFTextField name="title" label={tx('surveys.blocks.form.title')} autoFocus />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button variant="outlined" color="inherit" onClick={onClose}>
              {tx('common.actions.cancel')}
            </Button>
            <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
              {tx('common.actions.save')}
            </LoadingButton>
          </DialogActions>
        </FormProvider>
      </Dialog>
    );
  }
  ```
  Create `src/sections/app/admin-surveys/blocks/view.tsx`:
  ```tsx
  import { useState } from 'react';
  import { useNavigate, useParams } from 'react-router-dom';
  import Button from '@mui/material/Button';
  import Card from '@mui/material/Card';
  import Container from '@mui/material/Container';
  import IconButton from '@mui/material/IconButton';
  import List from '@mui/material/List';
  import ListItem from '@mui/material/ListItem';
  import ListItemText from '@mui/material/ListItemText';
  import Stack from '@mui/material/Stack';
  import { useBoolean } from 'src/hooks/use-boolean';
  import { useSnackbar } from 'src/components/snackbar';
  import { useCheckPermission } from 'src/auth/hooks';
  import useLocales from 'src/locales/use-locales';
  import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
  import { ConfirmDialog } from 'src/components/custom-dialog';
  import EmptyContent from 'src/components/empty-content';
  import Iconify from 'src/components/iconify';
  import { useSettingsContext } from 'src/components/settings';
  import { paths } from 'src/routes/paths';
  import {
    useQuestionBlocksQuery,
    useDeleteQuestionBlockMutation,
  } from '../api/use-surveys-api';
  import type { QuestionBlock } from '../api/types';
  import { default as BlockUpsertDialog } from './components/block-upsert-dialog';

  export default function BlocksView() {
    const { tx } = useLocales();
    const settings = useSettingsContext();
    const navigate = useNavigate();
    const { enqueueSnackbar } = useSnackbar();
    const { canWritePage } = useCheckPermission();
    const canWrite = canWritePage('tests');

    const { testId: testIdParam } = useParams();
    const testId = Number(testIdParam);

    const blocksQuery = useQuestionBlocksQuery(testId);
    const blocks = blocksQuery.data?.results ?? [];

    const deleteMutation = useDeleteQuestionBlockMutation();
    const dialog = useBoolean();
    const [editing, setEditing] = useState<QuestionBlock | null>(null);
    const [deleting, setDeleting] = useState<QuestionBlock | null>(null);

    const handleSaved = (block: QuestionBlock, mode: 'create' | 'edit') => {
      if (mode === 'create') blocksQuery.addItem(block);
      else blocksQuery.updateItem(block);
    };

    const handleConfirmDelete = () => {
      if (!deleting) return;
      deleteMutation.mutate(deleting.id, {
        onSuccess: () => {
          blocksQuery.deleteItem(deleting.id);
          enqueueSnackbar(tx('surveys.blocks.toasts.deleted'));
          setDeleting(null);
        },
      });
    };

    return (
      <Container maxWidth={settings.themeStretch ? false : 'lg'}>
        <CustomBreadcrumbs
          heading={tx('surveys.blocks.title')}
          links={[
            { name: tx('surveys.tests.title'), href: paths.app.surveys.tests },
            { name: tx('surveys.blocks.title') },
          ]}
          action={
            canWrite && (
              <Button
                variant="contained"
                startIcon={<Iconify icon="mingcute:add-line" />}
                onClick={() => {
                  setEditing(null);
                  dialog.onTrue();
                }}
              >
                {tx('surveys.blocks.actions.create')}
              </Button>
            )
          }
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        <Card>
          {blocks.length === 0 ? (
            <EmptyContent filled title={tx('surveys.blocks.empty')} sx={{ py: 10 }} />
          ) : (
            <List disablePadding>
              {blocks.map((block) => (
                <ListItem
                  key={block.id}
                  divider
                  secondaryAction={
                    <Stack direction="row" spacing={0.5}>
                      <IconButton onClick={() => navigate(paths.app.surveys.questions(block.id))}>
                        <Iconify icon="solar:question-circle-bold" />
                      </IconButton>
                      {canWrite && (
                        <IconButton
                          onClick={() => {
                            setEditing(block);
                            dialog.onTrue();
                          }}
                        >
                          <Iconify icon="solar:pen-bold" />
                        </IconButton>
                      )}
                      {canWrite && (
                        <IconButton color="error" onClick={() => setDeleting(block)}>
                          <Iconify icon="solar:trash-bin-trash-bold" />
                        </IconButton>
                      )}
                    </Stack>
                  }
                >
                  <ListItemText
                    primary={block.title || tx('surveys.blocks.untitled')}
                    secondary={tx('surveys.blocks.orderLabel', { order: block.order })}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Card>

        <BlockUpsertDialog
          open={dialog.value}
          onClose={dialog.onFalse}
          testId={testId}
          block={editing}
          onSaved={handleSaved}
        />

        <ConfirmDialog
          open={Boolean(deleting)}
          onClose={() => setDeleting(null)}
          title={tx('surveys.blocks.dialogs.delete.title')}
          content={tx('surveys.blocks.dialogs.delete.content')}
          cancelText={tx('common.actions.cancel')}
          action={
            <Button variant="contained" color="error" onClick={handleConfirmDelete} disabled={deleteMutation.isPending}>
              {tx('common.actions.delete')}
            </Button>
          }
        />
      </Container>
    );
  }
  ```
- [ ] **Step 4: Run test to verify it passes**
  `(cd "$FRONT" && CI=true npx react-scripts test src/sections/app/admin-surveys/blocks/components/__tests__/block-upsert-dialog.test.tsx --watchAll=false)`
  Expected: PASS (1 test).
- [ ] **Step 5: Commit**
  ```bash
  cd "$FRONT" && git add -A && git commit -m "feat(admin-surveys): per-test QuestionBlocks CRUD"
  ```

---

### Task 10: Admin — Questions per-block CRUD (type selector + dynamic options editor)

**Files:**
- Create: `src/sections/app/admin-surveys/questions/view.tsx`
- Create: `src/sections/app/admin-surveys/questions/components/question-upsert-dialog.tsx`
- Create: `src/sections/app/admin-surveys/questions/components/utils/question-schema.ts`
- Test: `src/sections/app/admin-surveys/questions/components/utils/__tests__/question-schema.test.ts`

**Interfaces:**
- Consumes: `useParams().blockId`; Task 7 question hooks/types; `uuidv4` (`src/utils/uuidv4`) for stable option ids.
- Produces: `QuestionsView` default export; `buildQuestionSchema(tx)` + `QuestionFormValues`; `QuestionUpsertDialog`. Options editor hidden when `type === 'textarea'`; single/multiple require ≥2 options.

- [ ] **Step 1: Write the failing test**
  Create `src/sections/app/admin-surveys/questions/components/utils/__tests__/question-schema.test.ts`:
  ```ts
  import { buildQuestionSchema } from '../question-schema';

  const tx = (k: string) => k;

  describe('question schema', () => {
    it('textarea needs no options', async () => {
      const schema = buildQuestionSchema(tx);
      const value = await schema.validate({
        type: 'textarea', order: 0, text: 'Comments?', options: [],
      });
      expect(value.options).toEqual([]);
    });
    it('single requires at least two options', async () => {
      const schema = buildQuestionSchema(tx);
      await expect(
        schema.validate({
          type: 'single', order: 0, text: 'Pick', options: [{ id: 'a', text: 'A' }],
        })
      ).rejects.toThrow('surveys.questions.validation.minOptions');
    });
    it('single accepts two non-empty options', async () => {
      const schema = buildQuestionSchema(tx);
      const value = await schema.validate({
        type: 'single', order: 0, text: 'Pick',
        options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }],
      });
      expect(value.options).toHaveLength(2);
    });
  });
  ```
- [ ] **Step 2: Run test to verify it fails**
  `(cd "$FRONT" && CI=true npx react-scripts test src/sections/app/admin-surveys/questions/components/utils/__tests__/question-schema.test.ts --watchAll=false)`
  Expected: FAIL — `Cannot find module '../question-schema'`.
- [ ] **Step 3: Write minimal implementation**
  Create `src/sections/app/admin-surveys/questions/components/utils/question-schema.ts`:
  ```ts
  import * as Yup from 'yup';

  import type { QuestionType, TestOption } from '../../../api/types';

  export type QuestionFormValues = {
    type: QuestionType;
    order: number;
    text: string;
    options: TestOption[];
  };

  export function buildQuestionSchema(tx: (key: string) => string) {
    return Yup.object().shape({
      type: Yup.mixed<QuestionType>()
        .oneOf(['single', 'multiple', 'textarea'])
        .required(),
      order: Yup.number()
        .transform((v, o) => (o === '' ? 0 : v))
        .min(0)
        .required(),
      text: Yup.string().trim().required(tx('surveys.questions.validation.textRequired')),
      options: Yup.array()
        .of(
          Yup.object().shape({
            id: Yup.string().required(),
            text: Yup.string().trim().required(tx('surveys.questions.validation.optionText')),
          })
        )
        .when('type', {
          is: (type: QuestionType) => type === 'single' || type === 'multiple',
          then: (s) => s.min(2, tx('surveys.questions.validation.minOptions')),
          otherwise: (s) => s.max(0),
        })
        .required(),
    });
  }
  ```
  Create `src/sections/app/admin-surveys/questions/components/question-upsert-dialog.tsx`:
  ```tsx
  import { useEffect, useMemo } from 'react';
  import { useFieldArray, useForm } from 'react-hook-form';
  import { yupResolver } from '@hookform/resolvers/yup';
  import LoadingButton from '@mui/lab/LoadingButton';
  import Button from '@mui/material/Button';
  import Dialog from '@mui/material/Dialog';
  import DialogActions from '@mui/material/DialogActions';
  import DialogContent from '@mui/material/DialogContent';
  import DialogTitle from '@mui/material/DialogTitle';
  import IconButton from '@mui/material/IconButton';
  import MenuItem from '@mui/material/MenuItem';
  import Stack from '@mui/material/Stack';
  import Typography from '@mui/material/Typography';
  import useLocales from 'src/locales/use-locales';
  import { uuidv4 } from 'src/utils/uuidv4';
  import FormProvider, { RHFSelect, RHFTextField } from 'src/components/hook-form';
  import Iconify from 'src/components/iconify';
  import { useSnackbar } from 'src/components/snackbar';
  import { useCreateQuestionMutation, useUpdateQuestionMutation } from '../../api/use-surveys-api';
  import type { Question, QuestionType } from '../../api/types';
  import { buildQuestionSchema, type QuestionFormValues } from './utils/question-schema';

  const TYPE_OPTIONS: QuestionType[] = ['single', 'multiple', 'textarea'];

  type Props = {
    open: boolean;
    onClose: VoidFunction;
    blockId: number;
    question?: Question | null;
    onSaved: (question: Question, mode: 'create' | 'edit') => void;
  };

  export default function QuestionUpsertDialog({ open, onClose, blockId, question, onSaved }: Props) {
    const { tx } = useLocales();
    const { enqueueSnackbar } = useSnackbar();
    const isEdit = Boolean(question);

    const createMutation = useCreateQuestionMutation();
    const updateMutation = useUpdateQuestionMutation();

    const defaultValues = useMemo<QuestionFormValues>(
      () => ({
        type: question?.type ?? 'single',
        order: question?.order ?? 0,
        text: question?.text ?? '',
        options: question?.options ?? [],
      }),
      [question]
    );

    const methods = useForm<QuestionFormValues>({
      resolver: yupResolver(buildQuestionSchema(tx)),
      defaultValues,
      mode: 'onChange',
    });
    const {
      reset,
      watch,
      control,
      handleSubmit,
      formState: { isSubmitting },
    } = methods;
    const { fields, append, remove } = useFieldArray({ control, name: 'options' });

    useEffect(() => {
      if (open) reset(defaultValues);
    }, [open, defaultValues, reset]);

    const type = watch('type');
    const showOptions = type === 'single' || type === 'multiple';

    const onSubmit = handleSubmit(async (values) => {
      const payload = {
        block: blockId,
        type: values.type,
        order: values.order,
        text: values.text,
        options: values.type === 'textarea' ? [] : values.options,
      };
      const saved = isEdit
        ? await updateMutation.mutateAsync({ id: (question as Question).id, payload })
        : await createMutation.mutateAsync(payload);
      enqueueSnackbar(
        tx(isEdit ? 'surveys.questions.toasts.updated' : 'surveys.questions.toasts.created')
      );
      onSaved(saved, isEdit ? 'edit' : 'create');
      onClose();
    });

    return (
      <Dialog fullWidth maxWidth="sm" open={open} onClose={onClose}>
        <FormProvider methods={methods} onSubmit={onSubmit}>
          <DialogTitle>
            {tx(isEdit ? 'surveys.questions.form.editTitle' : 'surveys.questions.form.createTitle')}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2.5} sx={{ pt: 1 }}>
              <RHFSelect name="type" label={tx('surveys.questions.form.type')}>
                {TYPE_OPTIONS.map((t) => (
                  <MenuItem key={t} value={t}>
                    {tx(`surveys.questions.types.${t}`)}
                  </MenuItem>
                ))}
              </RHFSelect>

              <RHFTextField
                name="order"
                type="number"
                label={tx('surveys.questions.form.order')}
                InputProps={{ inputProps: { min: 0 } }}
              />

              <RHFTextField
                name="text"
                label={`${tx('surveys.questions.form.text')} *`}
                multiline
                minRows={2}
              />

              {showOptions && (
                <Stack spacing={1.5}>
                  <Typography variant="subtitle2">{tx('surveys.questions.form.options')}</Typography>
                  {fields.map((field, index) => (
                    <Stack key={field.id} direction="row" spacing={1} alignItems="center">
                      <RHFTextField
                        name={`options.${index}.text`}
                        label={tx('surveys.questions.form.optionLabel', { n: index + 1 })}
                        size="small"
                        fullWidth
                      />
                      <IconButton color="error" onClick={() => remove(index)}>
                        <Iconify icon="solar:trash-bin-trash-bold" />
                      </IconButton>
                    </Stack>
                  ))}
                  <Button
                    size="small"
                    startIcon={<Iconify icon="mingcute:add-line" />}
                    onClick={() => append({ id: uuidv4(), text: '' })}
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    {tx('surveys.questions.actions.addOption')}
                  </Button>
                </Stack>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button variant="outlined" color="inherit" onClick={onClose}>
              {tx('common.actions.cancel')}
            </Button>
            <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
              {tx('common.actions.save')}
            </LoadingButton>
          </DialogActions>
        </FormProvider>
      </Dialog>
    );
  }
  ```
  Create `src/sections/app/admin-surveys/questions/view.tsx`:
  ```tsx
  import { useState } from 'react';
  import { useParams } from 'react-router-dom';
  import Button from '@mui/material/Button';
  import Card from '@mui/material/Card';
  import Chip from '@mui/material/Chip';
  import Container from '@mui/material/Container';
  import IconButton from '@mui/material/IconButton';
  import List from '@mui/material/List';
  import ListItem from '@mui/material/ListItem';
  import ListItemText from '@mui/material/ListItemText';
  import Stack from '@mui/material/Stack';
  import { useBoolean } from 'src/hooks/use-boolean';
  import { useSnackbar } from 'src/components/snackbar';
  import { useCheckPermission } from 'src/auth/hooks';
  import useLocales from 'src/locales/use-locales';
  import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
  import { ConfirmDialog } from 'src/components/custom-dialog';
  import EmptyContent from 'src/components/empty-content';
  import Iconify from 'src/components/iconify';
  import { useSettingsContext } from 'src/components/settings';
  import { paths } from 'src/routes/paths';
  import { useQuestionsQuery, useDeleteQuestionMutation } from '../api/use-surveys-api';
  import type { Question } from '../api/types';
  import { default as QuestionUpsertDialog } from './components/question-upsert-dialog';

  export default function QuestionsView() {
    const { tx } = useLocales();
    const settings = useSettingsContext();
    const { enqueueSnackbar } = useSnackbar();
    const { canWritePage } = useCheckPermission();
    const canWrite = canWritePage('questions');

    const { blockId: blockIdParam } = useParams();
    const blockId = Number(blockIdParam);

    const questionsQuery = useQuestionsQuery(blockId);
    const questions = questionsQuery.data?.results ?? [];

    const deleteMutation = useDeleteQuestionMutation();
    const dialog = useBoolean();
    const [editing, setEditing] = useState<Question | null>(null);
    const [deleting, setDeleting] = useState<Question | null>(null);

    const handleSaved = (q: Question, mode: 'create' | 'edit') => {
      if (mode === 'create') questionsQuery.addItem(q);
      else questionsQuery.updateItem(q);
    };
    const handleConfirmDelete = () => {
      if (!deleting) return;
      deleteMutation.mutate(deleting.id, {
        onSuccess: () => {
          questionsQuery.deleteItem(deleting.id);
          enqueueSnackbar(tx('surveys.questions.toasts.deleted'));
          setDeleting(null);
        },
      });
    };

    return (
      <Container maxWidth={settings.themeStretch ? false : 'lg'}>
        <CustomBreadcrumbs
          heading={tx('surveys.questions.title')}
          links={[
            { name: tx('surveys.tests.title'), href: paths.app.surveys.tests },
            { name: tx('surveys.questions.title') },
          ]}
          action={
            canWrite && (
              <Button
                variant="contained"
                startIcon={<Iconify icon="mingcute:add-line" />}
                onClick={() => {
                  setEditing(null);
                  dialog.onTrue();
                }}
              >
                {tx('surveys.questions.actions.create')}
              </Button>
            )
          }
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        <Card>
          {questions.length === 0 ? (
            <EmptyContent filled title={tx('surveys.questions.empty')} sx={{ py: 10 }} />
          ) : (
            <List disablePadding>
              {questions.map((q) => (
                <ListItem
                  key={q.id}
                  divider
                  secondaryAction={
                    canWrite && (
                      <Stack direction="row" spacing={0.5}>
                        <IconButton
                          onClick={() => {
                            setEditing(q);
                            dialog.onTrue();
                          }}
                        >
                          <Iconify icon="solar:pen-bold" />
                        </IconButton>
                        <IconButton color="error" onClick={() => setDeleting(q)}>
                          <Iconify icon="solar:trash-bin-trash-bold" />
                        </IconButton>
                      </Stack>
                    )
                  }
                >
                  <ListItemText
                    primary={q.text}
                    secondary={
                      <Chip
                        size="small"
                        label={tx(`surveys.questions.types.${q.type}`)}
                        sx={{ mt: 0.5 }}
                      />
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Card>

        <QuestionUpsertDialog
          open={dialog.value}
          onClose={dialog.onFalse}
          blockId={blockId}
          question={editing}
          onSaved={handleSaved}
        />

        <ConfirmDialog
          open={Boolean(deleting)}
          onClose={() => setDeleting(null)}
          title={tx('surveys.questions.dialogs.delete.title')}
          content={tx('surveys.questions.dialogs.delete.content')}
          cancelText={tx('common.actions.cancel')}
          action={
            <Button variant="contained" color="error" onClick={handleConfirmDelete} disabled={deleteMutation.isPending}>
              {tx('common.actions.delete')}
            </Button>
          }
        />
      </Container>
    );
  }
  ```
- [ ] **Step 4: Run test to verify it passes**
  `(cd "$FRONT" && CI=true npx react-scripts test src/sections/app/admin-surveys/questions/components/utils/__tests__/question-schema.test.ts --watchAll=false)`
  Expected: PASS (3 tests).
- [ ] **Step 5: Commit**
  ```bash
  cd "$FRONT" && git add -A && git commit -m "feat(admin-surveys): per-block Questions CRUD with type + options editor"
  ```

---

### Task 11: Admin — Survey Results (aggregate counts + textarea list + XLSX export)

**Files:**
- Create: `src/sections/app/admin-surveys/results/view.tsx`
- Create: `src/sections/app/admin-surveys/results/components/question-result-card.tsx`
- Test: `src/sections/app/admin-surveys/results/components/__tests__/question-result-card.test.tsx`

**Interfaces:**
- Consumes: Task 7 `useSurveyResultsQuery`, `useExportSurveyResultsMutation`, `useTestOptionsQuery`; `downloadBlob` (`src/utils/download-file`); types `SurveyResults`, `QuestionResult`.
- Produces: `SurveyResultsView` default export; `QuestionResultCard` renders per-option counts (single/multiple) or a textarea-answer list — no scoring/pass-fail.

- [ ] **Step 1: Write the failing test**
  Create `src/sections/app/admin-surveys/results/components/__tests__/question-result-card.test.tsx`:
  ```tsx
  import { render, screen } from 'src/test-utils';

  import QuestionResultCard from '../question-result-card';

  jest.mock('src/locales/use-locales', () => ({
    __esModule: true,
    default: () => ({ tx: (k: string) => k, currentLang: { value: 'ru' } }),
  }));

  describe('QuestionResultCard', () => {
    it('renders per-option counts for a single-choice question', () => {
      render(
        <QuestionResultCard
          result={{
            question: 1, text: 'Favourite?', type: 'single',
            options: [
              { id: 'a', text: 'Tea', count: 4 },
              { id: 'b', text: 'Coffee', count: 7 },
            ],
          }}
        />
      );
      expect(screen.getByText('Favourite?')).toBeInTheDocument();
      expect(screen.getByText('Tea')).toBeInTheDocument();
      expect(screen.getByText('7')).toBeInTheDocument();
    });

    it('lists free-text answers for a textarea question', () => {
      render(
        <QuestionResultCard
          result={{
            question: 2, text: 'Comments?', type: 'textarea',
            textAnswers: ['Great place', 'Needs more parking'],
          }}
        />
      );
      expect(screen.getByText('Great place')).toBeInTheDocument();
      expect(screen.getByText('Needs more parking')).toBeInTheDocument();
    });
  });
  ```
- [ ] **Step 2: Run test to verify it fails**
  `(cd "$FRONT" && CI=true npx react-scripts test src/sections/app/admin-surveys/results/components/__tests__/question-result-card.test.tsx --watchAll=false)`
  Expected: FAIL — `Cannot find module '../question-result-card'`.
- [ ] **Step 3: Write minimal implementation**
  Create `src/sections/app/admin-surveys/results/components/question-result-card.tsx`:
  ```tsx
  import Box from '@mui/material/Box';
  import Card from '@mui/material/Card';
  import LinearProgress from '@mui/material/LinearProgress';
  import Stack from '@mui/material/Stack';
  import Typography from '@mui/material/Typography';
  import useLocales from 'src/locales/use-locales';
  import type { QuestionResult } from '../../api/types';

  type Props = { result: QuestionResult };

  export default function QuestionResultCard({ result }: Props) {
    const { tx } = useLocales();
    const totalCount = (result.options ?? []).reduce((sum, o) => sum + o.count, 0);

    return (
      <Card sx={{ p: 3 }}>
        <Typography variant="subtitle1" sx={{ mb: 2 }}>
          {result.text}
        </Typography>

        {result.type !== 'textarea' && (
          <Stack spacing={1.5}>
            {(result.options ?? []).map((option) => {
              const pct = totalCount ? Math.round((option.count / totalCount) * 100) : 0;
              return (
                <Box key={option.id}>
                  <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                    <Typography variant="body2">{option.text}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {option.count} ({pct}%)
                    </Typography>
                  </Stack>
                  <LinearProgress variant="determinate" value={pct} />
                </Box>
              );
            })}
          </Stack>
        )}

        {result.type === 'textarea' && (
          <Stack spacing={1}>
            {(result.textAnswers ?? []).length === 0 && (
              <Typography variant="body2" color="text.disabled">
                {tx('surveys.results.noAnswers')}
              </Typography>
            )}
            {(result.textAnswers ?? []).map((answer, i) => (
              <Box
                key={i}
                sx={{ p: 1.5, borderRadius: 1, bgcolor: 'background.neutral', fontSize: 14 }}
              >
                {answer}
              </Box>
            ))}
          </Stack>
        )}
      </Card>
    );
  }
  ```
  Create `src/sections/app/admin-surveys/results/view.tsx`:
  ```tsx
  import { useState } from 'react';
  import Button from '@mui/material/Button';
  import Card from '@mui/material/Card';
  import Container from '@mui/material/Container';
  import MenuItem from '@mui/material/MenuItem';
  import Stack from '@mui/material/Stack';
  import TextField from '@mui/material/TextField';
  import Typography from '@mui/material/Typography';
  import { useSnackbar } from 'src/components/snackbar';
  import useLocales from 'src/locales/use-locales';
  import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
  import EmptyContent from 'src/components/empty-content';
  import Iconify from 'src/components/iconify';
  import { useSettingsContext } from 'src/components/settings';
  import { downloadBlob } from 'src/utils/download-file';
  import { paths } from 'src/routes/paths';
  import {
    useExportSurveyResultsMutation,
    useSurveyResultsQuery,
    useTestOptionsQuery,
  } from '../api/use-surveys-api';
  import { default as QuestionResultCard } from './components/question-result-card';

  export default function SurveyResultsView() {
    const { tx } = useLocales();
    const settings = useSettingsContext();
    const { enqueueSnackbar } = useSnackbar();

    const [testId, setTestId] = useState<number | ''>('');
    const testOptionsQuery = useTestOptionsQuery();
    const testOptions = testOptionsQuery.data?.results ?? [];

    const resultsQuery = useSurveyResultsQuery(testId === '' ? null : { test: testId });
    const results = resultsQuery.data;

    const exportMutation = useExportSurveyResultsMutation();

    const handleExport = () => {
      if (testId === '') return;
      exportMutation.mutate(
        { test: testId },
        {
          onSuccess: (blob) => {
            downloadBlob(blob, `survey-results-${testId}.xlsx`);
            enqueueSnackbar(tx('surveys.results.toasts.exported'));
          },
        }
      );
    };

    return (
      <Container maxWidth={settings.themeStretch ? false : 'lg'}>
        <CustomBreadcrumbs
          heading={tx('surveys.results.title')}
          links={[{ name: tx('common.appName'), href: paths.home }, { name: tx('surveys.results.title') }]}
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        <Card sx={{ p: 2.5, mb: 3 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
            <TextField
              select
              label={tx('surveys.results.selectTest')}
              value={testId}
              onChange={(e) => setTestId(e.target.value === '' ? '' : Number(e.target.value))}
              sx={{ minWidth: 280 }}
            >
              {testOptions.map((test) => (
                <MenuItem key={test.id} value={test.id}>
                  {test.title}
                </MenuItem>
              ))}
            </TextField>

            <Button
              variant="contained"
              disabled={testId === '' || exportMutation.isPending}
              startIcon={<Iconify icon="solar:export-bold" />}
              onClick={handleExport}
              sx={{ ml: { sm: 'auto' } }}
            >
              {tx('common.actions.export')}
            </Button>
          </Stack>
        </Card>

        {testId === '' && (
          <EmptyContent filled title={tx('surveys.results.pickTestPrompt')} sx={{ py: 10 }} />
        )}

        {results && (
          <Stack spacing={3}>
            <Typography variant="body2" color="text.secondary">
              {tx('surveys.results.sessionCount', { count: results.sessionCount })}
            </Typography>
            {results.questions.map((question) => (
              <QuestionResultCard key={question.question} result={question} />
            ))}
          </Stack>
        )}
      </Container>
    );
  }
  ```
- [ ] **Step 4: Run test to verify it passes**
  `(cd "$FRONT" && CI=true npx react-scripts test src/sections/app/admin-surveys/results/components/__tests__/question-result-card.test.tsx --watchAll=false)`
  Expected: PASS (2 tests).
- [ ] **Step 5: Commit**
  ```bash
  cd "$FRONT" && git add -A && git commit -m "feat(admin-surveys): SurveyResults aggregate view + XLSX export"
  ```

---

### Task 12: Admin — pages, routes, navigation wiring

**Files:**
- Create: `src/pages/app/survey-tests.tsx`, `src/pages/app/survey-blocks.tsx`, `src/pages/app/survey-questions.tsx`, `src/pages/app/survey-results.tsx`
- Modify: `src/routes/sections/dashboard.tsx` (full rewrite of lazy imports + children)
- Modify: `src/layouts/dashboard/config-navigation.tsx` (rewrite `useNavData`)
- Test: `src/routes/sections/__tests__/dashboard-routes.test.tsx`

**Interfaces:**
- Consumes: the four admin views + `paths.app.surveys.*`; kiosk pages arrive in Task 18 (imported here as placeholders resolved later — this task only wires admin + employees + specialties + home; kiosk route is added in Task 18).
- Produces: dashboard routes for `surveys/tests`, `surveys/tests/:testId/blocks`, `surveys/blocks/:blockId/questions`, `surveys/results`, guarded by `surveys`/`questions`/`results` pages; nav groups Management + Surveys.

- [ ] **Step 1: Write the failing test**
  Create `src/routes/sections/__tests__/dashboard-routes.test.tsx`:
  ```tsx
  import { dashboardRoutes } from '../dashboard';

  function paths(children: any[]): string[] {
    return children.map((c) => c.path).filter(Boolean);
  }

  describe('dashboardRoutes', () => {
    it('registers the survey admin routes and drops depo routes', () => {
      const children = dashboardRoutes[0].children;
      const p = paths(children);
      expect(p).toContain('surveys/tests');
      expect(p).toContain('surveys/tests/:testId/blocks');
      expect(p).toContain('surveys/blocks/:blockId/questions');
      expect(p).toContain('surveys/results');
      expect(p).not.toContain('medical');
      expect(p).not.toContain('testing');
    });
  });
  ```
- [ ] **Step 2: Run test to verify it fails**
  `(cd "$FRONT" && CI=true npx react-scripts test src/routes/sections/__tests__/dashboard-routes.test.tsx --watchAll=false)`
  Expected: FAIL — still contains `medical`/`testing` (or import error from deleted pages).
- [ ] **Step 3: Write minimal implementation**
  Create the four page wrappers (same shape; shown for one — replicate with the matching view import/title):
  `src/pages/app/survey-tests.tsx`:
  ```tsx
  import { Helmet } from 'react-helmet-async';
  import useLocales from 'src/locales/use-locales';
  import TestsView from 'src/sections/app/admin-surveys/tests/view';

  export default function SurveyTestsPage() {
    const { tx } = useLocales();
    return (
      <>
        <Helmet>
          <title>{`${tx('surveys.tests.title')} | ${tx('common.appName')}`}</title>
        </Helmet>
        <TestsView />
      </>
    );
  }
  ```
  `src/pages/app/survey-blocks.tsx` → import `BlocksView from 'src/sections/app/admin-surveys/blocks/view'`, title `surveys.blocks.title`.
  `src/pages/app/survey-questions.tsx` → import `QuestionsView from 'src/sections/app/admin-surveys/questions/view'`, title `surveys.questions.title`.
  `src/pages/app/survey-results.tsx` → import `SurveyResultsView from 'src/sections/app/admin-surveys/results/view'`, title `surveys.results.title`.
  Replace `src/routes/sections/dashboard.tsx` entirely:
  ```tsx
  import { Suspense, lazy } from 'react';
  import { Outlet } from 'react-router-dom';
  import { AuthGuard, PermissionGuard } from 'src/auth/guard';
  import DashboardLayout from 'src/layouts/dashboard';
  import { LoadingScreen } from 'src/components/loading-screen';

  const HomePage = lazy(() => import('src/pages/home'));
  const EmployeesPage = lazy(() => import('src/pages/app/employees'));
  const SpecialtiesPage = lazy(() => import('src/pages/app/specialties'));
  const SurveyTestsPage = lazy(() => import('src/pages/app/survey-tests'));
  const SurveyBlocksPage = lazy(() => import('src/pages/app/survey-blocks'));
  const SurveyQuestionsPage = lazy(() => import('src/pages/app/survey-questions'));
  const SurveyResultsPage = lazy(() => import('src/pages/app/survey-results'));

  export const dashboardRoutes = [
    {
      element: (
        <AuthGuard>
          <DashboardLayout>
            <Suspense fallback={<LoadingScreen />}>
              <Outlet />
            </Suspense>
          </DashboardLayout>
        </AuthGuard>
      ),
      children: [
        { path: 'home', element: <HomePage /> },
        {
          path: 'employees',
          element: (
            <PermissionGuard page="employees" action="read">
              <EmployeesPage />
            </PermissionGuard>
          ),
        },
        {
          path: 'specialties',
          element: (
            <PermissionGuard page="specialties" action="read">
              <SpecialtiesPage />
            </PermissionGuard>
          ),
        },
        {
          path: 'surveys/tests',
          element: (
            <PermissionGuard page="tests" action="read">
              <SurveyTestsPage />
            </PermissionGuard>
          ),
        },
        {
          path: 'surveys/tests/:testId/blocks',
          element: (
            <PermissionGuard page="tests" action="read">
              <SurveyBlocksPage />
            </PermissionGuard>
          ),
        },
        {
          path: 'surveys/blocks/:blockId/questions',
          element: (
            <PermissionGuard page="questions" action="read">
              <SurveyQuestionsPage />
            </PermissionGuard>
          ),
        },
        {
          path: 'surveys/results',
          element: (
            <PermissionGuard page="results" action="read">
              <SurveyResultsPage />
            </PermissionGuard>
          ),
        },
      ],
    },
  ];
  ```
  Replace `useNavData` in `src/layouts/dashboard/config-navigation.tsx` (keep the `icon` helper, `NavItem`/`NavGroup` types and imports at the top):
  ```tsx
  export function useNavData() {
    const { tx } = useLocales();
    const { canReadPage, canWritePage } = useCheckPermission();

    return useMemo(() => {
      const groups: NavGroup[] = [];

      const managementItems: NavItem[] = [];
      if (canReadPage('employees') && canWritePage('employees')) {
        managementItems.push({
          title: tx('common.navigation.employees'),
          path: paths.app.employees,
          icon: icon('solar:users-group-rounded-bold-duotone'),
        });
      }
      if (canReadPage('specialties')) {
        managementItems.push({
          title: tx('common.navigation.specialties'),
          path: paths.app.specialties,
          icon: icon('solar:case-minimalistic-bold-duotone'),
        });
      }
      if (managementItems.length) {
        groups.push({ subheader: tx('common.navigation.management'), items: managementItems });
      }

      const surveyItems: NavItem[] = [];
      if (canReadPage('tests')) {
        surveyItems.push({
          title: tx('common.navigation.surveys'),
          path: paths.app.surveys.tests,
          icon: icon('solar:clipboard-list-bold-duotone'),
        });
      }
      if (canReadPage('results')) {
        surveyItems.push({
          title: tx('common.navigation.results'),
          path: paths.app.surveys.results,
          icon: icon('solar:chart-square-bold-duotone'),
        });
      }
      if (surveyItems.length) {
        groups.push({ subheader: tx('common.navigation.surveysGroup'), items: surveyItems });
      }

      return groups;
    }, [canReadPage, canWritePage, tx]);
  }
  ```
- [ ] **Step 4: Run test to verify it passes**
  `(cd "$FRONT" && CI=true npx react-scripts test src/routes/sections/__tests__/dashboard-routes.test.tsx --watchAll=false)`
  Expected: PASS (1 test).
- [ ] **Step 5: Commit**
  ```bash
  cd "$FRONT" && git add -A && git commit -m "feat(admin-surveys): pages, dashboard routes, nav wiring"
  ```

---

### Task 13: Kiosk — API layer (identify / due / start / submit)

**Files:**
- Create: `src/sections/app/survey-kiosk/api/types.ts`
- Create: `src/sections/app/survey-kiosk/api/survey-requests.ts`
- Create: `src/sections/app/survey-kiosk/api/use-survey-kiosk-api.ts`
- Test: `src/sections/app/survey-kiosk/api/__tests__/survey-requests.test.ts`

**Interfaces:**
- Consumes: `API_ENDPOINTS.surveys.{identify,due,start,submit}` (Task 2); `Test` (admin types Task 7); `Employee` (employees types); `fetchEmployees` (employees requests).
- Produces (Plan 2 exact shapes): `SurveyOption={id:string;text:string}`; `SurveyQuestion={id;type:QuestionType;order;text;options:SurveyOption[]}`; `SurveyBlock={id;order;title;questions:SurveyQuestion[]}`; `SurveySession={id;test;employee;employeeName;faceVerified;startedAt;completedAt;requiresSubmitReverify}`; `StartSurveyResponse={session;test:Test;blocks:SurveyBlock[]}`; `SubmitAnswerItem={question:number;selectedOptionIds?:string[];textValue?:string}`; `SubmitSurveyPayload={answers:SubmitAnswerItem[];faceImage?:string}`; hooks `useKioskEmployeesQuery`, `useIdentifyEmployeeMutation`, `useDueSurveysQuery`, `useStartSurveyMutation`, `useSubmitSurveyMutation`.

- [ ] **Step 1: Write the failing test**
  Create `src/sections/app/survey-kiosk/api/__tests__/survey-requests.test.ts`:
  ```ts
  import { API_ENDPOINTS } from 'src/lib/api/endpoints';

  import * as requests from '../survey-requests';

  jest.mock('src/utils/axios', () => ({
    API_ENDPOINTS: jest.requireActual('src/lib/api/endpoints').API_ENDPOINTS,
    request: jest.fn().mockResolvedValue({ ok: true }),
  }));
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { request } = require('src/utils/axios');

  describe('survey-kiosk requests', () => {
    beforeEach(() => (request as jest.Mock).mockClear());

    it('identify posts multipart face_image (snake_case)', async () => {
      const file = new File(['x'], 'f.jpg', { type: 'image/jpeg' });
      await requests.identifyEmployee({ faceImage: file });
      const call = (request as jest.Mock).mock.calls[0][0];
      expect(call.url).toBe(API_ENDPOINTS.surveys.identify);
      expect(call.data instanceof FormData).toBe(true);
      expect((call.data as FormData).get('face_image')).toBe(file);
    });

    it('fetchDueSurveys passes employee param', async () => {
      await requests.fetchDueSurveys(9);
      const call = (request as jest.Mock).mock.calls[0][0];
      expect(call.url).toBe(API_ENDPOINTS.surveys.due);
      expect(call.params).toEqual({ employee: 9 });
    });

    it('startSurvey posts employee/test/face_image as FormData', async () => {
      const file = new File(['x'], 'f.jpg', { type: 'image/jpeg' });
      await requests.startSurvey({ employee: 2, test: 5, faceImage: file });
      const call = (request as jest.Mock).mock.calls[0][0];
      expect(call.url).toBe(API_ENDPOINTS.surveys.start);
      const fd = call.data as FormData;
      expect(fd.get('employee')).toBe('2');
      expect(fd.get('test')).toBe('5');
      expect(fd.get('face_image')).toBe(file);
    });

    it('submitSurvey posts JSON answers to the submit action', async () => {
      await requests.submitSurvey(7, {
        answers: [{ question: 1, selectedOptionIds: ['a'] }, { question: 2, textValue: 'hi' }],
      });
      const call = (request as jest.Mock).mock.calls[0][0];
      expect(call.url).toBe(API_ENDPOINTS.surveys.submit(7));
      expect(call.data.answers).toHaveLength(2);
    });
  });
  ```
- [ ] **Step 2: Run test to verify it fails**
  `(cd "$FRONT" && CI=true npx react-scripts test src/sections/app/survey-kiosk/api/__tests__/survey-requests.test.ts --watchAll=false)`
  Expected: FAIL — `Cannot find module '../survey-requests'`.
- [ ] **Step 3: Write minimal implementation**
  Create `src/sections/app/survey-kiosk/api/types.ts`:
  ```ts
  import type { Employee } from '../../employees/api/types';
  import type { QuestionType, Test } from '../../admin-surveys/api/types';

  export type { Employee, Test, QuestionType };

  export type SurveyOption = { id: string; text: string };

  /** Frozen question set returned by `start/` (correct answers never exist). */
  export type SurveyQuestion = {
    id: number;
    type: QuestionType;
    order: number;
    text: string;
    options: SurveyOption[];
  };

  export type SurveyBlock = {
    id: number;
    order: number;
    title: string;
    questions: SurveyQuestion[];
  };

  /** Matches Plan 2 `SurveySessionSerializer` (camelCase). No score/passed. */
  export type SurveySession = {
    id: number;
    test: number;
    employee: number;
    employeeName: string;
    faceVerified: boolean;
    startedAt: string;
    completedAt: string | null;
    /** True only when DECOR_REVERIFY_ON_SUBMIT is on (default off for surveys). */
    requiresSubmitReverify: boolean;
  };

  export type IdentifyEmployeePayload = { faceImage: File };
  export type IdentifyEmployeeResponse = { employee: Employee };

  export type StartSurveyPayload = { employee: number; test: number; faceImage: File };
  export type StartSurveyResponse = { session: SurveySession; test: Test; blocks: SurveyBlock[] };

  export type SubmitAnswerItem = {
    question: number;
    selectedOptionIds?: string[];
    textValue?: string;
  };

  export type SubmitSurveyPayload = {
    answers: SubmitAnswerItem[];
    /** Base64 data-URL frame for submit-time re-verification (omitted when off). */
    faceImage?: string;
  };
  ```
  Create `src/sections/app/survey-kiosk/api/survey-requests.ts`:
  ```ts
  import { request, API_ENDPOINTS } from 'src/utils/axios';

  import type { Test } from '../../admin-surveys/api/types';
  import type {
    IdentifyEmployeePayload,
    IdentifyEmployeeResponse,
    StartSurveyPayload,
    StartSurveyResponse,
    SubmitSurveyPayload,
    SurveySession,
  } from './types';

  /** 1:N face search — no session created. Multipart bypasses camelCase transform. */
  export function identifyEmployee(payload: IdentifyEmployeePayload) {
    const formData = new FormData();
    formData.append('face_image', payload.faceImage);
    return request<IdentifyEmployeeResponse>({
      method: 'POST',
      url: API_ENDPOINTS.surveys.identify,
      data: formData,
    });
  }

  /** Surveys currently due for an employee (spec §4.2). */
  export function fetchDueSurveys(employeeId: number) {
    return request<Test[]>({
      method: 'GET',
      url: API_ENDPOINTS.surveys.due,
      params: { employee: employeeId },
    });
  }

  /** Face-ID gate + session creation; returns the frozen block/question set. */
  export function startSurvey(payload: StartSurveyPayload) {
    const formData = new FormData();
    formData.append('employee', String(payload.employee));
    formData.append('test', String(payload.test));
    formData.append('face_image', payload.faceImage);
    return request<StartSurveyResponse>({
      method: 'POST',
      url: API_ENDPOINTS.surveys.start,
      data: formData,
    });
  }

  /** Persist answers + set completed_at. JSON body (camelCase → snake_case by client). */
  export function submitSurvey(sessionId: number, payload: SubmitSurveyPayload) {
    return request<SurveySession>({
      method: 'POST',
      url: API_ENDPOINTS.surveys.submit(sessionId),
      data: payload,
    });
  }
  ```
  Create `src/sections/app/survey-kiosk/api/use-survey-kiosk-api.ts`:
  ```ts
  import { keepPreviousData } from '@tanstack/react-query';

  import { useFetch, useMutate } from 'src/hooks/api';

  import { fetchEmployees } from '../../employees/api/employees-requests';
  import type { EmployeeListParams } from '../../employees/api/types';
  import type { Test } from '../../admin-surveys/api/types';
  import {
    fetchDueSurveys,
    identifyEmployee,
    startSurvey,
    submitSurvey,
  } from './survey-requests';
  import type {
    IdentifyEmployeePayload,
    IdentifyEmployeeResponse,
    StartSurveyPayload,
    StartSurveyResponse,
    SubmitSurveyPayload,
    SurveySession,
  } from './types';

  export function useKioskEmployeesQuery(params: EmployeeListParams) {
    return useFetch(['kiosk', 'employees', params], () => fetchEmployees(params), {
      placeholderData: keepPreviousData,
    });
  }

  export function useIdentifyEmployeeMutation() {
    return useMutate<IdentifyEmployeeResponse, IdentifyEmployeePayload>(
      (payload) => identifyEmployee(payload),
      { skipGlobalErrorNotification: true }
    );
  }

  export function useDueSurveysQuery(employeeId: number | null) {
    return useFetch<Test[]>(
      ['kiosk', 'due', employeeId],
      () => fetchDueSurveys(employeeId as number),
      { enabled: employeeId !== null }
    );
  }

  export function useStartSurveyMutation() {
    return useMutate<StartSurveyResponse, StartSurveyPayload>((payload) => startSurvey(payload), {
      skipGlobalErrorNotification: true,
    });
  }

  export function useSubmitSurveyMutation() {
    return useMutate<SurveySession, { sessionId: number; payload: SubmitSurveyPayload }>(
      ({ sessionId, payload }) => submitSurvey(sessionId, payload),
      { skipGlobalErrorNotification: true }
    );
  }
  ```
- [ ] **Step 4: Run test to verify it passes**
  `(cd "$FRONT" && CI=true npx react-scripts test src/sections/app/survey-kiosk/api/__tests__/survey-requests.test.ts --watchAll=false)`
  Expected: PASS (4 tests).
- [ ] **Step 5: Commit**
  ```bash
  cd "$FRONT" && git add -A && git commit -m "feat(survey-kiosk): api layer (identify/due/start/submit)"
  ```

---

### Task 14: Kiosk — copy verbatim visual shell from the depo reference

Copies the unchanged presentational pieces (three.js background, cursor glow, panel shell, skeleton, employee search step) from `$REF` and repoints their imports to the kiosk api/skeleton. The camera util (`src/utils/camera.ts`) is already present in decor (kept by Plan 1).

**Files:**
- Create (copied verbatim): `src/sections/app/survey-kiosk/components/three-bg.tsx`, `.../cursor-glow.tsx`
- Create (copied + repointed): `src/sections/app/survey-kiosk/components/survey-panel.tsx` (from `testing-panel.tsx`), `.../employee-step.tsx`, `src/sections/app/survey-kiosk/skeleton/index.tsx`
- Test: `src/sections/app/survey-kiosk/components/__tests__/employee-step.test.tsx`

**Interfaces:**
- Consumes: `useKioskEmployeesQuery` (Task 13); `Employee` type.
- Produces: `ThreeBg`, `CursorGlow`, `SurveyPanel`, `EmployeeStep` (prop `onSelect(employee)`), `SurveyEmployeesGridSkeleton`.

- [ ] **Step 1: Write the failing test**
  Create `src/sections/app/survey-kiosk/components/__tests__/employee-step.test.tsx`:
  ```tsx
  import { render, screen } from 'src/test-utils';

  import EmployeeStep from '../employee-step';

  jest.mock('src/locales/use-locales', () => ({
    __esModule: true,
    default: () => ({ tx: (k: string) => k, currentLang: { value: 'ru' } }),
  }));

  const employees = [
    { id: 1, fullName: 'Ivan Petrov', specialtyName: 'Fitter', photo: null },
    { id: 2, fullName: 'Olga Sern', specialtyName: 'Painter', photo: null },
  ];
  jest.mock('../../api/use-survey-kiosk-api', () => ({
    useKioskEmployeesQuery: () => ({
      data: { results: employees, count: 2 },
      isPending: false,
    }),
  }));

  describe('kiosk EmployeeStep', () => {
    it('lists active employees for selection', () => {
      render(<EmployeeStep onSelect={jest.fn()} />);
      expect(screen.getByText('Ivan Petrov')).toBeInTheDocument();
      expect(screen.getByText('Olga Sern')).toBeInTheDocument();
    });
  });
  ```
- [ ] **Step 2: Run test to verify it fails**
  `(cd "$FRONT" && CI=true npx react-scripts test src/sections/app/survey-kiosk/components/__tests__/employee-step.test.tsx --watchAll=false)`
  Expected: FAIL — `Cannot find module '../employee-step'`.
- [ ] **Step 3: Write minimal implementation**
  Copy verbatim + repoint:
  ```bash
  cd "$FRONT/src/sections/app/survey-kiosk"
  mkdir -p components skeleton
  cp "$REF/src/sections/app/testing/components/three-bg.tsx" components/three-bg.tsx
  cp "$REF/src/sections/app/testing/components/cursor-glow.tsx" components/cursor-glow.tsx
  cp "$REF/src/sections/app/testing/components/testing-panel.tsx" components/survey-panel.tsx
  cp "$REF/src/sections/app/testing/components/employee-step.tsx" components/employee-step.tsx
  cp "$REF/src/sections/app/testing/skeleton/index.tsx" skeleton/index.tsx
  ```
  Edit `components/survey-panel.tsx`:
  - Rename the component: `export default function TestingPanel` → `export default function SurveyPanel`.
  - Replace i18n keys `tx('testing.title')` (both occurrences) → `tx('survey.kiosk.title')`.
  Edit `skeleton/index.tsx`: rename the exported skeleton `TestingEmployeesGridSkeleton` → `SurveyEmployeesGridSkeleton` (keep any other exports as-is; if the file exports multiple skeletons, only rename that one).
  Edit `components/employee-step.tsx`:
  - Import: `import { useKioskEmployeesQuery } from '../api/use-survey-kiosk-api';` (replace the `useTestingEmployeesQuery` import from `../api/use-testing-api`).
  - Import skeleton: `import { SurveyEmployeesGridSkeleton } from '../skeleton';` (replace `TestingEmployeesGridSkeleton`).
  - Replace call sites `useTestingEmployeesQuery(` → `useKioskEmployeesQuery(` and `<TestingEmployeesGridSkeleton` → `<SurveyEmployeesGridSkeleton`.
  - Replace i18n keys `testing.employee.*` / `testing.steps.employee` → `survey.kiosk.employee.*` / `survey.kiosk.steps.employee`.
- [ ] **Step 4: Run test to verify it passes**
  `(cd "$FRONT" && CI=true npx react-scripts test src/sections/app/survey-kiosk/components/__tests__/employee-step.test.tsx --watchAll=false)`
  Expected: PASS (1 test).
- [ ] **Step 5: Commit**
  ```bash
  cd "$FRONT" && git add -A && git commit -m "feat(survey-kiosk): copy verbatim three-bg/cursor-glow/panel/skeleton/employee-step"
  ```

---

### Task 15: Kiosk — FaceIdStep adapted to identify-only (remove ModuleSelector + start)

Reuses the full biometric-scanner visual (getUserMedia lifecycle, `captureFrame`, rotating arcs/sweep — **verbatim**). Removes `ModuleSelector` and the start-session logic; the step now identifies an employee and hands the identified employee + captured frame back to the flow, which continues to the due-surveys list. The captured `Blob` is reused for `start/` after the survey is chosen.

**Files:**
- Create (copied + adapted): `src/sections/app/survey-kiosk/components/face-id-step.tsx`
- Test: `src/sections/app/survey-kiosk/components/__tests__/face-id-step.test.tsx`

**Interfaces:**
- Consumes: `useIdentifyEmployeeMutation` (Task 13); `captureFrame` (`src/utils/camera`); `Employee`.
- Produces: `FaceIdStep` with props `{ onIdentified: (employee: Employee, faceBlob: Blob) => void; onBack: () => void }`.

- [ ] **Step 1: Write the failing test**
  Create `src/sections/app/survey-kiosk/components/__tests__/face-id-step.test.tsx`:
  ```tsx
  import { fireEvent, render, screen, waitFor } from 'src/test-utils';

  import FaceIdStep from '../face-id-step';

  jest.mock('src/locales/use-locales', () => ({
    __esModule: true,
    default: () => ({ tx: (k: string) => k, currentLang: { value: 'ru' } }),
  }));

  const blob = new Blob(['x'], { type: 'image/jpeg' });
  jest.mock('src/utils/camera', () => ({
    captureFrame: jest.fn().mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' })),
    blobToBase64: jest.fn().mockResolvedValue('data:image/jpeg;base64,x'),
  }));

  const identified = { id: 3, fullName: 'Ivan', specialtyName: 'Fitter', photo: null };
  const identifyMutate = jest.fn((_vars, opts) => opts.onSuccess({ employee: identified }));
  jest.mock('../../api/use-survey-kiosk-api', () => ({
    useIdentifyEmployeeMutation: () => ({ mutate: identifyMutate, isPending: false }),
  }));
  jest.mock('src/auth/api', () => ({ useLogoutMutation: () => ({ mutateAsync: jest.fn(), isPending: false }) }));

  beforeAll(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: jest.fn().mockResolvedValue({ getTracks: () => [] }) },
    });
  });

  describe('kiosk FaceIdStep', () => {
    it('identifies then hands the employee + blob to onIdentified', async () => {
      const onIdentified = jest.fn();
      render(<FaceIdStep onIdentified={onIdentified} onBack={jest.fn()} />);

      fireEvent.click(screen.getByText('survey.kiosk.faceId.scan'));
      await waitFor(() => expect(identifyMutate).toHaveBeenCalled());

      fireEvent.click(screen.getByText('survey.kiosk.faceId.continue'));
      expect(onIdentified).toHaveBeenCalledWith(identified, expect.any(Blob));
    });
  });
  ```
- [ ] **Step 2: Run test to verify it fails**
  `(cd "$FRONT" && CI=true npx react-scripts test src/sections/app/survey-kiosk/components/__tests__/face-id-step.test.tsx --watchAll=false)`
  Expected: FAIL — `Cannot find module '../face-id-step'`.
- [ ] **Step 3: Write minimal implementation**
  Copy the reference file, then apply the edits below:
  ```bash
  cp "$REF/src/sections/app/testing/components/face-id-step.tsx" \
     "$FRONT/src/sections/app/survey-kiosk/components/face-id-step.tsx"
  ```
  Apply these exact edits to `survey-kiosk/components/face-id-step.tsx` (the large biometric-scanner JSX between the top bar and bottom controls stays **verbatim**):
  1. **Imports** — replace the two type/hook import lines:
     - Delete `import type { StartTestSessionResponse, TestModule } from '../api/types';`
     - Replace `import { useIdentifyEmployeeMutation, useStartTestSessionMutation } from '../api/use-testing-api';` with `import { useIdentifyEmployeeMutation } from '../api/use-survey-kiosk-api';`
     - Keep `import type { Employee } from '../../employees/api/types';`
  2. **Delete** the `MODULES` const (the `const MODULES: Array<...> = [ ... ];` block) and the entire `function ModuleSelector({ ... }) { ... }` definition.
  3. **Props type** — replace:
     ```tsx
     type Props = {
       onIdentified: (employee: Employee, faceBlob: Blob) => void;
       onBack: () => void;
     };
     ```
  4. **Signature** — replace `export default function FaceIdStep({ onStarted, onBack }: Props) {` with `export default function FaceIdStep({ onIdentified, onBack }: Props) {`.
  5. **State** — delete `const [module, setModule] = useState<TestModule>('specialty');` and `const [startError, setStartError] = useState<string | null>(null);` and `const startMutation = useStartTestSessionMutation();`.
  6. **handleRescan** — remove the `setStartError(null);` line.
  7. **Replace `handleStartTest`** with a continue handler:
     ```tsx
     const handleContinue = useCallback(() => {
       if (!identifiedEmployee || !capturedBlob) return;
       onIdentified(identifiedEmployee, capturedBlob);
     }, [identifiedEmployee, capturedBlob, onIdentified]);
     ```
  8. **Derived** — delete `const isStarting = startMutation.isPending;`. Anywhere `isStarting` is referenced in `disabled={... || isStarting}`, drop the `|| isStarting` term.
  9. **Module selector render** — in the top-bar right stack, delete the `<ModuleSelector value={module} onChange={setModule} disabled={isIdentifying || isStarting} />` element and the `<Divider ... />` immediately after it (keep `<LanguagePopover />` and the logout `IconButton`).
  10. **Start error alert** — delete the `{startError && ( <Alert ...>{startError}</Alert> )}` block in the error area (keep `cameraError` and `identifyError`). Also change the guard `{(cameraError || identifyError || startError) && (` → `{(cameraError || identifyError) && (`, and the instruction-text guard `!startError &&` term is removed.
  11. **Bottom "Start Test" button** — replace the `isIdentified` `LoadingButton` (the one with `loading={isStarting}` / `onClick={handleStartTest}` / label `tx('testing.faceId.startTest')`) with:
      ```tsx
          {isIdentified && (
            <LoadingButton
              variant="contained"
              size="large"
              startIcon={<Iconify icon="solar:arrow-right-bold" />}
              onClick={handleContinue}
              sx={{
                px: 4,
                background: `linear-gradient(135deg, ${green} 0%, ${alpha(green, 0.7)} 100%)`,
                boxShadow: `0 0 24px ${alpha(green, 0.45)}`,
                '&:hover': {
                  background: `linear-gradient(135deg, ${theme.palette.success.dark} 0%, ${green} 100%)`,
                  boxShadow: `0 0 36px ${alpha(green, 0.65)}`,
                },
              }}
            >
              {tx('survey.kiosk.faceId.continue')}
            </LoadingButton>
          )}
      ```
  12. **i18n keys** — replace every remaining `tx('testing.…')` with the `survey.kiosk.…` equivalent (`testing.faceId.*` → `survey.kiosk.faceId.*`; `testing.steps.faceId` → `survey.kiosk.steps.faceId`). Leave `common.actions.*` keys untouched. Remove the `tx('testing.faceId.dailyLimit')` branch if present (surveys have no daily limit) — the `onError` for identify only sets `errorReader(err)`.
- [ ] **Step 4: Run test to verify it passes**
  `(cd "$FRONT" && CI=true npx react-scripts test src/sections/app/survey-kiosk/components/__tests__/face-id-step.test.tsx --watchAll=false)`
  Expected: PASS (1 test).
- [ ] **Step 5: Commit**
  ```bash
  cd "$FRONT" && git add -A && git commit -m "feat(survey-kiosk): FaceIdStep identify-only (drop ModuleSelector + start)"
  ```

---

### Task 16: Kiosk — DueSurveysStep (new)

**Files:**
- Create: `src/sections/app/survey-kiosk/components/due-surveys-step.tsx`
- Test: `src/sections/app/survey-kiosk/components/__tests__/due-surveys-step.test.tsx`

**Interfaces:**
- Consumes: `Test` type (admin); receives `tests: Test[]`, `isLoading: boolean`, `employeeName: string`, `onPick: (test: Test) => void`, `onBack: () => void`. (The parent view runs `useDueSurveysQuery`.)
- Produces: `DueSurveysStep` default export — a list of due surveys; empty state when none.

- [ ] **Step 1: Write the failing test**
  Create `src/sections/app/survey-kiosk/components/__tests__/due-surveys-step.test.tsx`:
  ```tsx
  import { fireEvent, render, screen } from 'src/test-utils';

  import DueSurveysStep from '../due-surveys-step';

  jest.mock('src/locales/use-locales', () => ({
    __esModule: true,
    default: () => ({ tx: (k: string) => k, currentLang: { value: 'ru' } }),
  }));

  const tests = [
    { id: 1, title: 'Onboarding 30d', isActive: true, isAdminConducted: false, isAfterApplication: true, afterDays: 30, testDaysFrom: null, testDaysTo: null, month: [], createdAt: '' },
    { id: 2, title: 'Monthly Pulse', isActive: true, isAdminConducted: false, isAfterApplication: false, afterDays: null, testDaysFrom: 1, testDaysTo: 7, month: [1], createdAt: '' },
  ];

  describe('DueSurveysStep', () => {
    it('renders due surveys and fires onPick', () => {
      const onPick = jest.fn();
      render(
        <DueSurveysStep tests={tests as any} isLoading={false} employeeName="Ivan" onPick={onPick} onBack={jest.fn()} />
      );
      expect(screen.getByText('Onboarding 30d')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Monthly Pulse'));
      expect(onPick).toHaveBeenCalledWith(tests[1]);
    });

    it('shows the empty state when nothing is due', () => {
      render(
        <DueSurveysStep tests={[]} isLoading={false} employeeName="Ivan" onPick={jest.fn()} onBack={jest.fn()} />
      );
      expect(screen.getByText('survey.kiosk.due.empty')).toBeInTheDocument();
    });
  });
  ```
- [ ] **Step 2: Run test to verify it fails**
  `(cd "$FRONT" && CI=true npx react-scripts test src/sections/app/survey-kiosk/components/__tests__/due-surveys-step.test.tsx --watchAll=false)`
  Expected: FAIL — `Cannot find module '../due-surveys-step'`.
- [ ] **Step 3: Write minimal implementation**
  Create `src/sections/app/survey-kiosk/components/due-surveys-step.tsx`:
  ```tsx
  import Box from '@mui/material/Box';
  import Button from '@mui/material/Button';
  import Card from '@mui/material/Card';
  import CardActionArea from '@mui/material/CardActionArea';
  import CircularProgress from '@mui/material/CircularProgress';
  import Stack from '@mui/material/Stack';
  import Typography from '@mui/material/Typography';
  import useLocales from 'src/locales/use-locales';
  import EmptyContent from 'src/components/empty-content';
  import Iconify from 'src/components/iconify';
  import type { Test } from '../../admin-surveys/api/types';

  type Props = {
    tests: Test[];
    isLoading: boolean;
    employeeName: string;
    onPick: (test: Test) => void;
    onBack: () => void;
  };

  export default function DueSurveysStep({ tests, isLoading, employeeName, onPick, onBack }: Props) {
    const { tx } = useLocales();

    return (
      <Stack spacing={3} sx={{ px: { xs: 3, md: 6 }, py: { xs: 4, md: 6 }, maxWidth: 720, mx: 'auto', width: 1 }}>
        <Stack spacing={0.5}>
          <Typography variant="overline" sx={{ color: 'text.secondary' }}>
            {tx('survey.kiosk.due.subtitle', { name: employeeName })}
          </Typography>
          <Typography variant="h4">{tx('survey.kiosk.due.title')}</Typography>
        </Stack>

        {isLoading && (
          <Stack alignItems="center" sx={{ py: 6 }}>
            <CircularProgress />
          </Stack>
        )}

        {!isLoading && tests.length === 0 && (
          <EmptyContent filled title={tx('survey.kiosk.due.empty')} sx={{ py: 8 }} />
        )}

        {!isLoading &&
          tests.map((test) => (
            <Card key={test.id} variant="outlined">
              <CardActionArea onClick={() => onPick(test)} sx={{ p: 3 }}>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: 1.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: 'primary.lighter',
                      color: 'primary.main',
                    }}
                  >
                    <Iconify icon="solar:clipboard-list-bold-duotone" width={24} />
                  </Box>
                  <Typography variant="subtitle1" sx={{ flex: 1 }}>
                    {test.title}
                  </Typography>
                  <Iconify icon="eva:arrow-ios-forward-fill" />
                </Stack>
              </CardActionArea>
            </Card>
          ))}

        <Button color="inherit" onClick={onBack} startIcon={<Iconify icon="eva:arrow-ios-back-fill" />} sx={{ alignSelf: 'flex-start' }}>
          {tx('common.actions.back')}
        </Button>
      </Stack>
    );
  }
  ```
- [ ] **Step 4: Run test to verify it passes**
  `(cd "$FRONT" && CI=true npx react-scripts test src/sections/app/survey-kiosk/components/__tests__/due-surveys-step.test.tsx --watchAll=false)`
  Expected: PASS (2 tests).
- [ ] **Step 5: Commit**
  ```bash
  cd "$FRONT" && git add -A && git commit -m "feat(survey-kiosk): DueSurveysStep list"
  ```

---

### Task 17: Kiosk — QuestionStep generalized (single=radio / multiple=checkbox / textarea; no TTS)

New component (the depo `question-step.tsx` is not copied — all TTS/audio/equalizer removed). Renders one flattened question at a time with progress + prev/next + framer-motion, per the three survey types.

**Files:**
- Create: `src/sections/app/survey-kiosk/components/question-step.tsx`
- Test: `src/sections/app/survey-kiosk/components/__tests__/question-step.test.tsx`

**Interfaces:**
- Consumes: `SurveyQuestion` (Task 13 types).
- Produces: `type KioskAnswer = { selectedOptionIds?: string[]; textValue?: string }` (exported); `QuestionStep` props `{ questions: SurveyQuestion[]; answers: Record<number, KioskAnswer>; onAnswer: (questionId: number, answer: KioskAnswer) => void; onSubmit: () => void; isSubmitting: boolean }`. `single` requires exactly one option, `multiple` ≥1 option, `textarea` optional.

- [ ] **Step 1: Write the failing test**
  Create `src/sections/app/survey-kiosk/components/__tests__/question-step.test.tsx`:
  ```tsx
  import { useState } from 'react';

  import { fireEvent, render, screen } from 'src/test-utils';

  import type { SurveyQuestion } from '../../api/types';
  import QuestionStep, { type KioskAnswer } from '../question-step';

  jest.mock('src/locales/use-locales', () => ({
    __esModule: true,
    default: () => ({ tx: (k: string) => k, currentLang: { value: 'ru' } }),
  }));

  const questions: SurveyQuestion[] = [
    { id: 1, type: 'single', order: 0, text: 'Pick one?', options: [{ id: 'a', text: 'Alpha' }, { id: 'b', text: 'Beta' }] },
    { id: 2, type: 'textarea', order: 1, text: 'Comments?', options: [] },
  ];

  function Harness({ onSubmit }: { onSubmit: () => void }) {
    const [answers, setAnswers] = useState<Record<number, KioskAnswer>>({});
    return (
      <QuestionStep
        questions={questions}
        answers={answers}
        onAnswer={(id, a) => setAnswers((prev) => ({ ...prev, [id]: a }))}
        onSubmit={onSubmit}
        isSubmitting={false}
      />
    );
  }

  describe('kiosk QuestionStep', () => {
    it('single-choice keeps Next disabled until one option is picked', () => {
      render(<Harness onSubmit={jest.fn()} />);
      expect(screen.getByText('Pick one?')).toBeInTheDocument();
      const next = screen.getByText('common.actions.next').closest('button');
      expect(next).toBeDisabled();
      fireEvent.click(screen.getByText('Alpha'));
      expect(next).toBeEnabled();
    });

    it('reaches the textarea question and submits', async () => {
      const onSubmit = jest.fn();
      render(<Harness onSubmit={onSubmit} />);
      fireEvent.click(screen.getByText('Alpha'));
      fireEvent.click(screen.getByText('common.actions.next'));
      expect(await screen.findByText('Comments?')).toBeInTheDocument();
      // textarea is optional → submit enabled immediately
      fireEvent.click(screen.getByText('common.actions.submit'));
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
  });
  ```
- [ ] **Step 2: Run test to verify it fails**
  `(cd "$FRONT" && CI=true npx react-scripts test src/sections/app/survey-kiosk/components/__tests__/question-step.test.tsx --watchAll=false)`
  Expected: FAIL — `Cannot find module '../question-step'`.
- [ ] **Step 3: Write minimal implementation**
  Create `src/sections/app/survey-kiosk/components/question-step.tsx`:
  ```tsx
  import { useState } from 'react';
  import Box from '@mui/material/Box';
  import Button from '@mui/material/Button';
  import Checkbox from '@mui/material/Checkbox';
  import FormControlLabel from '@mui/material/FormControlLabel';
  import LoadingButton from '@mui/lab/LoadingButton';
  import Radio from '@mui/material/Radio';
  import RadioGroup from '@mui/material/RadioGroup';
  import Stack from '@mui/material/Stack';
  import TextField from '@mui/material/TextField';
  import Typography from '@mui/material/Typography';
  import { alpha, useTheme } from '@mui/material/styles';
  import { AnimatePresence, m } from 'framer-motion';
  import useLocales from 'src/locales/use-locales';
  import Iconify from 'src/components/iconify';
  import type { SurveyQuestion } from '../api/types';

  export type KioskAnswer = { selectedOptionIds?: string[]; textValue?: string };

  type Props = {
    questions: SurveyQuestion[];
    answers: Record<number, KioskAnswer>;
    onAnswer: (questionId: number, answer: KioskAnswer) => void;
    onSubmit: () => void;
    isSubmitting: boolean;
  };

  const variants = {
    enter: (dir: number) => ({ opacity: 0, x: dir * 32 }),
    center: { opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
    exit: (dir: number) => ({ opacity: 0, x: dir * -32, transition: { duration: 0.2 } }),
  };

  function isAnswered(q: SurveyQuestion, a: KioskAnswer | undefined): boolean {
    if (q.type === 'textarea') return true; // optional
    if (q.type === 'single') return (a?.selectedOptionIds?.length ?? 0) === 1;
    return (a?.selectedOptionIds?.length ?? 0) >= 1; // multiple
  }

  export default function QuestionStep({ questions, answers, onAnswer, onSubmit, isSubmitting }: Props) {
    const { tx } = useLocales();
    const theme = useTheme();
    const p = theme.palette.primary.main;
    const isDark = theme.palette.mode === 'dark';

    const [index, setIndex] = useState(0);
    const [direction, setDirection] = useState(1);

    const question = questions[index];
    const total = questions.length;
    const isLast = index === total - 1;
    const answer = question ? answers[question.id] : undefined;
    const canProceed = question ? isAnswered(question, answer) : false;

    if (!question) return null;

    const handleSingle = (optionId: string) => onAnswer(question.id, { selectedOptionIds: [optionId] });
    const handleMultiple = (optionId: string) => {
      const current = new Set(answer?.selectedOptionIds ?? []);
      if (current.has(optionId)) current.delete(optionId);
      else current.add(optionId);
      onAnswer(question.id, { selectedOptionIds: Array.from(current) });
    };
    const handleText = (value: string) => onAnswer(question.id, { textValue: value });

    const handleNext = () => {
      if (!canProceed) return;
      if (isLast) {
        onSubmit();
        return;
      }
      setDirection(1);
      setIndex((prev) => prev + 1);
    };
    const handleBack = () => {
      setDirection(-1);
      setIndex((prev) => Math.max(0, prev - 1));
    };

    return (
      <Stack spacing={4} sx={{ maxWidth: 740, mx: 'auto', width: 1 }}>
        {/* Progress */}
        <Stack spacing={1.5}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {tx('survey.kiosk.questions.progress', { current: index + 1, total })}
            </Typography>
          </Stack>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {Array.from({ length: total }, (_, i) => (
              <Box
                key={i}
                sx={{
                  flex: 1,
                  height: 4,
                  borderRadius: 2,
                  transition: 'background-color 0.35s ease',
                  bgcolor: (() => {
                    if (i < index) return alpha(p, 0.5);
                    if (i === index) return p;
                    return alpha(p, isDark ? 0.1 : 0.08);
                  })(),
                }}
              />
            ))}
          </Box>
        </Stack>

        {/* Question + answer controls */}
        <AnimatePresence mode="wait" custom={direction}>
          <m.div key={question.id} custom={direction} variants={variants} initial="enter" animate="center" exit="exit">
            <Stack spacing={3}>
              <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1.45 }}>
                {question.text}
              </Typography>

              {question.type === 'single' && (
                <RadioGroup
                  value={answer?.selectedOptionIds?.[0] ?? ''}
                  onChange={(e) => handleSingle(e.target.value)}
                >
                  {question.options.map((option) => (
                    <FormControlLabel key={option.id} value={option.id} control={<Radio />} label={option.text} />
                  ))}
                </RadioGroup>
              )}

              {question.type === 'multiple' && (
                <Stack>
                  {question.options.map((option) => (
                    <FormControlLabel
                      key={option.id}
                      control={
                        <Checkbox
                          checked={(answer?.selectedOptionIds ?? []).includes(option.id)}
                          onChange={() => handleMultiple(option.id)}
                        />
                      }
                      label={option.text}
                    />
                  ))}
                </Stack>
              )}

              {question.type === 'textarea' && (
                <TextField
                  multiline
                  minRows={4}
                  fullWidth
                  placeholder={tx('survey.kiosk.questions.textPlaceholder')}
                  value={answer?.textValue ?? ''}
                  onChange={(e) => handleText(e.target.value)}
                />
              )}
            </Stack>
          </m.div>
        </AnimatePresence>

        {/* Navigation */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Button
            variant="text"
            color="inherit"
            disabled={index === 0}
            startIcon={<Iconify icon="eva:arrow-ios-back-fill" />}
            onClick={handleBack}
            sx={{ color: 'text.secondary' }}
          >
            {tx('common.actions.back')}
          </Button>

          <LoadingButton
            variant="contained"
            size="large"
            loading={isSubmitting}
            disabled={!canProceed}
            endIcon={!isLast ? <Iconify icon="eva:arrow-ios-forward-fill" /> : undefined}
            onClick={handleNext}
          >
            {tx(isLast ? 'common.actions.submit' : 'common.actions.next')}
          </LoadingButton>
        </Stack>
      </Stack>
    );
  }
  ```
- [ ] **Step 4: Run test to verify it passes**
  `(cd "$FRONT" && CI=true npx react-scripts test src/sections/app/survey-kiosk/components/__tests__/question-step.test.tsx --watchAll=false)`
  Expected: PASS (2 tests).
- [ ] **Step 5: Commit**
  ```bash
  cd "$FRONT" && git add -A && git commit -m "feat(survey-kiosk): generalized QuestionStep (single/multiple/textarea, no TTS)"
  ```

---

### Task 18: Kiosk — ThankYouStep (new, replaces result-step)

**Files:**
- Create: `src/sections/app/survey-kiosk/components/thank-you-step.tsx`
- Test: `src/sections/app/survey-kiosk/components/__tests__/thank-you-step.test.tsx`

**Interfaces:**
- Consumes: nothing (pure presentational).
- Produces: `ThankYouStep` props `{ employeeName: string; onFinish: () => void }` — a simple confirmation, no score/pass-fail.

- [ ] **Step 1: Write the failing test**
  Create `src/sections/app/survey-kiosk/components/__tests__/thank-you-step.test.tsx`:
  ```tsx
  import { fireEvent, render, screen } from 'src/test-utils';

  import ThankYouStep from '../thank-you-step';

  jest.mock('src/locales/use-locales', () => ({
    __esModule: true,
    default: () => ({ tx: (k: string) => k, currentLang: { value: 'ru' } }),
  }));

  describe('ThankYouStep', () => {
    it('shows the thank-you message and fires onFinish', () => {
      const onFinish = jest.fn();
      render(<ThankYouStep employeeName="Ivan" onFinish={onFinish} />);
      expect(screen.getByText('survey.kiosk.thankYou.title')).toBeInTheDocument();
      fireEvent.click(screen.getByText('survey.kiosk.thankYou.finish'));
      expect(onFinish).toHaveBeenCalledTimes(1);
    });
  });
  ```
- [ ] **Step 2: Run test to verify it fails**
  `(cd "$FRONT" && CI=true npx react-scripts test src/sections/app/survey-kiosk/components/__tests__/thank-you-step.test.tsx --watchAll=false)`
  Expected: FAIL — `Cannot find module '../thank-you-step'`.
- [ ] **Step 3: Write minimal implementation**
  Create `src/sections/app/survey-kiosk/components/thank-you-step.tsx`:
  ```tsx
  import Box from '@mui/material/Box';
  import Button from '@mui/material/Button';
  import Stack from '@mui/material/Stack';
  import Typography from '@mui/material/Typography';
  import { m } from 'framer-motion';
  import useLocales from 'src/locales/use-locales';
  import Iconify from 'src/components/iconify';

  type Props = { employeeName: string; onFinish: () => void };

  export default function ThankYouStep({ employeeName, onFinish }: Props) {
    const { tx } = useLocales();

    return (
      <Stack spacing={4} alignItems="center" textAlign="center" sx={{ py: { xs: 6, md: 10 } }}>
        <m.div
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        >
          <Box
            sx={{
              width: 100,
              height: 100,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'success.lighter',
              color: 'success.main',
            }}
          >
            <Iconify icon="solar:check-circle-bold-duotone" width={64} />
          </Box>
        </m.div>

        <Stack spacing={1}>
          <Typography variant="h3">{tx('survey.kiosk.thankYou.title')}</Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            {tx('survey.kiosk.thankYou.subtitle', { name: employeeName })}
          </Typography>
        </Stack>

        <Button
          variant="contained"
          size="large"
          startIcon={<Iconify icon="solar:home-2-bold" />}
          onClick={onFinish}
          sx={{ px: 5 }}
        >
          {tx('survey.kiosk.thankYou.finish')}
        </Button>
      </Stack>
    );
  }
  ```
- [ ] **Step 4: Run test to verify it passes**
  `(cd "$FRONT" && CI=true npx react-scripts test src/sections/app/survey-kiosk/components/__tests__/thank-you-step.test.tsx --watchAll=false)`
  Expected: PASS (1 test).
- [ ] **Step 5: Commit**
  ```bash
  cd "$FRONT" && git add -A && git commit -m "feat(survey-kiosk): ThankYouStep confirmation"
  ```

---

### Task 19: Kiosk — orchestration views, barrel, pages, routes, nav

Wires the flow: EmployeeStep → FaceIdStep (fullscreen) → DueSurveysStep → `start/` → (navigate with location-state) → QuestionStep → `submit/` → ThankYouStep.

**Files:**
- Create: `src/sections/app/survey-kiosk/components/index.tsx`
- Create: `src/sections/app/survey-kiosk/entry-view.tsx`
- Create: `src/sections/app/survey-kiosk/answer-view.tsx`
- Create: `src/pages/app/survey-kiosk-entry.tsx`, `src/pages/app/survey-kiosk-answer.tsx`
- Modify: `src/routes/sections/dashboard.tsx` (add kiosk lazy imports + 2 children)
- Modify: `src/layouts/dashboard/config-navigation.tsx` (add kiosk nav item)
- Test: `src/sections/app/survey-kiosk/__tests__/entry-view.test.tsx`

**Interfaces:**
- Consumes: all kiosk components (Tasks 14-18) + hooks (Task 13); `paths.app.kiosk.*`; `errorReader`; `useSnackbar`.
- Produces: `KioskEntryView`, `KioskAnswerView` default exports; guarded route `kiosk` + `kiosk/answer` (`page="survey" action="submit"`); nav item.

- [ ] **Step 1: Write the failing test**
  Create `src/sections/app/survey-kiosk/__tests__/entry-view.test.tsx`:
  ```tsx
  import { render, screen } from 'src/test-utils';

  import KioskEntryView from '../entry-view';

  jest.mock('src/locales/use-locales', () => ({
    __esModule: true,
    default: () => ({ tx: (k: string) => k, currentLang: { value: 'ru' } }),
  }));
  jest.mock('../api/use-survey-kiosk-api', () => ({
    useKioskEmployeesQuery: () => ({ data: { results: [], count: 0 }, isPending: false }),
    useDueSurveysQuery: () => ({ data: [], isPending: false }),
    useStartSurveyMutation: () => ({ mutate: jest.fn(), isPending: false }),
  }));

  describe('KioskEntryView', () => {
    it('starts on the employee step', () => {
      render(<KioskEntryView />);
      expect(screen.getByText('survey.kiosk.steps.employee')).toBeInTheDocument();
    });
  });
  ```
- [ ] **Step 2: Run test to verify it fails**
  `(cd "$FRONT" && CI=true npx react-scripts test src/sections/app/survey-kiosk/__tests__/entry-view.test.tsx --watchAll=false)`
  Expected: FAIL — `Cannot find module '../entry-view'`.
- [ ] **Step 3: Write minimal implementation**
  Create `src/sections/app/survey-kiosk/components/index.tsx`:
  ```tsx
  export { default as EmployeeStep } from './employee-step';
  export { default as FaceIdStep } from './face-id-step';
  export { default as DueSurveysStep } from './due-surveys-step';
  export { default as QuestionStep, type KioskAnswer } from './question-step';
  export { default as ThankYouStep } from './thank-you-step';
  export { default as ThreeBg } from './three-bg';
  export { default as CursorGlow } from './cursor-glow';
  export { default as SurveyPanel } from './survey-panel';
  ```
  Create `src/sections/app/survey-kiosk/entry-view.tsx`:
  ```tsx
  import { useCallback, useState } from 'react';
  import { useNavigate } from 'react-router-dom';
  import Box from '@mui/material/Box';
  import { useSnackbar } from 'src/components/snackbar';
  import useLocales from 'src/locales/use-locales';
  import { paths } from 'src/routes/paths';
  import { errorReader } from 'src/utils/error-reader';
  import type { Employee } from '../employees/api/types';
  import type { Test } from '../admin-surveys/api/types';
  import { useDueSurveysQuery, useStartSurveyMutation } from './api/use-survey-kiosk-api';
  import { DueSurveysStep, EmployeeStep, FaceIdStep, SurveyPanel } from './components';

  type Phase = 'employee' | 'faceId' | 'due';

  export default function KioskEntryView() {
    const navigate = useNavigate();
    const { tx } = useLocales();
    const { enqueueSnackbar } = useSnackbar();

    const [phase, setPhase] = useState<Phase>('employee');
    const [employee, setEmployee] = useState<Employee | null>(null);
    const [faceBlob, setFaceBlob] = useState<Blob | null>(null);

    const dueQuery = useDueSurveysQuery(phase === 'due' && employee ? employee.id : null);
    const startMutation = useStartSurveyMutation();

    const handleEmployeeSelect = useCallback((emp: Employee) => {
      setEmployee(emp);
      setPhase('faceId');
    }, []);

    const handleIdentified = useCallback((emp: Employee, blob: Blob) => {
      setEmployee(emp);
      setFaceBlob(blob);
      setPhase('due');
    }, []);

    const handlePick = useCallback(
      (test: Test) => {
        if (!employee || !faceBlob || startMutation.isPending) return;
        startMutation.mutate(
          {
            employee: employee.id,
            test: test.id,
            faceImage: new File([faceBlob], 'frame.jpg', { type: 'image/jpeg' }),
          },
          {
            onSuccess: (data) => {
              navigate(paths.app.kiosk.answer, {
                state: { start: data, employeeName: employee.fullName },
              });
            },
            onError: (err) => enqueueSnackbar(errorReader(err), { variant: 'error' }),
          }
        );
      },
      [employee, faceBlob, startMutation, navigate, enqueueSnackbar]
    );

    if (phase === 'faceId') {
      return (
        <FaceIdStep
          onIdentified={handleIdentified}
          onBack={() => setPhase('employee')}
        />
      );
    }

    return (
      <SurveyPanel>
        <Box sx={{ minHeight: 480 }}>
          {phase === 'employee' && <EmployeeStep onSelect={handleEmployeeSelect} />}
          {phase === 'due' && (
            <DueSurveysStep
              tests={dueQuery.data ?? []}
              isLoading={dueQuery.isPending}
              employeeName={employee?.fullName ?? ''}
              onPick={handlePick}
              onBack={() => setPhase('employee')}
            />
          )}
        </Box>
      </SurveyPanel>
    );
  }
  ```
  Create `src/sections/app/survey-kiosk/answer-view.tsx`:
  ```tsx
  import { useCallback, useMemo, useState } from 'react';
  import { Navigate, useLocation, useNavigate } from 'react-router-dom';
  import Box from '@mui/material/Box';
  import { useSnackbar } from 'src/components/snackbar';
  import { paths } from 'src/routes/paths';
  import { errorReader } from 'src/utils/error-reader';
  import type { StartSurveyResponse, SubmitAnswerItem, SurveyQuestion } from './api/types';
  import { useSubmitSurveyMutation } from './api/use-survey-kiosk-api';
  import { QuestionStep, SurveyPanel, ThankYouStep, type KioskAnswer } from './components';

  export default function KioskAnswerView() {
    const navigate = useNavigate();
    const { state } = useLocation();
    const { enqueueSnackbar } = useSnackbar();

    const start = state?.start as StartSurveyResponse | undefined;
    const employeeName = (state?.employeeName as string | undefined) ?? '';

    const [answers, setAnswers] = useState<Record<number, KioskAnswer>>({});
    const [done, setDone] = useState(false);

    const submitMutation = useSubmitSurveyMutation();

    const questions = useMemo<SurveyQuestion[]>(
      () => (start ? start.blocks.flatMap((block) => block.questions) : []),
      [start]
    );

    const handleAnswer = useCallback((questionId: number, answer: KioskAnswer) => {
      setAnswers((prev) => ({ ...prev, [questionId]: answer }));
    }, []);

    const handleSubmit = useCallback(() => {
      if (!start || submitMutation.isPending) return;
      const items: SubmitAnswerItem[] = questions.map((q) => {
        const a = answers[q.id];
        if (q.type === 'textarea') return { question: q.id, textValue: a?.textValue ?? '' };
        return { question: q.id, selectedOptionIds: a?.selectedOptionIds ?? [] };
      });
      submitMutation.mutate(
        { sessionId: start.session.id, payload: { answers: items } },
        {
          onSuccess: () => setDone(true),
          onError: (err) => enqueueSnackbar(errorReader(err), { variant: 'error' }),
        }
      );
    }, [start, questions, answers, submitMutation, enqueueSnackbar]);

    if (!start) {
      return <Navigate to={paths.app.kiosk.root} replace />;
    }

    return (
      <SurveyPanel>
        <Box sx={{ px: { xs: 3, md: 6 }, py: { xs: 4, md: 6 } }}>
          {done ? (
            <ThankYouStep employeeName={employeeName} onFinish={() => navigate(paths.app.kiosk.root)} />
          ) : (
            <QuestionStep
              questions={questions}
              answers={answers}
              onAnswer={handleAnswer}
              onSubmit={handleSubmit}
              isSubmitting={submitMutation.isPending}
            />
          )}
        </Box>
      </SurveyPanel>
    );
  }
  ```
  Create `src/pages/app/survey-kiosk-entry.tsx`:
  ```tsx
  import { Helmet } from 'react-helmet-async';
  import useLocales from 'src/locales/use-locales';
  import KioskEntryView from 'src/sections/app/survey-kiosk/entry-view';

  export default function SurveyKioskEntryPage() {
    const { tx } = useLocales();
    return (
      <>
        <Helmet>
          <title>{`${tx('survey.kiosk.title')} | ${tx('common.appName')}`}</title>
        </Helmet>
        <KioskEntryView />
      </>
    );
  }
  ```
  Create `src/pages/app/survey-kiosk-answer.tsx` (same shape, import `KioskAnswerView from 'src/sections/app/survey-kiosk/answer-view'`).
  In `src/routes/sections/dashboard.tsx` add lazy imports after `SurveyResultsPage`:
  ```tsx
  const KioskEntryPage = lazy(() => import('src/pages/app/survey-kiosk-entry'));
  const KioskAnswerPage = lazy(() => import('src/pages/app/survey-kiosk-answer'));
  ```
  and add two children after the `surveys/results` entry:
  ```tsx
        {
          path: 'kiosk',
          element: (
            <PermissionGuard page="survey" action="submit">
              <KioskEntryPage />
            </PermissionGuard>
          ),
        },
        {
          path: 'kiosk/answer',
          element: (
            <PermissionGuard page="survey" action="submit">
              <KioskAnswerPage />
            </PermissionGuard>
          ),
        },
  ```
  In `src/layouts/dashboard/config-navigation.tsx` `useNavData`, add a kiosk group before `return groups;`:
  ```tsx
      if (checkPermission('survey', 'submit')) {
        groups.push({
          subheader: tx('common.navigation.kioskGroup'),
          items: [
            {
              title: tx('common.navigation.kiosk'),
              path: paths.app.kiosk.root,
              icon: icon('solar:posts-carousel-vertical-bold-duotone'),
            },
          ],
        });
      }
  ```
  and destructure `checkPermission` from `useCheckPermission()`: change `const { canReadPage, canWritePage } = useCheckPermission();` to `const { canReadPage, canWritePage, checkPermission } = useCheckPermission();` and add `checkPermission` to the `useMemo` dependency array.
- [ ] **Step 4: Run test to verify it passes**
  `(cd "$FRONT" && CI=true npx react-scripts test src/sections/app/survey-kiosk/__tests__/entry-view.test.tsx --watchAll=false)`
  Expected: PASS (1 test).
- [ ] **Step 5: Commit**
  ```bash
  cd "$FRONT" && git add -A && git commit -m "feat(survey-kiosk): entry/answer views, pages, routes, kiosk nav"
  ```

---

### Task 20: i18n — survey (kiosk) + surveys (admin) namespaces, ru + uz

Adds two namespaces: `survey` (kiosk, key `survey.kiosk.*`) and `surveys` (admin, key `surveys.tests|blocks|questions|results.*`), plus new `common.navigation.*` and `employees.*` keys. Both langs get all keys (no missing-key fallbacks).

**Files:**
- Create: `src/locales/langs/ru/survey.json`, `src/locales/langs/uz/survey.json`
- Create: `src/locales/langs/ru/surveys.json`, `src/locales/langs/uz/surveys.json`
- Modify: `src/locales/langs/ru/index.ts`, `src/locales/langs/uz/index.ts` (add `survey`, `surveys`)
- Modify: `src/locales/langs/{ru,uz}/common.json` (navigation keys)
- Modify: `src/locales/langs/{ru,uz}/employees.json` (form/table/validation keys)
- Test: `src/locales/langs/ru/__tests__/survey-namespace.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: every `survey.kiosk.*` / `surveys.*` / new `common.navigation.*` / `employees.*` key referenced by Tasks 5–19 resolves.

- [ ] **Step 1: Write the failing test**
  Create `src/locales/langs/ru/__tests__/survey-namespace.test.ts`:
  ```ts
  import translation from '../index';

  describe('ru survey namespaces', () => {
    it('exposes kiosk + admin namespaces', () => {
      expect(translation).toHaveProperty('survey');
      expect(translation).toHaveProperty('surveys');
    });
    it('has representative keys', () => {
      expect((translation as any).survey.kiosk.faceId.continue).toBeTruthy();
      expect((translation as any).surveys.tests.title).toBeTruthy();
      expect((translation as any).surveys.questions.types.textarea).toBeTruthy();
      expect((translation as any).common.navigation.surveys).toBeTruthy();
      expect((translation as any).employees.form.hireDate).toBeTruthy();
    });
  });
  ```
- [ ] **Step 2: Run test to verify it fails**
  `(cd "$FRONT" && CI=true npx react-scripts test src/locales/langs/ru/__tests__/survey-namespace.test.ts --watchAll=false)`
  Expected: FAIL — `Received object does not have property "survey"`.
- [ ] **Step 3: Write minimal implementation**
  Create `src/locales/langs/ru/survey.json`:
  ```json
  {
    "kiosk": {
      "title": "Опрос мнений",
      "steps": { "employee": "Выберите сотрудника", "faceId": "Проверка Face ID" },
      "employee": { "searchPlaceholder": "Поиск по Ф.И.О...", "empty": "Сотрудник не найден" },
      "faceId": {
        "identifyTitle": "Распознавание лица",
        "instruction": "Смотрите прямо в камеру и нажмите «Сканировать»",
        "scan": "Сканировать",
        "identifying": "Распознаём...",
        "continue": "Продолжить",
        "notYou": "Не вы?",
        "identified": "ИДЕНТИФИЦИРОВАН",
        "identifiedStatus": "ИДЕНТИФИЦИРОВАН",
        "identifyingStatus": "РАСПОЗНАЁМ...",
        "readyStatus": "ГОТОВ К СКАНИРОВАНИЮ",
        "cameraDenied": "Доступ к камере запрещён. Разрешите доступ в настройках браузера.",
        "cameraUnavailable": "Камера не найдена или не запустилась. Проверьте устройство."
      },
      "due": {
        "title": "Доступные опросы",
        "subtitle": "Сотрудник: {{name}}",
        "empty": "Нет доступных опросов"
      },
      "questions": {
        "progress": "Вопрос {{current}} / {{total}}",
        "textPlaceholder": "Введите ваш ответ..."
      },
      "thankYou": {
        "title": "Спасибо!",
        "subtitle": "{{name}}, ваши ответы сохранены",
        "finish": "Готово"
      }
    }
  }
  ```
  Create `src/locales/langs/ru/surveys.json`:
  ```json
  {
    "tests": {
      "title": "Опросы",
      "empty": "Опросы не найдены",
      "searchPlaceholder": "Поиск по названию...",
      "actions": { "create": "Создать опрос", "manageBlocks": "Блоки вопросов" },
      "table": { "title": "Название", "schedule": "Расписание", "status": "Статус" },
      "schedule": {
        "adminConducted": "Беседа 1в1 (заполняет админ)",
        "afterDays": "Через {{days}} дн. после найма",
        "periodic": "Месяцы: {{months}}; дни {{from}}–{{to}}"
      },
      "form": {
        "createTitle": "Новый опрос",
        "editTitle": "Редактировать опрос",
        "title": "Название",
        "active": "Активен",
        "adminConducted": "Беседа 1в1 (без Face ID)",
        "scheduling": "Расписание",
        "afterApplication": "Одноразовый после найма",
        "afterDays": "Через N дней",
        "months": "Месяцы",
        "monthsAny": "Каждый месяц",
        "daysFrom": "Дни с",
        "daysTo": "Дни по"
      },
      "validation": {
        "titleRequired": "Укажите название",
        "afterDaysRequired": "Укажите число дней",
        "afterDaysMin": "Не может быть отрицательным",
        "dayRange": "«По» не может быть меньше «с»"
      },
      "toasts": { "created": "Опрос создан", "updated": "Опрос обновлён", "deleted": "Опрос удалён" },
      "dialogs": { "delete": { "title": "Удалить опрос?", "content": "Действие необратимо." } }
    },
    "blocks": {
      "title": "Блоки вопросов",
      "empty": "Блоки не добавлены",
      "untitled": "Без названия",
      "orderLabel": "Порядок: {{order}}",
      "actions": { "create": "Добавить блок" },
      "form": { "createTitle": "Новый блок", "editTitle": "Редактировать блок", "order": "Порядок", "title": "Название" },
      "toasts": { "created": "Блок создан", "updated": "Блок обновлён", "deleted": "Блок удалён" },
      "dialogs": { "delete": { "title": "Удалить блок?", "content": "Вопросы блока также будут удалены." } }
    },
    "questions": {
      "title": "Вопросы",
      "empty": "Вопросы не добавлены",
      "types": { "single": "Один вариант", "multiple": "Несколько вариантов", "textarea": "Свободный текст" },
      "actions": { "create": "Добавить вопрос", "addOption": "Добавить вариант" },
      "form": {
        "createTitle": "Новый вопрос",
        "editTitle": "Редактировать вопрос",
        "type": "Тип",
        "order": "Порядок",
        "text": "Текст вопроса",
        "options": "Варианты ответа",
        "optionLabel": "Вариант {{n}}"
      },
      "validation": {
        "textRequired": "Введите текст вопроса",
        "optionText": "Введите текст варианта",
        "minOptions": "Нужно минимум 2 варианта"
      },
      "toasts": { "created": "Вопрос создан", "updated": "Вопрос обновлён", "deleted": "Вопрос удалён" },
      "dialogs": { "delete": { "title": "Удалить вопрос?", "content": "Действие необратимо." } }
    },
    "results": {
      "title": "Результаты опросов",
      "selectTest": "Выберите опрос",
      "pickTestPrompt": "Выберите опрос для просмотра результатов",
      "sessionCount": "Всего прохождений: {{count}}",
      "noAnswers": "Нет ответов",
      "toasts": { "exported": "Экспорт готов" }
    }
  }
  ```
  Create `src/locales/langs/uz/survey.json` (same structure, Uzbek strings):
  ```json
  {
    "kiosk": {
      "title": "Fikr so‘rovi",
      "steps": { "employee": "Xodimni tanlang", "faceId": "Face ID tekshiruvi" },
      "employee": { "searchPlaceholder": "F.I.Sh. bo‘yicha qidirish...", "empty": "Xodim topilmadi" },
      "faceId": {
        "identifyTitle": "Yuzni aniqlash",
        "instruction": "Kameraga qarang va «Skanerlash»ni bosing",
        "scan": "Skanerlash",
        "identifying": "Aniqlanmoqda...",
        "continue": "Davom etish",
        "notYou": "Siz emasmisiz?",
        "identified": "ANIQLANDI",
        "identifiedStatus": "ANIQLANDI",
        "identifyingStatus": "ANIQLANMOQDA...",
        "readyStatus": "SKANERLASHGA TAYYOR",
        "cameraDenied": "Kameraga ruxsat berilmadi. Brauzer sozlamalarida ruxsat bering.",
        "cameraUnavailable": "Kamera topilmadi yoki ishga tushmadi."
      },
      "due": {
        "title": "Mavjud so‘rovlar",
        "subtitle": "Xodim: {{name}}",
        "empty": "Mavjud so‘rovlar yo‘q"
      },
      "questions": {
        "progress": "Savol {{current}} / {{total}}",
        "textPlaceholder": "Javobingizni kiriting..."
      },
      "thankYou": {
        "title": "Rahmat!",
        "subtitle": "{{name}}, javoblaringiz saqlandi",
        "finish": "Tayyor"
      }
    }
  }
  ```
  Create `src/locales/langs/uz/surveys.json` (mirror of the ru admin file with Uzbek strings):
  ```json
  {
    "tests": {
      "title": "So‘rovlar",
      "empty": "So‘rovlar topilmadi",
      "searchPlaceholder": "Nomi bo‘yicha qidirish...",
      "actions": { "create": "So‘rov yaratish", "manageBlocks": "Savol bloklari" },
      "table": { "title": "Nomi", "schedule": "Jadval", "status": "Holat" },
      "schedule": {
        "adminConducted": "1x1 suhbat (admin to‘ldiradi)",
        "afterDays": "Ishga qabuldan {{days}} kun keyin",
        "periodic": "Oylar: {{months}}; kunlar {{from}}–{{to}}"
      },
      "form": {
        "createTitle": "Yangi so‘rov",
        "editTitle": "So‘rovni tahrirlash",
        "title": "Nomi",
        "active": "Faol",
        "adminConducted": "1x1 suhbat (Face ID’siz)",
        "scheduling": "Jadval",
        "afterApplication": "Ishga qabuldan keyin bir marta",
        "afterDays": "N kundan keyin",
        "months": "Oylar",
        "monthsAny": "Har oy",
        "daysFrom": "Kundan",
        "daysTo": "Kungacha"
      },
      "validation": {
        "titleRequired": "Nomini kiriting",
        "afterDaysRequired": "Kunlar sonini kiriting",
        "afterDaysMin": "Manfiy bo‘lishi mumkin emas",
        "dayRange": "«Gacha» «dan» dan kichik bo‘lmasin"
      },
      "toasts": { "created": "So‘rov yaratildi", "updated": "So‘rov yangilandi", "deleted": "So‘rov o‘chirildi" },
      "dialogs": { "delete": { "title": "So‘rov o‘chirilsinmi?", "content": "Amalni qaytarib bo‘lmaydi." } }
    },
    "blocks": {
      "title": "Savol bloklari",
      "empty": "Bloklar qo‘shilmagan",
      "untitled": "Nomsiz",
      "orderLabel": "Tartib: {{order}}",
      "actions": { "create": "Blok qo‘shish" },
      "form": { "createTitle": "Yangi blok", "editTitle": "Blokni tahrirlash", "order": "Tartib", "title": "Nomi" },
      "toasts": { "created": "Blok yaratildi", "updated": "Blok yangilandi", "deleted": "Blok o‘chirildi" },
      "dialogs": { "delete": { "title": "Blok o‘chirilsinmi?", "content": "Blok savollari ham o‘chiriladi." } }
    },
    "questions": {
      "title": "Savollar",
      "empty": "Savollar qo‘shilmagan",
      "types": { "single": "Bitta variant", "multiple": "Bir nechta variant", "textarea": "Erkin matn" },
      "actions": { "create": "Savol qo‘shish", "addOption": "Variant qo‘shish" },
      "form": {
        "createTitle": "Yangi savol",
        "editTitle": "Savolni tahrirlash",
        "type": "Turi",
        "order": "Tartib",
        "text": "Savol matni",
        "options": "Javob variantlari",
        "optionLabel": "Variant {{n}}"
      },
      "validation": {
        "textRequired": "Savol matnini kiriting",
        "optionText": "Variant matnini kiriting",
        "minOptions": "Kamida 2 ta variant kerak"
      },
      "toasts": { "created": "Savol yaratildi", "updated": "Savol yangilandi", "deleted": "Savol o‘chirildi" },
      "dialogs": { "delete": { "title": "Savol o‘chirilsinmi?", "content": "Amalni qaytarib bo‘lmaydi." } }
    },
    "results": {
      "title": "So‘rov natijalari",
      "selectTest": "So‘rovni tanlang",
      "pickTestPrompt": "Natijalarni ko‘rish uchun so‘rovni tanlang",
      "sessionCount": "Jami o‘tishlar: {{count}}",
      "noAnswers": "Javoblar yo‘q",
      "toasts": { "exported": "Eksport tayyor" }
    }
  }
  ```
  Add `survey` + `surveys` to BOTH barrels (`src/locales/langs/ru/index.ts` and `.../uz/index.ts`): add the two imports and object entries:
  ```ts
  import survey from './survey.json';
  import surveys from './surveys.json';
  // ...in the object:
    survey,
    surveys,
  ```
  In BOTH `common.json` files, add to the `navigation` object these keys (ru shown; uz analogues): `"surveys": "Опросы"`, `"surveysGroup": "Опросы"`, `"kiosk": "Киоск опроса"`, `"kioskGroup": "Киоск"` (keep the existing `results`, `management`; remove stale `assessments`/`testing`/`questions`/`instructions`/`medical`/`medicalGroup`/`dashboard` keys). uz: `"surveys": "So‘rovlar"`, `"surveysGroup": "So‘rovlar"`, `"kiosk": "So‘rov kioski"`, `"kioskGroup": "Kiosk"`.
  In BOTH `employees.json` files, add: under `form`: `"hireDate": "Работает с"`, `"workExperience": "Стаж (лет)"`; under `table`: `"hireDate": "Работает с"`, `"workExperience": "Стаж"`; under `validation`: `"workExperienceMin": "Стаж не может быть отрицательным"`. uz: `form.hireDate "Ishga qabul sanasi"`, `form.workExperience "Ish staji (yil)"`, `table.hireDate "Ishga qabul"`, `table.workExperience "Staj"`, `validation.workExperienceMin "Staj manfiy bo‘lmasin"`.
- [ ] **Step 4: Run test to verify it passes**
  `(cd "$FRONT" && CI=true npx react-scripts test src/locales/langs/ru/__tests__/survey-namespace.test.ts --watchAll=false)`
  Expected: PASS (2 tests).
- [ ] **Step 5: Commit**
  ```bash
  cd "$FRONT" && git add -A && git commit -m "feat(i18n): survey + surveys namespaces (ru/uz) + nav/employee keys"
  ```

---

### Task 21: Verification — typecheck, lint, build, full test suite

Final gate. No new source; fix any residual references surfaced by the compiler (e.g. a lingering `testing`/`medical` import, an unused var from the FaceIdStep edits).

**Files:**
- Modify: whatever `tsc`/`eslint` flag as broken (targeted fixes only).

**Interfaces:**
- Consumes: all prior tasks.
- Produces: green `tsc --noEmit`, `npm run lint`, `npm run build`, and full Jest suite.

- [ ] **Step 1: Run the full test suite (acts as the failing gate if anything regressed)**
  `(cd "$FRONT" && CI=true npx react-scripts test --watchAll=false)`
  Expected initially: may FAIL if a deleted-module import lingers. Record failures.
- [ ] **Step 2: Typecheck**
  `(cd "$FRONT" && npx tsc --noEmit)`
  Expected: no errors. If errors reference a removed page/section (e.g. `src/routes/sections/main.tsx` or `layouts` importing a deleted nav key), fix the specific import/usage. Common expected fixes:
  - `config-navigation.tsx`: ensure no `paths.app.testing`/`medical`/`questions`/`instructions`/`dashboard` references remain.
  - Any `src/pages/*` or `src/layouts/*` still importing a deleted module → delete the import/usage.
- [ ] **Step 3: Lint**
  `(cd "$FRONT" && npm run lint)`
  Expected: clean. Fix unused imports left over from the FaceIdStep adaptation (e.g. `Divider`, `LoadingButton` if now unused — remove unused imports) and any `@typescript-eslint/no-unused-vars`.
- [ ] **Step 4: Build**
  `(cd "$FRONT" && npm run build)`
  Expected: `Compiled successfully` (CRA production build). If it fails on a missing i18n key type or a lazy import path, correct the path. Re-run steps 1–4 until all four are green.
  > Note: the kiosk camera (`getUserMedia`) only initializes on `localhost` or HTTPS; the production build does not exercise it, so a build pass does not validate the camera — that is validated manually on the kiosk device.
- [ ] **Step 5: Commit**
  ```bash
  cd "$FRONT" && git add -A && git commit -m "chore(frontend): green typecheck, lint, build, and test suite"
  ```

---

## Appendix — cross-plan interface checklist (must stay identical across all 3 plans)

- `endpoints.ts` `surveys.{tests, questionBlocks, questions, due, start, submit, adminFill, results, export}` + `employees.facePhotos` — Task 2.
- Multipart keys are snake_case (`face_image`, `employee`, `test`, `hire_date`, `work_experience`) because `FormData` bypasses the camelCase transform (`http-client.ts:44-58`) — Tasks 5, 13.
- Kiosk `start/` response shape `{ session, test, blocks:[{ questions:[{ id, type, order, text, options:[{id,text}] }] }] }` — Task 13 `StartSurveyResponse`.
- `submit/` request `answers:[{ question, selectedOptionIds?, textValue? }]` — Task 13 `SubmitAnswerItem`.
- `EmployeeSerializer` fields include `hire_date`, `work_experience` (Plan 1); FE `Employee.hireDate/workExperience` — Task 5.
- Permission keys: `tests:read/write`, `questions:read/write`, `results:read` (admin), `survey:submit` (kiosk) must match `backend/apps/accounts/permission_catalog.py` (Plan 1/2) — Task 3.
- No `score`/`passed`/`total`/`audioUrl`/TTS anywhere — enforced by Tasks 1, 17, 18.
