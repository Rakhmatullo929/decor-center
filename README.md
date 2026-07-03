# Decor-Center — Employee Opinion-Survey System (Face-ID)

Web application for running **employee opinion surveys** with **Face-ID identification** at a
kiosk. Surveys have **no scoring and no correct answers** — they capture opinion only. Tests are
either scheduled after hire (30/90 days) or run on a recurring calendar (monthly 1-on-1,
quarterly pulse, semiannual deep survey). Admins build the question bank; a kiosk operator
runs employees through Face-ID and the survey; admins read aggregated results and export XLSX.

Ported from the `depo` project (`../../June-2026/depo`), reusing **only** the face-recognition
pipeline and the admin dashboard template. Scoring, TTS, AI question-generation and the medical
module were intentionally left out.

- Design/port spec: [docs/superpowers/specs/2026-07-03-decor-center-port-design.md](docs/superpowers/specs/2026-07-03-decor-center-port-design.md)
- Implementation plans: [docs/superpowers/plans/](docs/superpowers/plans/) (01 backend foundation, 02 surveys backend, 03 frontend)
- Production deployment: [DEPLOYMENT.md](DEPLOYMENT.md)

## Structure

| Path | Description |
|---|---|
| `backend/` | Django 5.2 + DRF API (PostgreSQL, JWT, role-based access) |
| `backend/apps/` | `accounts` (JWT/roles), `employees` (+ Face enrollment), `surveys` (tests/blocks/questions/sessions), `integrations` (face backends), `core` |
| `frontend/` | React 18 + TypeScript SPA (MUI, React Query, RHF, i18n uz/ru) |
| `frontend/cursor/rules/` | Frontend coding conventions (API layering, URL state, RBAC, i18n) |
| `docker-compose.yml` | PostgreSQL for local development (host port `5433`) |
| `Makefile` | Developer task runner — `make help` for the full list |

## Domain model

| Model | Notes |
|---|---|
| `Specialty` | Employee specialty; admin-extendable (seeded with ~68 entries) |
| `Employee` | `full_name`, `specialty`, `photo`, **`hire_date` («Работает с»)**, **`work_experience` («Стаж», years)**, internal `face_embedding` |
| `EmployeeFacePhoto` | Multi-photo face enrollment; active template is the mean embedding |
| `Test` | Survey definition (no scoring). One-shot after hire (`after_days`) **or** periodic (`month[]` + day-of-month window); `is_admin_conducted` for 1-on-1 |
| `QuestionBlock` | `test`, `order`, `title` — groups questions inside a survey |
| `Question` | `type` = `single` (radio) / `multiple` (checkbox) / `textarea`; `order`, `text`, `options` (stable UUID option IDs) |
| `SurveySession` | One run by an employee; Face-ID snapshot frozen at start (except admin-conducted) |
| `Answer` | `selected_option_ids` or `text_value`; unique per (session, question) |
| `FaceVerificationLog` | Audit of every kiosk Face-ID attempt (start/submit, success, similarity) |

### Survey presets (`manage.py seed_surveys`)

| Preset | Schedule |
|---|---|
| Через 30 дней после найма | one-shot, 30 days after hire |
| Через 90 дней после найма | one-shot, 90 days after hire |
| 1в1 ежемесячно (беседа) | monthly, admin-conducted (no Face-ID) |
| Краткий пульс | quarterly (Jan/Apr/Jul/Oct), days 1–7 |
| Глубокий опрос | semiannual (Jan/Jul), days 1–14 |

## Quick start (Makefile)

```bash
make setup    # .env files, deps, Postgres (docker), migrate, seed accounts
make dev      # run backend (:8000) + frontend (:3000) together; Ctrl-C stops both
```

`make help` lists every target (run, test, lint, typecheck, docker, …). The sections
below describe the same steps run by hand.

## Backend — quick start

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements/dev.txt

# PostgreSQL: either local `createdb decor` or `docker compose up -d db` from the repo root
cp .env.example .env                      # adjust DATABASE_URL if needed

.venv/bin/python manage.py migrate
.venv/bin/python manage.py seed_initial_data   # specialties + admin/specialist accounts
.venv/bin/python manage.py seed_surveys        # the 5 standard survey presets (above)
.venv/bin/python manage.py runserver
```

- API docs (Swagger): http://127.0.0.1:8000/api/v1/docs/
- Django admin: http://127.0.0.1:8000/admin/
- Seed account passwords come from `DECOR_*_PASSWORD` env vars (see `.env.example`); change them in production.
- Bulk employee import + face reindex: `manage.py import_employees` and `manage.py reindex_face_embeddings`.

### Tests & lint

```bash
cd backend
.venv/bin/python -m pytest
.venv/bin/ruff check .
```

### Key endpoints (`/api/v1/`)

| Endpoint | Purpose | Roles |
|---|---|---|
| `auth/login/`, `auth/refresh/`, `auth/logout/`, `auth/me/` | JWT auth (logout blacklists the refresh token) | all |
| `dashboard/stats/` | home dashboard KPIs | admin |
| `specialties/` | specialty directory | read: all; write: admin |
| `employees/` + `{id}/face-photos/` | directory, search, multi-photo Face enrollment | read: all; write: admin |
| `tests/`, `question-blocks/`, `questions/` | survey builder (test → blocks → questions) | admin |
| `survey-sessions/identify/` | Face-ID photo → matched employee | employee |
| `survey-sessions/due/?employee=` | surveys currently due for an employee | employee |
| `survey-sessions/start/`, `survey-sessions/{id}/submit/` | run a survey (Face-ID gated) | employee |
| `survey-sessions/admin-fill/` | complete a 1-on-1 survey without Face-ID | admin |
| `survey-sessions/results/?test=`, `survey-sessions/export/` | aggregated answers + XLSX download | admin |
| `survey-sessions/` | completed-session browsing | admin |

### Integrations (mocked by default)

Face recognition lives behind service interfaces in `backend/apps/integrations/`, selected via
`DECOR_*_BACKEND` env vars. A deterministic mock is used by default; set
`DECOR_FACE_BACKEND=apps.integrations.insightface_adapter.InsightFaceAdapter` to enable real
ArcFace (InsightFace `buffalo_sc`) recognition. Enrollment/matching knobs (similarity threshold,
max photos per employee, min face pixels, anti-spoofing, submit-time re-verification) are all
env-overridable — see `backend/.env.example`. There is **no** TTS, AI test generation, or scoring.

## Frontend — quick start

```bash
cd frontend
npm install
cp .env.example .env        # REACT_APP_HOST_API=http://localhost:8000
npm start                   # http://localhost:3000 (backend must be running)
```

Role screens (login with the seed accounts):

| Account | Role | Screens |
|---|---|---|
| `admin` | Administrator | Employees (+ Стаж / Работает с + face photos), Specialties, Surveys (Tests → Blocks → Questions), Results (aggregation + XLSX export), Dashboard |
| `employee` | Сотрудник (kiosk) | Kiosk flow: Face-ID identify → due surveys → answer questions (single / multiple / textarea) → thank-you |

Nav and routes are gated by role via `PermissionGuard`: management/survey-builder pages require
admin; the `/kiosk` flow requires the `survey:submit` permission (employee).

Checks: `npx tsc --noEmit`, `npm run lint`, `npm run build`.
Camera note: `getUserMedia` works on `localhost` or HTTPS only.
