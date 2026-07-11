# Survey Status + Progress in Kiosk List — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the employee `/scan` survey list, show one row per survey with a clear status badge ("Не начат" / "В процессе") and a progress bar (`X / Y вопросов`) for started ones — fixing the current duplicate-row bug and enforcing that expired surveys are read-only.

**Architecture:** The backend is the single source of status. `due_surveys` returns only genuinely not-started tests (excludes those with a live session — this removes the duplicate). `in_progress_sessions` carries progress counts and drops expired-window sessions. A lenient `is_expired()` guards `start`/`submit`. The frontend only renders badges + progress and shows a friendly message on `survey_expired`.

**Tech Stack:** Django 5 + DRF (pytest), React 18 + TypeScript + MUI + react-query, humps (snake_case↔camelCase), i18next (uz + ru).

## Global Constraints

- **No schema/migration changes.** Everything is computed from existing fields (`Test.test_days_from/test_days_to/month/is_after_application/after_days`, `SurveySession.started_at/completed_at`, `Answer.selected_option_ids/text_value`, `Question.type`).
- **Backend serializes snake_case; the frontend humps-converts to camelCase.** New serializer fields `answered_count`/`total_count` become `answeredCount`/`totalCount` on the client.
- **`is_expired` is lenient:** after-application surveys and periodic surveys with no explicit `test_days_to` **never** expire — there is no deadline to pass. This keeps every existing `start`/`submit` test (which use plain `TestFactory()`, `test_days_to=None`) green.
- **Every i18n key is added to BOTH** `frontend/src/locales/langs/uz/survey.json` **and** `.../ru/survey.json`.
- **Must not break the existing suite** (186 backend tests). The frontend quality gate is `yarn tsc --noEmit -p tsconfig.json` + `yarn build` (CRA `react-scripts build`, which also fails on TS errors). Pre-existing broken jest suites are out of scope.
- **Progress metric:** a question counts as *answered* when its `Answer` has a non-empty `selected_option_ids` OR a non-blank `text_value`; `section_header` questions are excluded from both numerator and denominator.

---

### Task 1: `is_expired()` scheduling helper

**Files:**
- Modify: `backend/apps/surveys/scheduling.py`
- Test: `backend/tests/test_survey_status_progress.py` (create)

**Interfaces:**
- Produces: `is_expired(test: Test, today: datetime.date) -> bool` — True only when a periodic survey's explicit day-of-month window has already passed this month.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_survey_status_progress.py`:

```python
import datetime

import pytest

from apps.surveys.models import Question, SurveySession
from apps.surveys.scheduling import due_surveys, is_expired

from .factories import (
    EmployeeFactory,
    QuestionFactory,
    SurveySessionFactory,
    TestFactory,
)
from .test_surveys_api import kiosk_client

pytestmark = pytest.mark.django_db

SESSIONS = "/api/v1/survey-sessions/"


# --- is_expired --------------------------------------------------------------

def test_is_expired_periodic_past_window():
    t = TestFactory(test_days_from=1, test_days_to=10, month=[7])
    assert is_expired(t, datetime.date(2026, 7, 20)) is True
    assert is_expired(t, datetime.date(2026, 7, 10)) is False  # inclusive upper bound
    assert is_expired(t, datetime.date(2026, 7, 5)) is False


def test_is_expired_after_application_never():
    t = TestFactory(is_after_application=True, after_days=30)
    assert is_expired(t, datetime.date(2026, 7, 20)) is False


def test_is_expired_no_upper_bound_never():
    t = TestFactory()  # test_days_to is None
    assert is_expired(t, datetime.date(2026, 7, 20)) is False


def test_is_expired_wrong_month_not_expired():
    t = TestFactory(test_days_from=1, test_days_to=10, month=[6])
    assert is_expired(t, datetime.date(2026, 7, 20)) is False


def test_is_expired_clamps_to_month_end():
    t = TestFactory(test_days_from=1, test_days_to=31, month=[2])
    # Feb 2026 has 28 days: the clamped upper bound is the 28th, so the 28th is open.
    assert is_expired(t, datetime.date(2026, 2, 28)) is False
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && .venv/bin/pytest tests/test_survey_status_progress.py -k is_expired -v`
Expected: FAIL with `ImportError: cannot import name 'is_expired'`.

- [ ] **Step 3: Implement `is_expired`**

In `backend/apps/surveys/scheduling.py`, add the function after `_last_day_of_month` (after line 11):

```python
def is_expired(test: Test, today: datetime.date) -> bool:
    """True when a periodic survey's explicit day-of-month window has already
    passed this month, i.e. a late start/submit must be refused (read-only).

    Lenient by design: after-application surveys and periodic surveys without an
    explicit upper bound (`test_days_to is None`) never expire — there is no
    deadline to pass. Visibility windowing (which day a survey first appears) is
    handled separately by `due_surveys`; this governs only whether a late
    start/submit is still allowed.
    """
    if test.is_after_application or test.test_days_to is None:
        return False
    months = test.month or ALL_MONTHS
    if today.month not in months:
        return False
    hi = min(test.test_days_to, _last_day_of_month(today.year, today.month))
    return today.day > hi
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && .venv/bin/pytest tests/test_survey_status_progress.py -k is_expired -v`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/apps/surveys/scheduling.py backend/tests/test_survey_status_progress.py
git commit -m "feat(surveys): is_expired() window helper for read-only enforcement"
```

---

### Task 2: `due_surveys()` excludes tests with a live session (dedup)

**Files:**
- Modify: `backend/apps/surveys/scheduling.py`
- Test: `backend/tests/test_survey_status_progress.py`

**Interfaces:**
- Consumes: existing `due_surveys(employee, today)`.
- Produces: `due_surveys` no longer returns a test for which the employee has a live (not-completed, not-abandoned) session — that survey belongs in the "continue"/in-progress list instead.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_survey_status_progress.py`:

```python
# --- due_surveys dedup -------------------------------------------------------

def test_due_excludes_test_with_live_session():
    emp = EmployeeFactory(hire_date=datetime.date(2026, 6, 1))
    survey = TestFactory(is_after_application=True, after_days=1)
    # A started-but-not-completed (live) session must move this survey OUT of `due`.
    SurveySessionFactory(test=survey, employee=emp)  # started_at=now, completed_at=None
    result = due_surveys(emp, datetime.date(2026, 7, 1))
    assert survey not in result


def test_due_still_lists_test_without_a_session():
    emp = EmployeeFactory(hire_date=datetime.date(2026, 6, 1))
    survey = TestFactory(is_after_application=True, after_days=1)
    result = due_surveys(emp, datetime.date(2026, 7, 1))
    assert survey in result
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && .venv/bin/pytest tests/test_survey_status_progress.py -k due_ -v`
Expected: `test_due_excludes_test_with_live_session` FAILS (the survey is still returned — the current duplicate bug).

- [ ] **Step 3: Implement the dedup**

In `backend/apps/surveys/scheduling.py`:

Update the imports at the top (currently `import calendar`, `import datetime`, `from .models import SurveySession, Test`) to add settings + timezone:

```python
import calendar
import datetime

from django.conf import settings as django_settings
from django.utils import timezone

from .models import SurveySession, Test
```

Then in `due_surveys`, after `result: list[Test] = []` (currently line 40), compute the set of tests that already have a live session (one query; the cutoff mirrors `services._live_session_cutoff`, kept inline to avoid importing the service layer into scheduling):

```python
    hire = employee.hire_date
    days = None if hire is None else (today - hire).days
    result: list[Test] = []

    live_cutoff = timezone.now() - datetime.timedelta(
        hours=django_settings.DECOR["SURVEY_SESSION_ABANDONED_AFTER_HOURS"]
    )
    live_test_ids = set(
        SurveySession.objects.filter(
            employee=employee, completed_at__isnull=True, started_at__gte=live_cutoff
        ).values_list("test_id", flat=True)
    )
```

Then guard both append branches. Change the after-application branch:

```python
        if test.is_after_application:
            if days is None or test.after_days is None:
                continue
            if (
                days >= test.after_days
                and test.id not in live_test_ids
                and not _completed_ever(test, employee)
            ):
                result.append(test)
```

and the periodic branch's final check:

```python
            window_start = datetime.date(today.year, today.month, lo)
            if test.id not in live_test_ids and not _completed_since(
                test, employee, window_start
            ):
                result.append(test)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && .venv/bin/pytest tests/test_survey_status_progress.py -k due_ -v`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the existing scheduling/api tests to confirm no regression**

Run: `cd backend && .venv/bin/pytest tests/test_surveys_api.py -v`
Expected: PASS (all existing tests, incl. `test_due_lists_scheduled_surveys`).

- [ ] **Step 6: Commit**

```bash
git add backend/apps/surveys/scheduling.py backend/tests/test_survey_status_progress.py
git commit -m "fix(surveys): due list excludes in-progress surveys (no duplicate rows)"
```

---

### Task 3: `in_progress_sessions()` — prefetch answers + drop expired-window sessions

**Files:**
- Modify: `backend/apps/surveys/services.py`
- Test: `backend/tests/test_survey_status_progress.py`

**Interfaces:**
- Consumes: `is_expired` (Task 1).
- Produces: `in_progress_sessions(employee, today=None) -> list[SurveySession]` — live sessions with `answers__question` prefetched, excluding any whose test window has closed. Returns a list (was a queryset); callers only iterate/serialize it.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_survey_status_progress.py`:

```python
# --- in-progress: expired-window exclusion -----------------------------------

def test_in_progress_excludes_expired_window_session(monkeypatch):
    emp = EmployeeFactory()
    survey = TestFactory(test_days_from=1, test_days_to=10, month=[7])
    SurveySessionFactory(test=survey, employee=emp)
    monkeypatch.setattr(
        "django.utils.timezone.localdate", lambda: datetime.date(2026, 7, 20)
    )
    resp = kiosk_client(emp.id).get(f"{SESSIONS}in-progress/?employee={emp.id}")
    assert resp.status_code == 200, resp.data
    assert resp.data == []


def test_in_progress_includes_open_window_session(monkeypatch):
    emp = EmployeeFactory()
    survey = TestFactory(test_days_from=1, test_days_to=31, month=[7])
    session = SurveySessionFactory(test=survey, employee=emp)
    monkeypatch.setattr(
        "django.utils.timezone.localdate", lambda: datetime.date(2026, 7, 20)
    )
    resp = kiosk_client(emp.id).get(f"{SESSIONS}in-progress/?employee={emp.id}")
    assert [row["id"] for row in resp.data] == [session.id]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && .venv/bin/pytest tests/test_survey_status_progress.py -k in_progress -v`
Expected: `test_in_progress_excludes_expired_window_session` FAILS (the expired session is still returned).

- [ ] **Step 3: Implement the change**

In `backend/apps/surveys/services.py`, add the import near the other local imports (after line 15, `from .models import ...`):

```python
from .scheduling import is_expired
```

Replace `in_progress_sessions` (currently lines 140-149) with:

```python
def in_progress_sessions(employee: Employee, today=None):
    """The employee's live (not completed, not abandoned) sessions whose survey
    window is still open — powers the cabinet's "continue" list. Sessions whose
    window has closed are omitted (expired surveys are read-only). Answers are
    prefetched so the serializer can report progress without an N+1."""
    today = today or timezone.localdate()
    sessions = (
        SurveySession.objects.filter(
            employee=employee, completed_at__isnull=True, started_at__gte=_live_session_cutoff()
        )
        .select_related("test")
        .prefetch_related("answers__question")
        .order_by("-started_at")
    )
    return [s for s in sessions if not is_expired(s.test, today)]
```

(No change needed in `views.py` — the `in_progress` action calls `in_progress_sessions(employee)` and `today` defaults to `timezone.localdate()`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && .venv/bin/pytest tests/test_survey_status_progress.py -k in_progress -v`
Expected: PASS (2 tests).

- [ ] **Step 5: Confirm no import cycle / no regression**

Run: `cd backend && .venv/bin/pytest tests/test_surveys_api.py -k in_progress -v`
Expected: PASS (`test_in_progress_lists_only_own_unfinished_sessions` — plain `TestFactory` never expires, so it still lists).

- [ ] **Step 6: Commit**

```bash
git add backend/apps/surveys/services.py backend/tests/test_survey_status_progress.py
git commit -m "feat(surveys): in-progress list drops expired-window sessions, prefetches answers"
```

---

### Task 4: Progress counts on `SurveySessionSerializer`

**Files:**
- Modify: `backend/apps/surveys/serializers.py:178-198`
- Test: `backend/tests/test_survey_status_progress.py`

**Interfaces:**
- Produces: `SurveySessionSerializer` now emits `answered_count: int` and `total_count: int` (section headers excluded; answered = non-empty option list or non-blank text).

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_survey_status_progress.py`:

```python
# --- progress counts ---------------------------------------------------------

from .test_surveys_api import _start, survey_with_questions  # noqa: E402,F401


def test_in_progress_reports_progress_counts(survey_with_questions):
    survey, q_single, q_text = survey_with_questions
    emp = EmployeeFactory()
    client = kiosk_client(emp.id)
    session_id = _start(client, survey, emp).data["session"]["id"]
    client.post(
        f"{SESSIONS}{session_id}/answer/",
        {"question": q_single.id, "selectedOptionIds": ["a"]},
        format="json",
    )
    resp = client.get(f"{SESSIONS}in-progress/?employee={emp.id}")
    row = next(s for s in resp.data if s["id"] == session_id)
    assert row["total_count"] == 2
    assert row["answered_count"] == 1


def test_progress_excludes_section_headers(survey_with_questions):
    survey, q_single, q_text = survey_with_questions
    block = survey.blocks.first()
    QuestionFactory(
        block=block, type=Question.Type.SECTION_HEADER, order=5, options=[]
    )
    emp = EmployeeFactory()
    client = kiosk_client(emp.id)
    session_id = _start(client, survey, emp).data["session"]["id"]
    resp = client.get(f"{SESSIONS}in-progress/?employee={emp.id}")
    row = next(s for s in resp.data if s["id"] == session_id)
    assert row["total_count"] == 2  # the section header is not counted
    assert row["answered_count"] == 0
```

Note: `survey_with_questions` and `_start` are imported from `test_surveys_api`; pytest resolves the fixture by name.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && .venv/bin/pytest tests/test_survey_status_progress.py -k progress -v`
Expected: FAIL with `KeyError: 'total_count'`.

- [ ] **Step 3: Implement the serializer fields**

In `backend/apps/surveys/serializers.py`, replace `SurveySessionSerializer` (lines 178-198) with:

```python
class SurveySessionSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)
    test_title = serializers.CharField(source="test.title", read_only=True)
    status = serializers.ReadOnlyField()
    answered_count = serializers.SerializerMethodField()
    total_count = serializers.SerializerMethodField()

    class Meta:
        model = SurveySession
        fields = [
            "id",
            "employee",
            "employee_name",
            "test",
            "test_title",
            "created_by",
            "face_verified",
            "model_version",
            "started_at",
            "completed_at",
            "status",
            "answered_count",
            "total_count",
        ]
        read_only_fields = fields

    def _progress(self, obj):
        """(answered, total) over scorable questions (section headers excluded),
        computed once per object from the prefetched answers."""
        cached = getattr(obj, "_progress_cache", None)
        if cached is not None:
            return cached
        scorable = [
            a for a in obj.answers.all()
            if a.question.type != Question.Type.SECTION_HEADER
        ]
        answered = sum(
            1 for a in scorable if a.selected_option_ids or a.text_value.strip()
        )
        cached = (answered, len(scorable))
        obj._progress_cache = cached
        return cached

    def get_answered_count(self, obj):
        return self._progress(obj)[0]

    def get_total_count(self, obj):
        return self._progress(obj)[1]
```

(`Question` is already imported at `serializers.py:7`. `read_only_fields = fields` including declared read-only fields matches the existing pattern for `status` and the `blocks`/`answers` in `SurveySessionDetailSerializer`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && .venv/bin/pytest tests/test_survey_status_progress.py -k progress -v`
Expected: PASS (2 tests).

- [ ] **Step 5: Regression — the serializer is shared by start/submit/detail**

Run: `cd backend && .venv/bin/pytest tests/test_surveys_api.py -v`
Expected: PASS (start/submit/in-progress/retrieve all still green with the two extra fields).

- [ ] **Step 6: Commit**

```bash
git add backend/apps/surveys/serializers.py backend/tests/test_survey_status_progress.py
git commit -m "feat(surveys): expose answered_count/total_count on session serializer"
```

---

### Task 5: `survey_expired` guard on `start` and `submit`

**Files:**
- Modify: `backend/apps/surveys/views.py` (import line 27; `start` action ~383; `submit` action ~439)
- Test: `backend/tests/test_survey_status_progress.py`

**Interfaces:**
- Consumes: `is_expired` (Task 1).
- Produces: `POST start/` and `POST {id}/submit/` return HTTP 409 with body `{"detail": ..., "code": "survey_expired"}` when the survey's window has closed.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_survey_status_progress.py`:

```python
# --- expired guard on start/submit -------------------------------------------

def test_start_blocked_when_expired(monkeypatch):
    emp = EmployeeFactory()
    survey = TestFactory(test_days_from=1, test_days_to=10, month=[7])
    monkeypatch.setattr(
        "django.utils.timezone.localdate", lambda: datetime.date(2026, 7, 20)
    )
    resp = kiosk_client(emp.id).post(
        f"{SESSIONS}start/", {"employee": emp.id, "test": survey.id}, format="json"
    )
    assert resp.status_code == 409, resp.data
    assert resp.data["code"] == "survey_expired"


def test_start_allowed_when_open(monkeypatch):
    emp = EmployeeFactory()
    survey = TestFactory(test_days_from=1, test_days_to=31, month=[7])
    monkeypatch.setattr(
        "django.utils.timezone.localdate", lambda: datetime.date(2026, 7, 20)
    )
    resp = kiosk_client(emp.id).post(
        f"{SESSIONS}start/", {"employee": emp.id, "test": survey.id}, format="json"
    )
    assert resp.status_code in (200, 201), resp.data


def test_submit_blocked_when_expired(monkeypatch):
    emp = EmployeeFactory()
    survey = TestFactory(test_days_from=1, test_days_to=10, month=[7])
    session = SurveySessionFactory(test=survey, employee=emp)  # started in-window earlier
    monkeypatch.setattr(
        "django.utils.timezone.localdate", lambda: datetime.date(2026, 7, 20)
    )
    resp = kiosk_client(emp.id).post(
        f"{SESSIONS}{session.id}/submit/", {"answers": []}, format="json"
    )
    assert resp.status_code == 409, resp.data
    assert resp.data["code"] == "survey_expired"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && .venv/bin/pytest tests/test_survey_status_progress.py -k "start_blocked or submit_blocked" -v`
Expected: FAIL (currently `start`/`submit` return 200/201, not 409).

- [ ] **Step 3: Implement the guard**

In `backend/apps/surveys/views.py`:

Change the scheduling import (line 27) from:

```python
from .scheduling import due_surveys
```

to:

```python
from .scheduling import due_surveys, is_expired
```

In the `start` action, right after `survey = serializer.validated_data["test"]` (currently line 383), insert:

```python
        survey = serializer.validated_data["test"]
        if is_expired(survey, timezone.localdate()):
            return Response(
                {"detail": "This survey's submission window has closed.",
                 "code": "survey_expired"},
                status=status.HTTP_409_CONFLICT,
            )
```

In the `submit` action, right after the employee-mismatch check (currently lines 437-439, ending with the `PermissionDenied(... "kiosk_mismatch" ...)`), insert before `serializer = SubmitSerializer(...)`:

```python
        if is_expired(session.test, timezone.localdate()):
            return Response(
                {"detail": "This survey's submission window has closed.",
                 "code": "survey_expired"},
                status=status.HTTP_409_CONFLICT,
            )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && .venv/bin/pytest tests/test_survey_status_progress.py -k "start_ or submit_" -v`
Expected: PASS (`start_blocked`, `start_allowed`, `submit_blocked`).

- [ ] **Step 5: Full backend regression**

Run: `cd backend && .venv/bin/pytest -q`
Expected: PASS — all pre-existing tests plus the new file. (Existing `start`/`submit` tests use plain `TestFactory()` with `test_days_to=None`, which `is_expired` never flags.)

- [ ] **Step 6: Commit**

```bash
git add backend/apps/surveys/views.py backend/tests/test_survey_status_progress.py
git commit -m "feat(surveys): block start/submit of expired surveys (survey_expired 409)"
```

---

### Task 6: Frontend — badges + progress bar + dedup

**Files:**
- Modify: `frontend/src/sections/app/survey-kiosk/api/types.ts:28-43`
- Modify: `frontend/src/sections/app/survey-kiosk/components/due-surveys-step.tsx`
- Modify: `frontend/src/locales/langs/uz/survey.json` (`kiosk.due` block)
- Modify: `frontend/src/locales/langs/ru/survey.json` (`kiosk.due` block)

**Interfaces:**
- Consumes: `SurveySession.answeredCount` / `.totalCount` (Task 4, humps-converted).
- Produces: `DueSurveysStep` renders one row per survey with a status `<Label>` and a `<LinearProgress>` on in-progress rows; available tests are de-duplicated against in-progress sessions.

- [ ] **Step 1: Add progress fields to the session type**

In `frontend/src/sections/app/survey-kiosk/api/types.ts`, in the `SurveySession` type (lines 31-43), add after `status`:

```ts
  status: SurveySessionStatus;
  /** Answered / total scorable questions (section headers excluded). */
  answeredCount: number;
  totalCount: number;
```

- [ ] **Step 2: Add i18n keys (uz + ru)**

In `frontend/src/locales/langs/uz/survey.json`, replace the `due` block (lines 36-41) with:

```json
    "due": {
      "title": "Mavjud so‘rovlar",
      "subtitle": "Xodim: {{name}}",
      "continueTitle": "Davom ettirish",
      "empty": "Mavjud so‘rovlar yo‘q",
      "status": { "notStarted": "Boshlanmagan", "inProgress": "Jarayonda" },
      "progress": "{{answered}} / {{total}} savol"
    },
```

In `frontend/src/locales/langs/ru/survey.json`, replace the `due` block (lines 36-41) with:

```json
    "due": {
      "title": "Доступные опросы",
      "subtitle": "Сотрудник: {{name}}",
      "continueTitle": "Продолжить",
      "empty": "Нет доступных опросов",
      "status": { "notStarted": "Не начат", "inProgress": "В процессе" },
      "progress": "{{answered}} / {{total}} вопросов"
    },
```

- [ ] **Step 3: Extend `SurveyRow` with status + progress**

In `frontend/src/sections/app/survey-kiosk/components/due-surveys-step.tsx`, add imports at the top (after the existing MUI imports):

```ts
import LinearProgress from '@mui/material/LinearProgress';
import Label from 'src/components/label';
```

Replace the entire `SurveyRow` function (lines 22-59) with:

```tsx
function SurveyRow({
  title,
  icon,
  color,
  status,
  progress,
  onClick,
}: {
  title: string;
  icon: string;
  color: 'primary' | 'info';
  status: 'not_started' | 'in_progress';
  progress?: { answered: number; total: number };
  onClick: () => void;
}) {
  const { tx } = useLocales();
  const showProgress = !!progress && progress.total > 0;
  const pct = showProgress ? Math.round((progress!.answered / progress!.total) * 100) : 0;

  return (
    <Card variant="outlined">
      <CardActionArea onClick={onClick} sx={{ p: 3 }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: `${color}.lighter`,
              color: `${color}.main`,
              flexShrink: 0,
            }}
          >
            <Iconify icon={icon} width={24} />
          </Box>

          <Stack spacing={0.75} sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" noWrap>
              {title}
            </Typography>
            {showProgress && (
              <Stack spacing={0.5}>
                <LinearProgress
                  variant="determinate"
                  value={pct}
                  sx={{ height: 6, borderRadius: 1 }}
                />
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {tx('survey.kiosk.due.progress', {
                    answered: progress!.answered,
                    total: progress!.total,
                  })}
                </Typography>
              </Stack>
            )}
          </Stack>

          <Label variant="soft" color={status === 'in_progress' ? 'warning' : 'default'}>
            {tx(
              status === 'in_progress'
                ? 'survey.kiosk.due.status.inProgress'
                : 'survey.kiosk.due.status.notStarted'
            )}
          </Label>
          <Iconify icon="eva:arrow-ios-forward-fill" />
        </Stack>
      </CardActionArea>
    </Card>
  );
}
```

- [ ] **Step 4: Wire status/progress + dedup in `DueSurveysStep`**

In the same file, inside `DueSurveysStep`, after `const { tx } = useLocales();` (line 69) add the dedup:

```tsx
  const { tx } = useLocales();

  // A survey that is in progress belongs only in the "continue" section — never
  // also in "available". The backend already de-dupes; this guards render races.
  const inProgressTestIds = new Set(inProgressSessions.map((s) => s.test));
  const availableTests = tests.filter((t) => !inProgressTestIds.has(t.id));
```

Update the continue-section `<SurveyRow>` (currently lines 91-99) to pass status + progress:

```tsx
          {inProgressSessions.map((session) => (
            <SurveyRow
              key={session.id}
              title={session.testTitle}
              icon="solar:restart-bold-duotone"
              color="info"
              status="in_progress"
              progress={{ answered: session.answeredCount, total: session.totalCount }}
              onClick={() => onContinue?.(session)}
            />
          ))}
```

Replace the empty-state condition (currently line 103) and the available section (currently lines 107-123) to use `availableTests` and pass `status="not_started"`:

```tsx
      {!isLoading && availableTests.length === 0 && inProgressSessions.length === 0 && (
        <EmptyContent filled title={tx('survey.kiosk.due.empty')} sx={{ py: 8 }} />
      )}

      {!isLoading && availableTests.length > 0 && (
        <Stack spacing={1.5}>
          {inProgressSessions.length > 0 && (
            <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
              {tx('survey.kiosk.due.title')}
            </Typography>
          )}
          {availableTests.map((test) => (
            <SurveyRow
              key={test.id}
              title={test.title}
              icon="solar:clipboard-list-bold-duotone"
              color="primary"
              status="not_started"
              onClick={() => onPick(test)}
            />
          ))}
        </Stack>
      )}
```

- [ ] **Step 5: Typecheck**

Run: `cd frontend && yarn tsc --noEmit -p tsconfig.json`
Expected: PASS (no type errors; `answeredCount`/`totalCount` resolve on `SurveySession`).

- [ ] **Step 6: Build**

Run: `cd frontend && yarn build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/sections/app/survey-kiosk/api/types.ts \
        frontend/src/sections/app/survey-kiosk/components/due-surveys-step.tsx \
        frontend/src/locales/langs/uz/survey.json \
        frontend/src/locales/langs/ru/survey.json
git commit -m "feat(kiosk): status badges + progress bar on survey list, de-dupe in-progress"
```

---

### Task 7: Frontend — friendly `survey_expired` handling

**Files:**
- Modify: `frontend/src/utils/error-reader.ts`
- Modify: `frontend/src/sections/app/survey-kiosk/due-surveys-view.tsx`
- Modify: `frontend/src/sections/app/survey-kiosk/survey-form-view.tsx`
- Modify: `frontend/src/locales/langs/uz/survey.json` (`kiosk.form` block)
- Modify: `frontend/src/locales/langs/ru/survey.json` (`kiosk.form` block)

**Interfaces:**
- Consumes: backend 409 `{"code": "survey_expired"}` (Task 5).
- Produces: `errorCode(error) -> string | null`; both the start (list) and submit (form) flows show a localized "срок истёк" toast instead of a raw error, and return the employee to `/scan`.

- [ ] **Step 1: Add `errorCode` helper**

In `frontend/src/utils/error-reader.ts`, append (after `errorReader`):

```ts
/** The DRF `code` discriminator on an error body, if any (e.g. "survey_expired"). */
export function errorCode(error: unknown): string | null {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const code = (data as Record<string, unknown>).code;
      if (typeof code === 'string') {
        return code;
      }
    }
  }
  return null;
}
```

- [ ] **Step 2: Add `form.expired` i18n (uz + ru)**

In `frontend/src/locales/langs/uz/survey.json`, add to the `kiosk.form` block (after `"saveFailed"`, line 55) — remember the comma:

```json
      "saveFailed": "Saqlab bo‘lmadi",
      "expired": "So‘rov muddati tugagan"
```

In `frontend/src/locales/langs/ru/survey.json`, likewise:

```json
      "saveFailed": "Не удалось сохранить",
      "expired": "Срок сдачи опроса истёк"
```

- [ ] **Step 3: Handle it in the start flow**

In `frontend/src/sections/app/survey-kiosk/due-surveys-view.tsx`:

Add the locales import (after the other `src/...` imports, ~line 5):

```ts
import useLocales from 'src/locales/use-locales';
```

Change the error-reader import (line 5) to also pull `errorCode`:

```ts
import { errorCode, errorReader } from 'src/utils/error-reader';
```

Inside the component, after `const { enqueueSnackbar } = useSnackbar();` (line 18) add:

```ts
  const { tx } = useLocales();
```

Replace the `onError` in `handlePick` (currently line 34) with:

```ts
          onError: (err) => {
            if (errorCode(err) === 'survey_expired') {
              enqueueSnackbar(tx('survey.kiosk.form.expired'), { variant: 'warning' });
              dueQuery.refetch();
              inProgressQuery.refetch();
              return;
            }
            enqueueSnackbar(errorReader(err), { variant: 'error' });
          },
```

Add `tx` to the `handlePick` dependency array (currently `[employeeId, startMutation, navigate, enqueueSnackbar]`):

```ts
    [employeeId, startMutation, navigate, enqueueSnackbar, tx, dueQuery, inProgressQuery]
```

- [ ] **Step 4: Handle it in the submit flow**

In `frontend/src/sections/app/survey-kiosk/survey-form-view.tsx`:

Add the locales import (after the other `src/...` imports, ~line 6):

```ts
import useLocales from 'src/locales/use-locales';
```

Change the error-reader import (line 6) to also pull `errorCode`:

```ts
import { errorCode, errorReader } from 'src/utils/error-reader';
```

Inside the component, after `const { enqueueSnackbar } = useSnackbar();` (line 26) add:

```ts
  const { tx } = useLocales();
```

Replace the `onError` in `handleSubmit`'s `submitMutation.mutate` (currently line 122) with:

```ts
        onError: (err) => {
          if (errorCode(err) === 'survey_expired') {
            enqueueSnackbar(tx('survey.kiosk.form.expired'), { variant: 'warning' });
            reset();
            navigate(paths.scan, { replace: true });
            return;
          }
          enqueueSnackbar(errorReader(err), { variant: 'error' });
        },
```

Add `tx`, `reset`, `navigate` to the `handleSubmit` dependency array (currently `[sessionQuery.data, answers, submitMutation, enqueueSnackbar, flushPending, sessionId]`):

```ts
  }, [sessionQuery.data, answers, submitMutation, enqueueSnackbar, flushPending, sessionId, tx, reset, navigate]);
```

- [ ] **Step 5: Typecheck**

Run: `cd frontend && yarn tsc --noEmit -p tsconfig.json`
Expected: PASS.

- [ ] **Step 6: Build**

Run: `cd frontend && yarn build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/utils/error-reader.ts \
        frontend/src/sections/app/survey-kiosk/due-surveys-view.tsx \
        frontend/src/sections/app/survey-kiosk/survey-form-view.tsx \
        frontend/src/locales/langs/uz/survey.json \
        frontend/src/locales/langs/ru/survey.json
git commit -m "feat(kiosk): friendly survey_expired handling on start/submit"
```

---

### Task 8: Full regression + acceptance sweep

**Files:** none (verification only).

- [ ] **Step 1: Full backend suite**

Run: `cd backend && .venv/bin/pytest -q`
Expected: PASS — the entire suite (186 prior + the new `test_survey_status_progress.py`).

- [ ] **Step 2: Frontend gates**

Run: `cd frontend && yarn tsc --noEmit -p tsconfig.json && yarn build`
Expected: both PASS.

- [ ] **Step 3: Acceptance check against the spec's Done criteria**

Confirm by reading the diff / running the app:
1. One row per survey; no survey appears in both "Davom ettirish" and "Mavjud".
2. Not-started rows show the "Не начат" badge; in-progress rows show "В процессе" + a progress bar with `X / Y вопросов`.
3. Completed and expired surveys are absent from the list.
4. `start`/`submit` of an expired survey return 409 `survey_expired`; the UI shows the localized toast and returns to `/scan`.
5. Progress counts are correct (blank answers not counted; section headers excluded).

- [ ] **Step 4: No commit needed** (verification task). If any gap is found, fix in the owning task and re-run.

---

## Self-Review

**Spec coverage:**
- §5.1 due dedup → Task 2. ✓
- §5.2 in-progress prefetch + expired exclusion → Task 3; progress fields → Task 4. ✓
- §5.3 expired guard on start/submit → Task 5 (uses `is_expired` from Task 1). ✓
- §5.4 backend tests → Tasks 1-5 each carry their tests; Task 8 runs the full suite. ✓
- §6.1 SurveyRow badge/progress → Task 6 Step 3. ✓
- §6.2 DueSurveysStep wiring + dedup → Task 6 Step 4. ✓
- §6.3 type fields → Task 6 Step 1. ✓
- §6.4 i18n status/progress → Task 6 Step 2 (uz+ru). ✓
- §6.5 survey_expired handling → Task 7. ✓
- §6.6 typecheck+build → Tasks 6/7/8. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code; every run step shows the command + expected result. ✓

**Type consistency:** `is_expired(test, today)` signature identical across Tasks 1/3/5. Serializer emits `answered_count`/`total_count` (Task 4) → type `answeredCount`/`totalCount` (Task 6 Step 1) → consumed as `session.answeredCount`/`.totalCount` (Task 6 Step 4). `errorCode` defined in Task 7 Step 1 and imported in Steps 3-4. Status literal `'not_started' | 'in_progress'` consistent between `SurveyRow` prop (Task 6 Step 3) and call sites (Step 4). ✓
