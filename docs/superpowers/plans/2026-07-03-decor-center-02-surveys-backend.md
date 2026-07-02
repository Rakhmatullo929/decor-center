# Surveys Backend App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the new Django app `apps.surveys` (models, scheduling, serializers, services, viewsets, seed presets, dashboard rewrite) that replaces the reference `assessments`/`instructions` apps with a scoreless employee-opinion survey engine, fully covered by a green pytest suite.

**Architecture:** `apps.surveys` reuses Plan 1's Employee model + face-recognition registry. `Test → QuestionBlock → Question` defines opinion surveys; a `SurveySession` records one employee run gated by Face-ID (except admin-conducted 1-on-1s), and `Answer` rows store polymorphic responses (`selected_option_ids` for single/multiple, `text_value` for textarea) with NO correctness or scoring. A `scheduling.due_surveys()` function computes which surveys are "due" for an employee on a given day. REST endpoints under `/api/v1/` expose CRUD + kiosk actions (identify/due/start/submit) + admin actions (admin-fill/results/export).

**Tech Stack:** Django 5.2 + DRF, PostgreSQL 18, pytest + factory_boy, openpyxl (XLSX), mock face backend in dev/CI.

## Global Constraints
- Django 5.2 + DRF; PostgreSQL 18; Python venv at `backend/.venv`.
- Every `depo`/`DEPO_` token is already `decor`/`DECOR_` (Plan 1); reference all settings via `settings.DECOR[...]`.
- NO scoring anywhere: no `score`, `passed`, `total`, `correct_option`, `is_correct`, `pass_threshold`.
- i18n stays ru + uz on the frontend (Plan 3); backend stores raw strings only.
- Mock face backend in dev/CI (`apps.integrations.mocks.MockFaceRecognitionService`), insightface in prod — resolved via `settings.DECOR["FACE_RECOGNITION_BACKEND"]`.
- Roles are `ADMIN='admin'`, `SPECIALIST='specialist'` (kiosk device user, display "Сотрудник"); no MEDIC.
- All models inherit `apps.core.models.TimeStampedModel` (except `FaceVerificationLog`, which mirrors the reference audit-log shape).
- `SurveySession.face_embedding` is `editable=False` and is NEVER serialized to the API.
- Submit re-verification is OFF by default via `settings.DECOR["REVERIFY_ON_SUBMIT"]` (`"off"|"log"|"block"`).
- All test files live under `backend/tests/` (pytest `testpaths = ["tests"]`).
- Run backend commands from `backend/`; use `.venv/bin/pytest` and `.venv/bin/ruff`.
- Commit after every green task.

---

## Interfaces produced by Plan 1 (consumed here — names are fixed)

- `apps.core.models.TimeStampedModel` — abstract base with `created_at`, `updated_at`.
- `apps.core.excel.xlsx_response(*, filename: str, sheet_title: str, headers: list[str], rows) -> HttpResponse`.
- `apps.accounts.models.Roles` (`ADMIN`, `SPECIALIST`), `apps.accounts.models.User` (`.role`).
- `apps.accounts.permissions`: `IsAdmin`, `IsSpecialist`, `IsAdminOrSpecialist`, `IsAdminOrReadOnly`, `HasAnyRole`.
- `apps.employees.models.Employee` — `full_name`, `specialty` FK, `photo`, `face_embedding` (JSON, editable=False, NOT serialized), `is_active`, `hire_date` (DateField null/blank), `work_experience` (PositiveIntegerField null/blank).
- `apps.employees.serializers.EmployeeSerializer`.
- `apps.integrations.registry.get_face_recognition_service()` → service with:
  - `compare(embedding, image_bytes) -> (matched: bool, score: float)`
  - `extract_embedding(image_bytes) -> list[float]` (raises `apps.integrations.base.NoFaceDetectedError`)
  - `compare_embeddings(e1, e2) -> (bool, float)`
  - `identify_best_match(candidates: list[tuple[int, list[float]]], image_bytes=None, *, live_embedding=None) -> (best_id: int|None, score: float)`
- `apps.employees.face_enrollment.backend_model_version(service) -> str`.
- `settings.DECOR` dict incl. `"FACE_RECOGNITION_BACKEND"`, `"REVERIFY_ON_SUBMIT"` (default `"off"` in test/dev), `"FACE_SIMILARITY_THRESHOLD"`.
- `backend/tests/conftest.py` fixtures: `api_client`, `admin_user`, `specialist_user`, `admin_client`, `specialist_client`, `face_image`, `face_image_fail`, `photo_without_face`, `png_bytes()`.
- `backend/tests/factories.py`: `UserFactory`, `SpecialtyFactory`, `EmployeeFactory` (with a valid mock `face_embedding`).
- `config/api_v1.py` — DRF `DefaultRouter` under `/api/v1/`.

> **NOTE on the mock backend:** `MockFaceRecognitionService.extract_embedding` hashes the image bytes, so two different images produce non-matching embeddings. `EmployeeFactory.face_embedding` equals the embedding of the `face_image` fixture's bytes, so `face_image` matches (Face-ID pass) and `face_image_fail` (bytes + `b"FAILMATCH"`) does not (Face-ID fail). `photo_without_face` (bytes + `b"NOFACE"`) raises `NoFaceDetectedError` → `compare` returns `(False, 0.0)`.

---

### Task 1: App scaffold + INSTALLED_APPS registration

**Files:**
- Create: `backend/apps/surveys/__init__.py`
- Create: `backend/apps/surveys/apps.py`
- Create: `backend/apps/surveys/models.py` (empty placeholder — filled in Task 2)
- Create: `backend/apps/surveys/migrations/__init__.py`
- Modify: `backend/config/settings/base.py` (INSTALLED_APPS — add `apps.surveys`)
- Test: `backend/tests/test_surveys_app.py`

**Interfaces:**
- Consumes: Django app registry, `settings.INSTALLED_APPS`.
- Produces: `apps.surveys.apps.SurveysConfig` (app label `surveys`); `apps.surveys` importable and installed.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_surveys_app.py
from django.apps import apps


def test_surveys_app_is_installed():
    assert apps.is_installed("apps.surveys")
    config = apps.get_app_config("surveys")
    assert config.name == "apps.surveys"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && .venv/bin/pytest tests/test_surveys_app.py -q
```
Expected: `LookupError: No installed app with label 'surveys'.` (test errors/fails).

- [ ] **Step 3: Write minimal implementation**

```python
# backend/apps/surveys/__init__.py
```
(empty file)

```python
# backend/apps/surveys/apps.py
from django.apps import AppConfig


class SurveysConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.surveys"
```

```python
# backend/apps/surveys/models.py
# Models are defined in Task 2.
```

```python
# backend/apps/surveys/migrations/__init__.py
```
(empty file)

Then add `apps.surveys` to `INSTALLED_APPS` in `backend/config/settings/base.py`, immediately after `apps.integrations`:

```python
    "apps.integrations",
    "apps.surveys",
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && .venv/bin/pytest tests/test_surveys_app.py -q
```
Expected: `1 passed`.

- [ ] **Step 5: Commit**

```bash
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center && \
git add backend/apps/surveys backend/config/settings/base.py backend/tests/test_surveys_app.py && \
git commit -m "surveys: scaffold app + register in INSTALLED_APPS

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Models + migration 0001 + factories

**Files:**
- Modify: `backend/apps/surveys/models.py` (replace placeholder with full models)
- Create: `backend/apps/surveys/migrations/0001_initial.py` (generated)
- Modify: `backend/tests/factories.py` (add survey factories)
- Test: `backend/tests/test_surveys_models.py`

**Interfaces:**
- Consumes: `apps.core.models.TimeStampedModel`, `apps.employees.models.Employee`, `apps.accounts.models.User`.
- Produces:
  - `Test(title, is_active, is_admin_conducted, is_after_application, after_days, test_days_from, test_days_to, month)` + constraint `after_days_required_when_after_application`.
  - `QuestionBlock(test FK→blocks, order, title)`.
  - `Question.Type` (`SINGLE='single'`, `MULTIPLE='multiple'`, `TEXTAREA='textarea'`); `Question(block FK→questions, type, order, text, options)`.
  - `SurveySession(test FK→sessions, employee FK→survey_sessions, created_by FK nullable, face_verified, face_embedding editable=False, model_version, started_at, completed_at)`.
  - `Answer(session FK→answers, question FK→answers, selected_option_ids, text_value)` + unique `(session, question)`.
  - `FaceVerificationLog.Stage` (`START='start'`, `SUBMIT='submit'`); `FaceVerificationLog(employee, session, stage, success, similarity_score, reason, created_at)`.
  - Factories: `TestFactory`, `QuestionBlockFactory`, `QuestionFactory`, `SurveySessionFactory`.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_surveys_models.py
import pytest
from django.db import IntegrityError

from apps.surveys.models import Answer, Question, QuestionBlock, SurveySession, Test

from .factories import (
    EmployeeFactory,
    QuestionBlockFactory,
    QuestionFactory,
    SurveySessionFactory,
    TestFactory,
)

pytestmark = pytest.mark.django_db


def test_test_defaults():
    survey = TestFactory()
    assert survey.is_active is True
    assert survey.is_admin_conducted is False
    assert survey.is_after_application is False
    assert survey.month == []


def test_after_application_requires_after_days():
    with pytest.raises(IntegrityError):
        Test.objects.create(title="Bad", is_after_application=True, after_days=None)


def test_after_application_with_after_days_ok():
    survey = Test.objects.create(title="OK", is_after_application=True, after_days=30)
    assert survey.after_days == 30


def test_question_type_choices_and_options_shape():
    block = QuestionBlockFactory()
    q = QuestionFactory(
        block=block,
        type=Question.Type.SINGLE,
        options=[{"id": "a", "text": "Yes"}, {"id": "b", "text": "No"}],
    )
    assert q.type == "single"
    assert q.options[0]["id"] == "a"


def test_block_and_question_ordering():
    survey = TestFactory()
    b2 = QuestionBlockFactory(test=survey, order=2)
    b1 = QuestionBlockFactory(test=survey, order=1)
    assert list(survey.blocks.all()) == [b1, b2]
    q2 = QuestionFactory(block=b1, order=2)
    q1 = QuestionFactory(block=b1, order=1)
    assert list(b1.questions.all()) == [q1, q2]


def test_answer_unique_per_session_question():
    session = SurveySessionFactory()
    question = QuestionFactory()
    Answer.objects.create(session=session, question=question)
    with pytest.raises(IntegrityError):
        Answer.objects.create(session=session, question=question)


def test_session_face_embedding_not_editable():
    field = SurveySession._meta.get_field("face_embedding")
    assert field.editable is False


def test_answer_polymorphic_payload_defaults():
    session = SurveySessionFactory()
    question = QuestionFactory(type=Question.Type.TEXTAREA, options=[])
    answer = Answer.objects.create(session=session, question=question, text_value="Great job")
    assert answer.selected_option_ids == []
    assert answer.text_value == "Great job"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && .venv/bin/pytest tests/test_surveys_models.py -q
```
Expected: `ImportError: cannot import name 'Answer' from 'apps.surveys.models'` (collection error).

- [ ] **Step 3: Write minimal implementation**

```python
# backend/apps/surveys/models.py
from django.db import models

from apps.core.models import TimeStampedModel


class Test(TimeStampedModel):
    """Opinion-survey definition (no scoring, no correct answers)."""

    title = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)
    # Filled in by an admin during a 1-on-1 conversation; never appears in the kiosk list.
    is_admin_conducted = models.BooleanField(default=False)

    # Mode A: one-shot, N days after hire.
    is_after_application = models.BooleanField(default=False)
    after_days = models.PositiveIntegerField(null=True, blank=True)

    # Mode B: periodic, within a day-of-month window inside the listed months.
    test_days_from = models.PositiveSmallIntegerField(null=True, blank=True)  # 1..31
    test_days_to = models.PositiveSmallIntegerField(null=True, blank=True)  # 1..31
    month = models.JSONField(default=list, blank=True)  # e.g. [1,4,7,10]; [] => every month

    class Meta:
        ordering = ["title"]
        constraints = [
            models.CheckConstraint(
                name="after_days_required_when_after_application",
                condition=(
                    models.Q(is_after_application=False)
                    | models.Q(after_days__isnull=False)
                ),
            ),
        ]

    def __str__(self):
        return self.title


class QuestionBlock(TimeStampedModel):
    test = models.ForeignKey(Test, on_delete=models.CASCADE, related_name="blocks")
    order = models.PositiveIntegerField(default=0)
    title = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return self.title or f"Block<{self.pk}>"


class Question(TimeStampedModel):
    class Type(models.TextChoices):
        SINGLE = "single", "По одному (radio)"
        MULTIPLE = "multiple", "Несколько (checkbox)"
        TEXTAREA = "textarea", "Свободный текст"

    block = models.ForeignKey(
        QuestionBlock, on_delete=models.CASCADE, related_name="questions"
    )
    type = models.CharField(max_length=16, choices=Type.choices, default=Type.SINGLE)
    order = models.PositiveIntegerField(default=0)
    text = models.TextField()
    # Stable option IDs so analytics survive reordering: [{"id": "<uuid>", "text": "..."}].
    options = models.JSONField(default=list, blank=True)  # [] for textarea

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return self.text[:60]


class SurveySession(TimeStampedModel):
    """One survey run by an employee. Face-ID gated (except admin-conducted). No scoring."""

    test = models.ForeignKey(Test, on_delete=models.PROTECT, related_name="sessions")
    employee = models.ForeignKey(
        "employees.Employee", on_delete=models.PROTECT, related_name="survey_sessions"
    )
    # Set when filled by an admin (1-on-1) — then Face-ID is not required.
    created_by = models.ForeignKey(
        "accounts.User",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    # Face-ID snapshot frozen at start (mirrors the assessments session freeze).
    face_verified = models.BooleanField(default=False)
    face_embedding = models.JSONField(null=True, blank=True, editable=False)
    model_version = models.CharField(max_length=64, blank=True)
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-started_at"]

    def __str__(self):
        return f"{self.employee_id} — {self.test_id} ({self.started_at:%Y-%m-%d %H:%M})"


class Answer(TimeStampedModel):
    session = models.ForeignKey(
        SurveySession, on_delete=models.CASCADE, related_name="answers"
    )
    question = models.ForeignKey(
        Question, on_delete=models.PROTECT, related_name="answers"
    )
    # Polymorphic response payload (no correctness).
    selected_option_ids = models.JSONField(default=list, blank=True)  # list[str]
    text_value = models.TextField(blank=True)  # textarea

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["session", "question"], name="unique_session_question"
            ),
        ]


class FaceVerificationLog(models.Model):
    """Audit of every kiosk Face-ID attempt (ported from assessments)."""

    class Stage(models.TextChoices):
        START = "start", "Survey start"
        SUBMIT = "submit", "Survey submit"

    employee = models.ForeignKey(
        "employees.Employee",
        on_delete=models.PROTECT,
        related_name="survey_face_logs",
    )
    session = models.ForeignKey(
        SurveySession,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="face_logs",
    )
    stage = models.CharField(max_length=10, choices=Stage.choices, default=Stage.START)
    success = models.BooleanField()
    similarity_score = models.FloatField(null=True, blank=True)
    reason = models.CharField(max_length=20, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
```

Append the survey factories to `backend/tests/factories.py`:

```python
# --- appended to backend/tests/factories.py ---
from apps.surveys.models import Question, QuestionBlock, SurveySession, Test


class TestFactory(DjangoModelFactory):
    class Meta:
        model = Test

    title = factory.Sequence(lambda n: f"Survey {n}")
    is_active = True


class QuestionBlockFactory(DjangoModelFactory):
    class Meta:
        model = QuestionBlock

    test = factory.SubFactory(TestFactory)
    order = 0
    title = factory.Sequence(lambda n: f"Block {n}")


class QuestionFactory(DjangoModelFactory):
    class Meta:
        model = Question

    block = factory.SubFactory(QuestionBlockFactory)
    type = Question.Type.SINGLE
    text = factory.Sequence(lambda n: f"Question {n}?")
    options = factory.LazyFunction(
        lambda: [{"id": "a", "text": "Yes"}, {"id": "b", "text": "No"}]
    )
    order = 0


class SurveySessionFactory(DjangoModelFactory):
    class Meta:
        model = SurveySession

    test = factory.SubFactory(TestFactory)
    employee = factory.SubFactory(EmployeeFactory)
```

> If Plan 1 left an `assessments` import at the top of `factories.py`, it must already be removed by Plan 1; do NOT re-add it.

Generate the migration:

```bash
cd backend && .venv/bin/python manage.py makemigrations surveys
```
Expected: `Migrations for 'surveys': apps/surveys/migrations/0001_initial.py`.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && .venv/bin/pytest tests/test_surveys_models.py -q
```
Expected: `8 passed`.

- [ ] **Step 5: Commit**

```bash
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center && \
git add backend/apps/surveys/models.py backend/apps/surveys/migrations/0001_initial.py backend/tests/factories.py backend/tests/test_surveys_models.py && \
git commit -m "surveys: models Test/QuestionBlock/Question/SurveySession/Answer/FaceVerificationLog + migration + factories

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: scheduling.due_surveys + full branch coverage

**Files:**
- Create: `backend/apps/surveys/scheduling.py`
- Test: `backend/tests/test_scheduling.py`

**Interfaces:**
- Consumes: `Test`, `SurveySession` (Task 2); `employee.hire_date` (Plan 1).
- Produces: `due_surveys(employee, today: datetime.date) -> list[Test]`.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_scheduling.py
import datetime

import pytest

from apps.surveys.models import SurveySession
from apps.surveys.scheduling import due_surveys

from .factories import EmployeeFactory, TestFactory

pytestmark = pytest.mark.django_db


def _complete(test, employee, when):
    """Create a completed session for `test`/`employee` at datetime `when`."""
    session = SurveySession.objects.create(test=test, employee=employee)
    SurveySession.objects.filter(pk=session.pk).update(completed_at=when)
    return session


def test_after_application_triggers_when_days_elapsed():
    emp = EmployeeFactory(hire_date=datetime.date(2026, 6, 1))
    survey = TestFactory(is_after_application=True, after_days=30)
    assert survey in due_surveys(emp, datetime.date(2026, 7, 1))  # 30 days later


def test_after_application_not_yet_due():
    emp = EmployeeFactory(hire_date=datetime.date(2026, 6, 1))
    survey = TestFactory(is_after_application=True, after_days=30)
    assert due_surveys(emp, datetime.date(2026, 6, 20)) == []


def test_after_application_skips_when_no_hire_date():
    emp = EmployeeFactory(hire_date=None)
    TestFactory(is_after_application=True, after_days=30)
    assert due_surveys(emp, datetime.date(2026, 7, 1)) == []


def test_after_application_idempotent_after_completion():
    emp = EmployeeFactory(hire_date=datetime.date(2026, 6, 1))
    survey = TestFactory(is_after_application=True, after_days=30)
    _complete(survey, emp, datetime.datetime(2026, 7, 1, 9, 0))
    assert due_surveys(emp, datetime.date(2026, 7, 5)) == []


def test_periodic_in_month_and_window():
    emp = EmployeeFactory(hire_date=datetime.date(2020, 1, 1))
    survey = TestFactory(month=[7], test_days_from=1, test_days_to=7)
    assert survey in due_surveys(emp, datetime.date(2026, 7, 3))


def test_periodic_out_of_month():
    emp = EmployeeFactory(hire_date=datetime.date(2020, 1, 1))
    TestFactory(month=[7], test_days_from=1, test_days_to=7)
    assert due_surveys(emp, datetime.date(2026, 8, 3)) == []


def test_periodic_out_of_day_window():
    emp = EmployeeFactory(hire_date=datetime.date(2020, 1, 1))
    TestFactory(month=[7], test_days_from=1, test_days_to=7)
    assert due_surveys(emp, datetime.date(2026, 7, 20)) == []


def test_periodic_empty_month_means_every_month():
    emp = EmployeeFactory(hire_date=datetime.date(2020, 1, 1))
    survey = TestFactory(month=[], test_days_from=1, test_days_to=5)
    assert survey in due_surveys(emp, datetime.date(2026, 3, 2))
    assert survey in due_surveys(emp, datetime.date(2026, 11, 4))


def test_periodic_short_month_clamps_upper_bound():
    emp = EmployeeFactory(hire_date=datetime.date(2020, 1, 1))
    # 2027 February has 28 days; a window of 25..31 clamps to 25..28.
    survey = TestFactory(month=[2], test_days_from=25, test_days_to=31)
    assert survey in due_surveys(emp, datetime.date(2027, 2, 28))


def test_periodic_idempotent_within_window_but_returns_next_period():
    emp = EmployeeFactory(hire_date=datetime.date(2020, 1, 1))
    survey = TestFactory(month=[], test_days_from=1, test_days_to=7)
    _complete(survey, emp, datetime.datetime(2026, 7, 2, 9, 0))
    # Same window -> suppressed.
    assert due_surveys(emp, datetime.date(2026, 7, 4)) == []
    # Next month's window -> due again.
    assert survey in due_surveys(emp, datetime.date(2026, 8, 3))


def test_admin_conducted_excluded_from_due():
    emp = EmployeeFactory(hire_date=datetime.date(2020, 1, 1))
    TestFactory(is_admin_conducted=True, month=[], test_days_from=1, test_days_to=28)
    assert due_surveys(emp, datetime.date(2026, 7, 3)) == []


def test_inactive_test_excluded():
    emp = EmployeeFactory(hire_date=datetime.date(2020, 1, 1))
    TestFactory(is_active=False, month=[], test_days_from=1, test_days_to=28)
    assert due_surveys(emp, datetime.date(2026, 7, 3)) == []
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && .venv/bin/pytest tests/test_scheduling.py -q
```
Expected: `ModuleNotFoundError: No module named 'apps.surveys.scheduling'`.

- [ ] **Step 3: Write minimal implementation**

```python
# backend/apps/surveys/scheduling.py
"""Compute which surveys are 'due' for an employee on a given day (spec §4.2)."""
import calendar
import datetime

from .models import SurveySession, Test

ALL_MONTHS = list(range(1, 13))


def _last_day_of_month(year: int, month: int) -> int:
    return calendar.monthrange(year, month)[1]


def _completed_ever(test: Test, employee) -> bool:
    return SurveySession.objects.filter(
        test=test, employee=employee, completed_at__isnull=False
    ).exists()


def _completed_since(test: Test, employee, window_start: datetime.date) -> bool:
    return SurveySession.objects.filter(
        test=test,
        employee=employee,
        completed_at__isnull=False,
        completed_at__date__gte=window_start,
    ).exists()


def due_surveys(employee, today: datetime.date) -> list[Test]:
    """Return active, non-admin-conducted surveys currently due for `employee`.

    - after_application: one-shot once `days_since_hire >= after_days`; suppressed forever
      once completed.
    - periodic: due when `today.month` is in `month` ([] => every month) and `today.day`
      falls inside `test_days_from..test_days_to` (upper bound clamped to the month's last
      day); suppressed once completed within the current month's window.
    """
    hire = employee.hire_date
    days = None if hire is None else (today - hire).days
    result: list[Test] = []

    for test in Test.objects.filter(is_active=True, is_admin_conducted=False):
        if test.is_after_application:
            if days is None or test.after_days is None:
                continue
            if days >= test.after_days and not _completed_ever(test, employee):
                result.append(test)
        else:
            months = test.month or ALL_MONTHS
            if today.month not in months:
                continue
            lo = test.test_days_from or 1
            hi = min(
                test.test_days_to or lo,
                _last_day_of_month(today.year, today.month),
            )
            if not (lo <= today.day <= hi):
                continue
            window_start = datetime.date(today.year, today.month, lo)
            if not _completed_since(test, employee, window_start):
                result.append(test)
    return result
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && .venv/bin/pytest tests/test_scheduling.py -q
```
Expected: `12 passed`.

- [ ] **Step 5: Commit**

```bash
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center && \
git add backend/apps/surveys/scheduling.py backend/tests/test_scheduling.py && \
git commit -m "surveys: due_surveys scheduling + full branch coverage

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Serializers

**Files:**
- Create: `backend/apps/surveys/serializers.py`
- Test: `backend/tests/test_surveys_serializers.py`

**Interfaces:**
- Consumes: `Test`, `QuestionBlock`, `Question`, `SurveySession`, `Answer` (Task 2); `Employee` (Plan 1).
- Produces:
  - `QuestionSerializer` (admin CRUD; validates options-shape per `type`).
  - `QuestionPublicSerializer` (kiosk read: `id`, `type`, `order`, `text`, `options`).
  - `QuestionBlockSerializer` (`id`, `test`, `order`, `title`, `questions` nested public).
  - `TestSerializer` (CRUD + nested read-only `blocks`; validates after_days).
  - `StartSurveySerializer` (`employee`, `test`, `face_image`).
  - `AnswerItemSerializer` (`question`, `selectedOptionIds`, `textValue`).
  - `SubmitSerializer` (`answers`, optional `faceImage`).
  - `AdminFillSerializer` (`employee`, `test`, `answers`).
  - `SurveySessionSerializer`, `SurveySessionDetailSerializer`.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_surveys_serializers.py
import pytest

from apps.surveys.models import Question
from apps.surveys.serializers import (
    QuestionSerializer,
    SubmitSerializer,
    TestSerializer,
)

from .factories import QuestionBlockFactory, TestFactory

pytestmark = pytest.mark.django_db


def test_question_single_requires_option_shape():
    block = QuestionBlockFactory()
    ser = QuestionSerializer(
        data={"block": block.id, "type": "single", "text": "Q", "options": []}
    )
    assert not ser.is_valid()
    assert "options" in ser.errors


def test_question_single_assigns_missing_option_ids():
    block = QuestionBlockFactory()
    ser = QuestionSerializer(
        data={
            "block": block.id,
            "type": "single",
            "text": "Q",
            "options": [{"text": "Yes"}, {"text": "No"}],
        }
    )
    assert ser.is_valid(), ser.errors
    opts = ser.validated_data["options"]
    assert all(opt["id"] for opt in opts)
    assert len({opt["id"] for opt in opts}) == 2


def test_question_textarea_forces_empty_options():
    block = QuestionBlockFactory()
    ser = QuestionSerializer(
        data={
            "block": block.id,
            "type": "textarea",
            "text": "Q",
            "options": [{"id": "x", "text": "nope"}],
        }
    )
    assert not ser.is_valid()
    assert "options" in ser.errors


def test_test_after_application_requires_after_days():
    ser = TestSerializer(
        data={"title": "T", "is_after_application": True, "after_days": None}
    )
    assert not ser.is_valid()
    assert "after_days" in ser.errors


def test_test_nested_blocks_read():
    survey = TestFactory()
    block = QuestionBlockFactory(test=survey, title="B1")
    Question.objects.create(block=block, type="textarea", text="Free", options=[])
    data = TestSerializer(survey).data
    assert data["blocks"][0]["title"] == "B1"
    assert data["blocks"][0]["questions"][0]["type"] == "textarea"


def test_submit_serializer_camel_case_fields():
    ser = SubmitSerializer(
        data={
            "answers": [
                {"question": 1, "selectedOptionIds": ["a"]},
                {"question": 2, "textValue": "hello"},
            ]
        }
    )
    assert ser.is_valid(), ser.errors
    assert ser.validated_data["answers"][0]["selectedOptionIds"] == ["a"]
    assert ser.validated_data["answers"][1]["textValue"] == "hello"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && .venv/bin/pytest tests/test_surveys_serializers.py -q
```
Expected: `ModuleNotFoundError: No module named 'apps.surveys.serializers'`.

- [ ] **Step 3: Write minimal implementation**

```python
# backend/apps/surveys/serializers.py
import uuid

from rest_framework import serializers

from apps.employees.models import Employee

from .models import Answer, Question, QuestionBlock, SurveySession, Test


def _validate_options_shape(options):
    """Validate/normalize a list of {id, text}; assign a uuid for any missing id."""
    if not isinstance(options, list) or not options:
        raise serializers.ValidationError("Options must be a non-empty list.")
    normalized = []
    for opt in options:
        if not isinstance(opt, dict) or not str(opt.get("text", "")).strip():
            raise serializers.ValidationError(
                "Each option must be an object with non-empty 'text'."
            )
        oid = str(opt.get("id") or uuid.uuid4())
        normalized.append({"id": oid, "text": opt["text"]})
    ids = [opt["id"] for opt in normalized]
    if len(ids) != len(set(ids)):
        raise serializers.ValidationError("Option ids must be unique.")
    return normalized


class QuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = ["id", "block", "type", "order", "text", "options"]

    def validate(self, attrs):
        q_type = attrs.get("type", getattr(self.instance, "type", Question.Type.SINGLE))
        options = attrs.get("options", getattr(self.instance, "options", []))
        if q_type == Question.Type.TEXTAREA:
            if options:
                raise serializers.ValidationError(
                    {"options": "Textarea questions must have no options."}
                )
            attrs["options"] = []
        else:
            attrs["options"] = _validate_options_shape(options)
        return attrs


class QuestionPublicSerializer(serializers.ModelSerializer):
    """Question as presented to the kiosk — no correctness data (there is none)."""

    class Meta:
        model = Question
        fields = ["id", "type", "order", "text", "options"]


class QuestionBlockSerializer(serializers.ModelSerializer):
    questions = QuestionPublicSerializer(many=True, read_only=True)

    class Meta:
        model = QuestionBlock
        fields = ["id", "test", "order", "title", "questions"]


class TestSerializer(serializers.ModelSerializer):
    blocks = QuestionBlockSerializer(many=True, read_only=True)

    class Meta:
        model = Test
        fields = [
            "id",
            "title",
            "is_active",
            "is_admin_conducted",
            "is_after_application",
            "after_days",
            "test_days_from",
            "test_days_to",
            "month",
            "blocks",
        ]

    def validate(self, attrs):
        is_after = attrs.get(
            "is_after_application",
            getattr(self.instance, "is_after_application", False),
        )
        after_days = attrs.get(
            "after_days", getattr(self.instance, "after_days", None)
        )
        if is_after and after_days is None:
            raise serializers.ValidationError(
                {"after_days": "Required when is_after_application is true."}
            )
        return attrs


class StartSurveySerializer(serializers.Serializer):
    employee = serializers.PrimaryKeyRelatedField(
        queryset=Employee.objects.filter(is_active=True)
    )
    test = serializers.PrimaryKeyRelatedField(
        queryset=Test.objects.filter(is_active=True)
    )
    face_image = serializers.ImageField()


class AnswerItemSerializer(serializers.Serializer):
    question = serializers.IntegerField()
    selectedOptionIds = serializers.ListField(  # noqa: N815 (client contract camelCase)
        child=serializers.CharField(), required=False, default=list
    )
    textValue = serializers.CharField(  # noqa: N815
        required=False, allow_blank=True, default=""
    )


class SubmitSerializer(serializers.Serializer):
    answers = AnswerItemSerializer(many=True, allow_empty=False)
    # Optional base64 (raw or data-URL) camera frame for submit-time re-verification.
    faceImage = serializers.CharField(required=False, allow_blank=True)  # noqa: N815


class AdminFillSerializer(serializers.Serializer):
    employee = serializers.PrimaryKeyRelatedField(
        queryset=Employee.objects.filter(is_active=True)
    )
    test = serializers.PrimaryKeyRelatedField(queryset=Test.objects.all())
    answers = AnswerItemSerializer(many=True, allow_empty=False)


class AnswerReadSerializer(serializers.ModelSerializer):
    question_text = serializers.CharField(source="question.text", read_only=True)
    question_type = serializers.CharField(source="question.type", read_only=True)

    class Meta:
        model = Answer
        fields = [
            "question",
            "question_text",
            "question_type",
            "selected_option_ids",
            "text_value",
        ]


class SurveySessionSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)
    test_title = serializers.CharField(source="test.title", read_only=True)

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
        ]
        read_only_fields = fields


class SurveySessionDetailSerializer(SurveySessionSerializer):
    answers = AnswerReadSerializer(many=True, read_only=True)

    class Meta(SurveySessionSerializer.Meta):
        fields = SurveySessionSerializer.Meta.fields + ["answers"]
        read_only_fields = fields
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && .venv/bin/pytest tests/test_surveys_serializers.py -q
```
Expected: `6 passed`.

- [ ] **Step 5: Commit**

```bash
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center && \
git add backend/apps/surveys/serializers.py backend/tests/test_surveys_serializers.py && \
git commit -m "surveys: serializers (Test/Block/Question CRUD + start/submit/admin-fill + session read)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: services.py (start / submit / admin_fill / verify_submit_face)

**Files:**
- Create: `backend/apps/surveys/services.py`
- Test: `backend/tests/test_surveys_services.py`

**Interfaces:**
- Consumes: `get_face_recognition_service()`, `backend_model_version()`, `NoFaceDetectedError`, `settings.DECOR["REVERIFY_ON_SUBMIT"]`; `Question`, `Answer`, `SurveySession`, `FaceVerificationLog`, `Test`.
- Produces:
  - Exceptions `FaceVerificationError`, `SurveyFlowError`, `FaceCaptureRequiredError`.
  - `SubmitFaceResult(checked, matched, reason, score)` dataclass.
  - `verify_submit_face(session, image_bytes) -> SubmitFaceResult`.
  - `start_survey_session(*, employee, test, face_image_bytes) -> tuple[SurveySession, list[Question]]`.
  - `submit_survey_session(*, session, answers: list[dict], face_image_bytes=None) -> SurveySession`.
  - `admin_fill(*, employee, test, answers: list[dict], user) -> SurveySession`.

> `answers` items use the client-contract keys `question`, `selectedOptionIds`, `textValue` (as produced by `AnswerItemSerializer`).

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_surveys_services.py
import datetime

import pytest

from apps.surveys.models import Answer, Question, SurveySession
from apps.surveys.services import (
    FaceVerificationError,
    SurveyFlowError,
    admin_fill,
    start_survey_session,
    submit_survey_session,
)

from .factories import (
    EmployeeFactory,
    QuestionBlockFactory,
    QuestionFactory,
    TestFactory,
    UserFactory,
)
from .conftest import png_bytes

pytestmark = pytest.mark.django_db


def _survey_with_questions():
    survey = TestFactory()
    block = QuestionBlockFactory(test=survey, order=0)
    q_single = QuestionFactory(
        block=block,
        type=Question.Type.SINGLE,
        order=0,
        options=[{"id": "a", "text": "Yes"}, {"id": "b", "text": "No"}],
    )
    q_text = QuestionFactory(
        block=block, type=Question.Type.TEXTAREA, order=1, options=[]
    )
    return survey, q_single, q_text


def test_start_creates_session_and_freezes_questions():
    emp = EmployeeFactory()
    survey, q_single, q_text = _survey_with_questions()
    session, questions = start_survey_session(
        employee=emp, test=survey, face_image_bytes=png_bytes()
    )
    assert session.face_verified is True
    assert session.face_embedding == emp.face_embedding
    assert session.model_version == "mock-16"
    assert {q.id for q in questions} == {q_single.id, q_text.id}
    # Presented set frozen as empty Answer rows.
    assert Answer.objects.filter(session=session).count() == 2


def test_start_face_failure_creates_no_session():
    emp = EmployeeFactory()
    survey, _, _ = _survey_with_questions()
    with pytest.raises(FaceVerificationError):
        start_survey_session(
            employee=emp, test=survey, face_image_bytes=png_bytes() + b"FAILMATCH"
        )
    assert SurveySession.objects.count() == 0


def test_start_without_embedding_is_flow_error():
    emp = EmployeeFactory(face_embedding=None)
    survey, _, _ = _survey_with_questions()
    with pytest.raises(SurveyFlowError):
        start_survey_session(
            employee=emp, test=survey, face_image_bytes=png_bytes()
        )


def test_submit_persists_answers_and_completes():
    emp = EmployeeFactory()
    survey, q_single, q_text = _survey_with_questions()
    session, _ = start_survey_session(
        employee=emp, test=survey, face_image_bytes=png_bytes()
    )
    session = submit_survey_session(
        session=session,
        answers=[
            {"question": q_single.id, "selectedOptionIds": ["a"], "textValue": ""},
            {"question": q_text.id, "selectedOptionIds": [], "textValue": "Great"},
        ],
    )
    assert session.completed_at is not None
    single_answer = Answer.objects.get(session=session, question=q_single)
    text_answer = Answer.objects.get(session=session, question=q_text)
    assert single_answer.selected_option_ids == ["a"]
    assert text_answer.text_value == "Great"


def test_submit_rejects_already_completed():
    emp = EmployeeFactory()
    survey, q_single, _ = _survey_with_questions()
    session, _ = start_survey_session(
        employee=emp, test=survey, face_image_bytes=png_bytes()
    )
    submit_survey_session(
        session=session,
        answers=[{"question": q_single.id, "selectedOptionIds": ["a"], "textValue": ""}],
    )
    with pytest.raises(SurveyFlowError):
        submit_survey_session(
            session=session,
            answers=[{"question": q_single.id, "selectedOptionIds": ["b"], "textValue": ""}],
        )


def test_submit_rejects_foreign_question():
    emp = EmployeeFactory()
    survey, q_single, _ = _survey_with_questions()
    other = QuestionFactory()
    session, _ = start_survey_session(
        employee=emp, test=survey, face_image_bytes=png_bytes()
    )
    with pytest.raises(SurveyFlowError):
        submit_survey_session(
            session=session,
            answers=[{"question": other.id, "selectedOptionIds": ["a"], "textValue": ""}],
        )


def test_admin_fill_creates_completed_session_without_face():
    emp = EmployeeFactory(face_embedding=None)  # no face needed
    admin = UserFactory()
    survey, q_single, q_text = _survey_with_questions()
    session = admin_fill(
        employee=emp,
        test=survey,
        user=admin,
        answers=[
            {"question": q_single.id, "selectedOptionIds": ["b"], "textValue": ""},
            {"question": q_text.id, "selectedOptionIds": [], "textValue": "ok"},
        ],
    )
    assert session.completed_at is not None
    assert session.created_by == admin
    assert session.face_verified is False
    assert Answer.objects.filter(session=session).count() == 2
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && .venv/bin/pytest tests/test_surveys_services.py -q
```
Expected: `ModuleNotFoundError: No module named 'apps.surveys.services'`.

- [ ] **Step 3: Write minimal implementation**

```python
# backend/apps/surveys/services.py
"""Survey session domain logic: Face-ID gate, answer persistence. No scoring."""
import logging
from dataclasses import dataclass

from django.conf import settings as django_settings
from django.db import transaction
from django.utils import timezone

from apps.employees.face_enrollment import backend_model_version
from apps.employees.models import Employee
from apps.integrations.base import NoFaceDetectedError
from apps.integrations.registry import get_face_recognition_service

from .models import Answer, FaceVerificationLog, Question, SurveySession, Test

logger = logging.getLogger(__name__)


class FaceVerificationError(Exception):
    """Face-ID failed — the survey must not start."""


class SurveyFlowError(Exception):
    """Invalid survey flow (missing embedding, resubmit, foreign question, etc.)."""


class FaceCaptureRequiredError(SurveyFlowError):
    """Block-mode submit re-verify required a face capture but none was provided."""


@dataclass
class SubmitFaceResult:
    checked: bool
    matched: bool
    reason: str
    score: float


def verify_submit_face(session: SurveySession, image_bytes: bytes | None) -> SubmitFaceResult:
    """Compare a submit-time frame against the session's frozen snapshot (per DECOR mode).

    A FaceVerificationLog row is written only when a real comparison happens.
    """
    mode = django_settings.DECOR["REVERIFY_ON_SUBMIT"]
    if mode == "off":
        return SubmitFaceResult(False, False, "off", 0.0)
    if not session.face_embedding:
        logger.info("Session %s has no face snapshot; skipping submit re-verify.", session.pk)
        return SubmitFaceResult(False, False, "no_snapshot", 0.0)

    service = get_face_recognition_service()
    active_version = backend_model_version(service)
    if active_version != session.model_version:
        logger.warning(
            "Session %s snapshot version %r != active %r; skipping submit re-verify.",
            session.pk, session.model_version, active_version,
        )
        return SubmitFaceResult(False, False, "model_mismatch", 0.0)

    if image_bytes is None:
        logger.info("Session %s submit had no face capture (mode=%s).", session.pk, mode)
        return SubmitFaceResult(False, False, "no_capture", 0.0)

    try:
        live = service.extract_embedding(image_bytes)
    except NoFaceDetectedError:
        matched, score, reason = False, 0.0, "no_face"
    else:
        matched, score = service.compare_embeddings(session.face_embedding, live)
        reason = "ok" if matched else "mismatch"

    FaceVerificationLog.objects.create(
        employee=session.employee,
        session=session,
        stage=FaceVerificationLog.Stage.SUBMIT,
        success=matched,
        similarity_score=score,
        reason=reason,
    )
    return SubmitFaceResult(True, matched, reason, score)


def _presented_questions(test: Test) -> list[Question]:
    return list(
        Question.objects.filter(block__test=test).order_by("block__order", "order", "id")
    )


def start_survey_session(
    *, employee: Employee, test: Test, face_image_bytes: bytes
) -> tuple[SurveySession, list[Question]]:
    """Verify Face-ID, then create a session and freeze the presented question set."""
    if not employee.face_embedding:
        raise SurveyFlowError(
            "Employee has no reference photo embedding. Contact the administrator."
        )

    service = get_face_recognition_service()
    matched, score = service.compare(employee.face_embedding, face_image_bytes)
    FaceVerificationLog.objects.create(
        employee=employee,
        stage=FaceVerificationLog.Stage.START,
        success=matched,
        similarity_score=score,
    )
    if not matched:
        raise FaceVerificationError("Face-ID check failed: face does not match or not detected.")

    questions = _presented_questions(test)
    with transaction.atomic():
        session = SurveySession.objects.create(
            employee=employee,
            test=test,
            face_verified=True,
            face_embedding=employee.face_embedding,
            model_version=backend_model_version(service),
        )
        Answer.objects.bulk_create(
            [Answer(session=session, question=question) for question in questions]
        )
    return session, questions


def _apply_answer(row: Answer, item: dict) -> None:
    """Write one polymorphic answer payload onto a frozen Answer row (no correctness)."""
    if row.question.type == Question.Type.TEXTAREA:
        row.text_value = item.get("textValue", "")
        row.selected_option_ids = []
    else:
        row.selected_option_ids = item.get("selectedOptionIds", [])
        row.text_value = ""


def submit_survey_session(
    *, session: SurveySession, answers: list[dict], face_image_bytes: bytes | None = None
) -> SurveySession:
    """Persist answers (optional submit re-verify), set completed_at. No score."""
    if session.completed_at is not None:
        raise SurveyFlowError("This survey session is already completed.")

    mode = django_settings.DECOR["REVERIFY_ON_SUBMIT"]
    result = verify_submit_face(session, face_image_bytes)
    if mode == "block":
        if result.reason == "no_capture":
            raise FaceCaptureRequiredError("Face capture is required to submit this survey.")
        if result.checked and not result.matched:
            raise FaceVerificationError(
                "Face re-verification failed: the face does not match."
            )

    rows = {row.question_id: row for row in session.answers.select_related("question")}
    submitted_ids = [item["question"] for item in answers]
    if len(submitted_ids) != len(set(submitted_ids)):
        raise SurveyFlowError("Duplicate answers for the same question.")
    if not set(submitted_ids) <= set(rows):
        raise SurveyFlowError("Answers must reference questions presented in this session.")

    with transaction.atomic():
        for item in answers:
            row = rows[item["question"]]
            _apply_answer(row, item)
        Answer.objects.bulk_update(rows.values(), ["selected_option_ids", "text_value"])
        session.completed_at = timezone.now()
        session.save(update_fields=["completed_at", "updated_at"])
    return session


def admin_fill(
    *, employee: Employee, test: Test, answers: list[dict], user
) -> SurveySession:
    """Create an already-completed session for an admin 1-on-1 (no Face-ID)."""
    questions = {q.id: q for q in _presented_questions(test)}
    submitted_ids = [item["question"] for item in answers]
    if len(submitted_ids) != len(set(submitted_ids)):
        raise SurveyFlowError("Duplicate answers for the same question.")
    if not set(submitted_ids) <= set(questions):
        raise SurveyFlowError("Answers must reference questions of this survey.")

    with transaction.atomic():
        session = SurveySession.objects.create(
            employee=employee,
            test=test,
            created_by=user,
            face_verified=False,
            completed_at=timezone.now(),
        )
        rows = []
        for item in answers:
            row = Answer(session=session, question=questions[item["question"]])
            _apply_answer(row, item)
            rows.append(row)
        Answer.objects.bulk_create(rows)
    return session
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && .venv/bin/pytest tests/test_surveys_services.py -q
```
Expected: `7 passed`.

- [ ] **Step 5: Commit**

```bash
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center && \
git add backend/apps/surveys/services.py backend/tests/test_surveys_services.py && \
git commit -m "surveys: services start/submit/admin_fill + submit re-verify port (no scoring)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Views (viewsets + kiosk/admin actions) + api_v1 registration

**Files:**
- Create: `backend/apps/surveys/views.py`
- Create: `backend/apps/surveys/filters.py`
- Modify: `backend/config/api_v1.py` (register survey viewsets; drop assessments imports)
- Test: `backend/tests/test_surveys_api.py`

**Interfaces:**
- Consumes: serializers (Task 4), services (Task 5), `scheduling.due_surveys` (Task 3), `EmployeeSerializer`, permissions, `get_face_recognition_service`, `xlsx_response`.
- Produces (routed under `/api/v1/`):
  - `TestViewSet` → `tests/` (`IsAdminOrReadOnly`).
  - `QuestionBlockViewSet` → `question-blocks/` (`IsAdminOrReadOnly`).
  - `QuestionViewSet` → `questions/` (`IsAdminOrReadOnly`).
  - `SurveySessionViewSet` → `survey-sessions/` with actions `identify`, `due`, `start`, `submit`, `admin-fill` (`admin_fill` method), `results`, `export`.

> Router registers `admin_fill` as URL `admin-fill/` via `@action(url_path="admin-fill")`.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_surveys_api.py
import datetime

import pytest

from apps.surveys.models import Answer, Question, SurveySession

from .factories import (
    EmployeeFactory,
    QuestionBlockFactory,
    QuestionFactory,
    TestFactory,
)

pytestmark = pytest.mark.django_db

SESSIONS = "/api/v1/survey-sessions/"
TESTS = "/api/v1/tests/"


@pytest.fixture
def survey_with_questions(db):
    survey = TestFactory()
    block = QuestionBlockFactory(test=survey, order=0)
    q_single = QuestionFactory(
        block=block, type=Question.Type.SINGLE, order=0,
        options=[{"id": "a", "text": "Yes"}, {"id": "b", "text": "No"}],
    )
    q_text = QuestionFactory(block=block, type=Question.Type.TEXTAREA, order=1, options=[])
    return survey, q_single, q_text


# --- RBAC on CRUD -----------------------------------------------------------

def test_tests_list_readable_by_specialist(specialist_client):
    assert specialist_client.get(TESTS).status_code == 200


def test_tests_write_admin_only(specialist_client, admin_client):
    payload = {"title": "New"}
    assert specialist_client.post(TESTS, payload, format="json").status_code == 403
    assert admin_client.post(TESTS, payload, format="json").status_code == 201


def test_question_write_requires_admin(specialist_client, admin_client):
    block = QuestionBlockFactory()
    payload = {"block": block.id, "type": "textarea", "text": "Q", "options": []}
    assert specialist_client.post("/api/v1/questions/", payload, format="json").status_code == 403
    assert admin_client.post("/api/v1/questions/", payload, format="json").status_code == 201


# --- identify ---------------------------------------------------------------

def test_identify_returns_employee(specialist_client, face_image):
    emp = EmployeeFactory()
    face_image.seek(0)
    resp = specialist_client.post(
        f"{SESSIONS}identify/", {"face_image": face_image}, format="multipart"
    )
    assert resp.status_code == 200, resp.data
    assert resp.data["employee"]["id"] == emp.id


def test_identify_unknown_face_404(specialist_client, face_image_fail):
    EmployeeFactory()
    face_image_fail.seek(0)
    resp = specialist_client.post(
        f"{SESSIONS}identify/", {"face_image": face_image_fail}, format="multipart"
    )
    assert resp.status_code == 404


# --- due --------------------------------------------------------------------

def test_due_lists_scheduled_surveys(specialist_client):
    emp = EmployeeFactory(hire_date=datetime.date(2026, 6, 1))
    survey = TestFactory(is_after_application=True, after_days=1)
    resp = specialist_client.get(f"{SESSIONS}due/?employee={emp.id}")
    assert resp.status_code == 200
    assert survey.id in [t["id"] for t in resp.data]


# --- start ------------------------------------------------------------------

def test_start_returns_blocks_and_questions(specialist_client, survey_with_questions, face_image):
    survey, q_single, q_text = survey_with_questions
    emp = EmployeeFactory()
    face_image.seek(0)
    resp = specialist_client.post(
        f"{SESSIONS}start/",
        {"employee": emp.id, "test": survey.id, "face_image": face_image},
        format="multipart",
    )
    assert resp.status_code == 201, resp.data
    assert resp.data["test"]["id"] == survey.id
    questions = resp.data["blocks"][0]["questions"]
    assert {q["id"] for q in questions} == {q_single.id, q_text.id}
    assert resp.data["session"]["face_verified"] is True


def test_start_face_failure_403(specialist_client, survey_with_questions, face_image_fail):
    survey, _, _ = survey_with_questions
    emp = EmployeeFactory()
    face_image_fail.seek(0)
    resp = specialist_client.post(
        f"{SESSIONS}start/",
        {"employee": emp.id, "test": survey.id, "face_image": face_image_fail},
        format="multipart",
    )
    assert resp.status_code == 403
    assert SurveySession.objects.count() == 0


# --- submit -----------------------------------------------------------------

def _start(client, survey, emp, face_image):
    face_image.seek(0)
    return client.post(
        f"{SESSIONS}start/",
        {"employee": emp.id, "test": survey.id, "face_image": face_image},
        format="multipart",
    )


def test_submit_persists_answers(specialist_client, survey_with_questions, face_image):
    survey, q_single, q_text = survey_with_questions
    emp = EmployeeFactory()
    start = _start(specialist_client, survey, emp, face_image)
    session_id = start.data["session"]["id"]
    resp = specialist_client.post(
        f"{SESSIONS}{session_id}/submit/",
        {"answers": [
            {"question": q_single.id, "selectedOptionIds": ["a"]},
            {"question": q_text.id, "textValue": "Nice"},
        ]},
        format="json",
    )
    assert resp.status_code == 200, resp.data
    assert resp.data["completed_at"] is not None
    assert Answer.objects.get(session=session_id, question=q_single).selected_option_ids == ["a"]
    assert Answer.objects.get(session=session_id, question=q_text).text_value == "Nice"


# --- admin-fill -------------------------------------------------------------

def test_admin_fill_requires_admin(specialist_client, admin_client, survey_with_questions):
    survey, q_single, _ = survey_with_questions
    survey.is_admin_conducted = True
    survey.save()
    emp = EmployeeFactory(face_embedding=None)
    payload = {
        "employee": emp.id,
        "test": survey.id,
        "answers": [{"question": q_single.id, "selectedOptionIds": ["b"]}],
    }
    assert specialist_client.post(f"{SESSIONS}admin-fill/", payload, format="json").status_code == 403
    resp = admin_client.post(f"{SESSIONS}admin-fill/", payload, format="json")
    assert resp.status_code == 201, resp.data
    assert resp.data["face_verified"] is False


# --- results / export -------------------------------------------------------

def test_results_and_export_admin_only(specialist_client, admin_client, survey_with_questions):
    survey, _, _ = survey_with_questions
    assert specialist_client.get(f"{SESSIONS}results/?test={survey.id}").status_code == 403
    assert admin_client.get(f"{SESSIONS}results/?test={survey.id}").status_code == 200
    export = admin_client.get(f"{SESSIONS}export/?test={survey.id}")
    assert export.status_code == 200
    assert export["Content-Type"].startswith(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && .venv/bin/pytest tests/test_surveys_api.py -q
```
Expected: collection/URL errors — `404` on `/api/v1/survey-sessions/...` and import failures for `apps.surveys.views`.

- [ ] **Step 3: Write minimal implementation**

```python
# backend/apps/surveys/filters.py
import django_filters

from .models import SurveySession


class SurveySessionFilter(django_filters.FilterSet):
    class Meta:
        model = SurveySession
        fields = ["employee", "test"]
```

```python
# backend/apps/surveys/views.py
import base64
import binascii

from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from apps.accounts.permissions import IsAdmin, IsAdminOrReadOnly, IsAdminOrSpecialist
from apps.core.excel import xlsx_response
from apps.employees.models import Employee
from apps.employees.serializers import EmployeeSerializer
from apps.integrations.registry import get_face_recognition_service

from .filters import SurveySessionFilter
from .models import Answer, Question, QuestionBlock, SurveySession, Test
from .scheduling import due_surveys
from .serializers import (
    AdminFillSerializer,
    QuestionBlockSerializer,
    QuestionSerializer,
    StartSurveySerializer,
    SubmitSerializer,
    SurveySessionDetailSerializer,
    SurveySessionSerializer,
    TestSerializer,
)
from .services import (
    FaceCaptureRequiredError,
    FaceVerificationError,
    SurveyFlowError,
    admin_fill,
    start_survey_session,
    submit_survey_session,
)


def _decode_face_image(value: str) -> bytes:
    """Decode a base64 (raw or data-URL) camera frame; raise ValidationError on garbage."""
    if value.strip().startswith("data:") and "," in value:
        value = value.split(",", 1)[1]
    value = "".join(value.split())
    try:
        return base64.b64decode(value, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValidationError({"detail": "Invalid image data.", "code": "invalid_image"}) from exc


class TestViewSet(viewsets.ModelViewSet):
    queryset = Test.objects.prefetch_related("blocks__questions")
    serializer_class = TestSerializer
    permission_classes = [IsAdminOrReadOnly]


class QuestionBlockViewSet(viewsets.ModelViewSet):
    queryset = QuestionBlock.objects.prefetch_related("questions")
    serializer_class = QuestionBlockSerializer
    permission_classes = [IsAdminOrReadOnly]
    filterset_fields = ["test"]


class QuestionViewSet(viewsets.ModelViewSet):
    queryset = Question.objects.all()
    serializer_class = QuestionSerializer
    permission_classes = [IsAdminOrReadOnly]
    filterset_fields = ["block"]


class SurveySessionViewSet(viewsets.ReadOnlyModelViewSet):
    """Survey taking flow (kiosk) + results browsing (admin)."""

    queryset = SurveySession.objects.select_related("employee", "test")
    serializer_class = SurveySessionSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filterset_class = SurveySessionFilter
    ordering_fields = ["employee__full_name", "started_at", "completed_at"]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return SurveySessionDetailSerializer
        return SurveySessionSerializer

    def get_permissions(self):
        if self.action in ("identify", "due", "start", "submit"):
            return [IsAdminOrSpecialist()]
        return [IsAdmin()]

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action == "retrieve":
            queryset = queryset.prefetch_related("answers__question")
        return queryset

    @extend_schema(
        request={
            "multipart/form-data": {
                "type": "object",
                "properties": {"face_image": {"type": "string", "format": "binary"}},
                "required": ["face_image"],
            }
        },
        responses={200: EmployeeSerializer},
    )
    @action(detail=False, methods=["post"])
    def identify(self, request):
        """1:N face search — resolve a live camera frame to an employee."""
        face_image = request.data.get("face_image")
        if not face_image:
            raise ValidationError({"face_image": ["This field is required."]})
        face_image.seek(0)
        face_bytes = face_image.read()

        service = get_face_recognition_service()
        employees = Employee.objects.filter(
            is_active=True, face_embedding__isnull=False
        ).only("id", "face_embedding")
        candidates = [(emp.id, emp.face_embedding) for emp in employees]
        if not candidates:
            return Response(
                {"detail": "No employees with face data are registered."},
                status=status.HTTP_404_NOT_FOUND,
            )

        best_id, score = service.identify_best_match(candidates, face_bytes)
        if best_id is None:
            return Response(
                {"detail": "Face not recognised. Look at the camera and try again."},
                status=status.HTTP_404_NOT_FOUND,
            )
        employee = Employee.objects.select_related("specialty").get(id=best_id)
        return Response({"employee": EmployeeSerializer(employee).data})

    @extend_schema(responses={200: TestSerializer(many=True)})
    @action(detail=False, methods=["get"])
    def due(self, request):
        """List surveys currently due for an employee (kiosk)."""
        employee_id = request.query_params.get("employee")
        if not employee_id:
            raise ValidationError({"employee": ["This query parameter is required."]})
        employee = Employee.objects.filter(pk=employee_id, is_active=True).first()
        if employee is None:
            return Response({"detail": "Employee not found."}, status=status.HTTP_404_NOT_FOUND)
        surveys = due_surveys(employee, timezone.localdate())
        return Response(TestSerializer(surveys, many=True).data)

    @extend_schema(request=StartSurveySerializer)
    @action(detail=False, methods=["post"])
    def start(self, request):
        """Face-ID gate + session creation with a frozen question set."""
        serializer = StartSurveySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        face_image = serializer.validated_data["face_image"]
        face_image.seek(0)
        face_bytes = face_image.read()
        survey = serializer.validated_data["test"]

        try:
            session, _questions = start_survey_session(
                employee=serializer.validated_data["employee"],
                test=survey,
                face_image_bytes=face_bytes,
            )
        except FaceVerificationError as exc:
            raise PermissionDenied({"detail": str(exc), "code": "face_verify_failed"}) from exc
        except SurveyFlowError as exc:
            raise ValidationError({"detail": str(exc)}) from exc

        blocks = QuestionBlock.objects.filter(test=survey).prefetch_related("questions")
        return Response(
            {
                "session": SurveySessionSerializer(session).data,
                "test": {"id": survey.id, "title": survey.title},
                "blocks": QuestionBlockSerializer(blocks, many=True).data,
            },
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(request=SubmitSerializer, responses=SurveySessionSerializer)
    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        """Persist answers (optional submit re-verify) and complete the session."""
        session = self.get_object()
        serializer = SubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        face_b64 = serializer.validated_data.get("faceImage")
        face_bytes = _decode_face_image(face_b64) if face_b64 else None

        try:
            session = submit_survey_session(
                session=session,
                answers=serializer.validated_data["answers"],
                face_image_bytes=face_bytes,
            )
        except FaceCaptureRequiredError as exc:
            return Response(
                {"detail": str(exc), "code": "face_capture_required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except FaceVerificationError as exc:
            return Response(
                {"detail": str(exc), "code": "face_reverify_failed"},
                status=status.HTTP_403_FORBIDDEN,
            )
        except SurveyFlowError as exc:
            raise ValidationError({"detail": str(exc)}) from exc
        return Response(SurveySessionSerializer(session).data)

    @extend_schema(request=AdminFillSerializer, responses=SurveySessionSerializer)
    @action(detail=False, methods=["post"], url_path="admin-fill")
    def admin_fill(self, request):
        """Create a completed session for an admin 1-on-1 (no Face-ID). Admin only."""
        serializer = AdminFillSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            session = admin_fill(
                employee=serializer.validated_data["employee"],
                test=serializer.validated_data["test"],
                answers=serializer.validated_data["answers"],
                user=request.user,
            )
        except SurveyFlowError as exc:
            raise ValidationError({"detail": str(exc)}) from exc
        return Response(
            SurveySessionSerializer(session).data, status=status.HTTP_201_CREATED
        )

    @action(detail=False, methods=["get"])
    def results(self, request):
        """Aggregate completed answers for a survey (option counts + textarea list)."""
        survey = self._require_test(request)
        return Response(_aggregate_results(survey))

    @extend_schema(
        responses={
            (200, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"): bytes
        }
    )
    @action(detail=False, methods=["get"])
    def export(self, request):
        """Download survey aggregation as XLSX. Admin only."""
        survey = self._require_test(request)
        aggregate = _aggregate_results(survey)
        rows = []
        for block in aggregate["blocks"]:
            for question in block["questions"]:
                if question["type"] == Question.Type.TEXTAREA:
                    for text in question["textValues"]:
                        rows.append([block["title"], question["text"], "textarea", text, ""])
                else:
                    for option in question["options"]:
                        rows.append(
                            [block["title"], question["text"], question["type"],
                             option["text"], option["count"]]
                        )
        return xlsx_response(
            filename=f"survey-results-{timezone.localdate():%Y%m%d}.xlsx",
            sheet_title="Survey results",
            headers=["Block", "Question", "Type", "Answer", "Count"],
            rows=rows,
        )

    def _require_test(self, request) -> Test:
        test_id = request.query_params.get("test")
        if not test_id:
            raise ValidationError({"test": ["This query parameter is required."]})
        survey = Test.objects.filter(pk=test_id).first()
        if survey is None:
            raise ValidationError({"test": ["Survey not found."]})
        return survey


def _aggregate_results(survey: Test) -> dict:
    """Build scoreless aggregation: per-option counts + textarea response list."""
    blocks_out = []
    blocks = survey.blocks.prefetch_related("questions__answers__session")
    for block in blocks:
        questions_out = []
        for question in block.questions.all():
            answers = [
                a for a in question.answers.all()
                if a.session.completed_at is not None
            ]
            if question.type == Question.Type.TEXTAREA:
                texts = [a.text_value for a in answers if a.text_value]
                questions_out.append(
                    {
                        "id": question.id,
                        "text": question.text,
                        "type": question.type,
                        "textValues": texts,
                        "responseCount": len(texts),
                    }
                )
            else:
                counts = {opt["id"]: 0 for opt in question.options}
                for answer in answers:
                    for oid in answer.selected_option_ids:
                        if oid in counts:
                            counts[oid] += 1
                questions_out.append(
                    {
                        "id": question.id,
                        "text": question.text,
                        "type": question.type,
                        "options": [
                            {"id": opt["id"], "text": opt["text"], "count": counts[opt["id"]]}
                            for opt in question.options
                        ],
                    }
                )
        blocks_out.append(
            {"id": block.id, "title": block.title, "questions": questions_out}
        )
    return {"test": {"id": survey.id, "title": survey.title}, "blocks": blocks_out}
```

Rewrite `backend/config/api_v1.py`:

```python
# backend/config/api_v1.py
"""API v1 routing: all module endpoints under /api/v1/."""
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import DefaultRouter

from apps.core.views import DashboardStatsView
from apps.employees.views import EmployeeViewSet, SpecialtyViewSet
from apps.surveys.views import (
    QuestionBlockViewSet,
    QuestionViewSet,
    SurveySessionViewSet,
    TestViewSet,
)

router = DefaultRouter()
router.register("specialties", SpecialtyViewSet, basename="specialty")
router.register("employees", EmployeeViewSet, basename="employee")
router.register("tests", TestViewSet, basename="test")
router.register("question-blocks", QuestionBlockViewSet, basename="question-block")
router.register("questions", QuestionViewSet, basename="question")
router.register("survey-sessions", SurveySessionViewSet, basename="survey-session")

urlpatterns = [
    path("auth/", include("apps.accounts.urls")),
    path("dashboard/stats/", DashboardStatsView.as_view(), name="dashboard-stats"),
    path("schema/", SpectacularAPIView.as_view(), name="schema"),
    path("docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
    *router.urls,
]
```

> If Plan 1's `config/api_v1.py` still imports `apps.employees.views` differently, keep the existing employees/specialties imports and only add the surveys block + drop any `assessments`/`instructions`/`medical` imports.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && .venv/bin/pytest tests/test_surveys_api.py -q
```
Expected: `13 passed`.

- [ ] **Step 5: Commit**

```bash
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center && \
git add backend/apps/surveys/views.py backend/apps/surveys/filters.py backend/config/api_v1.py backend/tests/test_surveys_api.py && \
git commit -m "surveys: viewsets + kiosk/admin actions + api_v1 registration + RBAC

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Results aggregation coverage (option counts + textarea)

**Files:**
- Test: `backend/tests/test_surveys_results.py`

**Interfaces:**
- Consumes: `SurveySessionViewSet.results`, `_aggregate_results`, `admin_fill` (via API).
- Produces: no new production code — this task hardens the aggregation contract Plan 3 (frontend Results screen) consumes.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_surveys_results.py
import pytest

from apps.surveys.models import Question

from .factories import EmployeeFactory, QuestionBlockFactory, QuestionFactory, TestFactory

pytestmark = pytest.mark.django_db

SESSIONS = "/api/v1/survey-sessions/"


@pytest.fixture
def filled_survey(admin_client):
    survey = TestFactory(is_admin_conducted=True)
    block = QuestionBlockFactory(test=survey, title="Feedback", order=0)
    q_single = QuestionFactory(
        block=block, type=Question.Type.SINGLE, order=0,
        options=[{"id": "a", "text": "Yes"}, {"id": "b", "text": "No"}],
    )
    q_text = QuestionFactory(block=block, type=Question.Type.TEXTAREA, order=1, options=[])
    # Two employees answer via admin-fill (no Face-ID).
    for choice, comment in (("a", "Loved it"), ("a", "")):
        emp = EmployeeFactory(face_embedding=None)
        admin_client.post(
            f"{SESSIONS}admin-fill/",
            {
                "employee": emp.id,
                "test": survey.id,
                "answers": [
                    {"question": q_single.id, "selectedOptionIds": [choice]},
                    {"question": q_text.id, "textValue": comment},
                ],
            },
            format="json",
        )
    return survey, q_single, q_text


def test_results_option_counts(admin_client, filled_survey):
    survey, q_single, _ = filled_survey
    resp = admin_client.get(f"{SESSIONS}results/?test={survey.id}")
    assert resp.status_code == 200
    question = resp.data["blocks"][0]["questions"][0]
    counts = {opt["id"]: opt["count"] for opt in question["options"]}
    assert counts == {"a": 2, "b": 0}


def test_results_textarea_list(admin_client, filled_survey):
    survey, _, q_text = filled_survey
    resp = admin_client.get(f"{SESSIONS}results/?test={survey.id}")
    text_question = resp.data["blocks"][0]["questions"][1]
    assert text_question["type"] == "textarea"
    assert text_question["textValues"] == ["Loved it"]  # empty comment excluded
    assert text_question["responseCount"] == 1


def test_results_requires_test_param(admin_client):
    assert admin_client.get(f"{SESSIONS}results/").status_code == 400
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && .venv/bin/pytest tests/test_surveys_results.py -q
```
Expected: passes only if Task 6 code is correct; if `results` behavior differs, this reveals it. (If Task 6 was implemented exactly as specified, expected `3 passed` — treat any failure as a bug to fix in Task 6 code, not the test.)

> This is a verification/regression task; if all 3 pass immediately, still perform Steps 4-5 to lock the contract.

- [ ] **Step 3: Write minimal implementation**

No new production code. If any assertion fails, fix `_aggregate_results` / `results` in `backend/apps/surveys/views.py` to satisfy the contract above (this is the authoritative shape Plan 3 consumes).

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && .venv/bin/pytest tests/test_surveys_results.py -q
```
Expected: `3 passed`.

- [ ] **Step 5: Commit**

```bash
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center && \
git add backend/tests/test_surveys_results.py && \
git commit -m "surveys: lock results aggregation contract (option counts + textarea list)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: seed_surveys management command (presets)

**Files:**
- Create: `backend/apps/surveys/management/__init__.py`
- Create: `backend/apps/surveys/management/commands/__init__.py`
- Create: `backend/apps/surveys/management/commands/seed_surveys.py`
- Test: `backend/tests/test_seed_surveys.py`

**Interfaces:**
- Consumes: `Test` (Task 2).
- Produces: `manage.py seed_surveys` — idempotent creation of the 5 presets in spec §4.3.

| Preset | is_after_application | after_days | month | days_from..to | is_admin_conducted |
|---|---|---|---|---|---|
| Через 30 дней после найма | True | 30 | — | — | False |
| Через 90 дней после найма | True | 90 | — | — | False |
| 1в1 ежемесячно (беседа) | False | — | `[]` | — | True |
| Краткий пульс | False | — | `[1,4,7,10]` | 1..7 | False |
| Глубокий опрос | False | — | `[1,7]` | 1..14 | False |

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_seed_surveys.py
import pytest
from django.core.management import call_command

from apps.surveys.models import Test

pytestmark = pytest.mark.django_db


def test_seed_surveys_creates_presets():
    call_command("seed_surveys")
    assert Test.objects.count() == 5
    after_30 = Test.objects.get(title="Через 30 дней после найма")
    assert after_30.is_after_application is True
    assert after_30.after_days == 30
    one_on_one = Test.objects.get(title="1в1 ежемесячно (беседа)")
    assert one_on_one.is_admin_conducted is True
    assert one_on_one.month == []
    pulse = Test.objects.get(title="Краткий пульс")
    assert pulse.month == [1, 4, 7, 10]
    assert pulse.test_days_from == 1
    assert pulse.test_days_to == 7


def test_seed_surveys_is_idempotent():
    call_command("seed_surveys")
    call_command("seed_surveys")
    assert Test.objects.count() == 5
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && .venv/bin/pytest tests/test_seed_surveys.py -q
```
Expected: `CommandError: Unknown command: 'seed_surveys'`.

- [ ] **Step 3: Write minimal implementation**

```python
# backend/apps/surveys/management/__init__.py
```
(empty file)

```python
# backend/apps/surveys/management/commands/__init__.py
```
(empty file)

```python
# backend/apps/surveys/management/commands/seed_surveys.py
"""Seed the standard survey presets (spec §4.3). Idempotent by Test.title."""
from django.core.management.base import BaseCommand

from apps.surveys.models import Test

PRESETS = [
    {
        "title": "Через 30 дней после найма",
        "is_after_application": True,
        "after_days": 30,
        "is_admin_conducted": False,
    },
    {
        "title": "Через 90 дней после найма",
        "is_after_application": True,
        "after_days": 90,
        "is_admin_conducted": False,
    },
    {
        "title": "1в1 ежемесячно (беседа)",
        "is_after_application": False,
        "month": [],
        "is_admin_conducted": True,
    },
    {
        "title": "Краткий пульс",
        "is_after_application": False,
        "month": [1, 4, 7, 10],
        "test_days_from": 1,
        "test_days_to": 7,
        "is_admin_conducted": False,
    },
    {
        "title": "Глубокий опрос",
        "is_after_application": False,
        "month": [1, 7],
        "test_days_from": 1,
        "test_days_to": 14,
        "is_admin_conducted": False,
    },
]


class Command(BaseCommand):
    help = "Create the standard survey presets (idempotent by title)."

    def handle(self, *args, **options):
        created = 0
        for preset in PRESETS:
            _obj, was_created = Test.objects.get_or_create(
                title=preset["title"], defaults=preset
            )
            created += int(was_created)
        self.stdout.write(
            self.style.SUCCESS(f"seed_surveys: {created} created, {len(PRESETS) - created} existed.")
        )
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && .venv/bin/pytest tests/test_seed_surveys.py -q
```
Expected: `2 passed`.

- [ ] **Step 5: Commit**

```bash
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center && \
git add backend/apps/surveys/management backend/tests/test_seed_surveys.py && \
git commit -m "surveys: seed_surveys management command with 5 presets

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Rewrite DashboardStatsView for surveys

**Files:**
- Modify: `backend/apps/core/views.py` (replace assessments/medical/instructions counters with survey counters)
- Test: `backend/tests/test_dashboard_surveys.py`

**Interfaces:**
- Consumes: `SurveySession`, `Test` (Task 2); `Employee` (Plan 1); `IsAdmin`.
- Produces: `GET /api/v1/dashboard/stats/?date=YYYY-MM-DD` → survey counters.

Response shape (Plan 3 dashboard consumes this):
```json
{
  "date": "2026-07-03",
  "sessions": {"total": <int>, "completed": <int>, "in_progress": <int>},
  "totals": {"active_employees": <int>, "active_tests": <int>, "admin_conducted_tests": <int>}
}
```
- `sessions.*` counts `SurveySession` with `started_at__date == date`.
- `completed` = sessions with `completed_at__isnull=False`; `in_progress` = the rest.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_dashboard_surveys.py
import datetime

import pytest
from django.utils import timezone

from apps.surveys.models import SurveySession

from .factories import EmployeeFactory, TestFactory

pytestmark = pytest.mark.django_db

URL = "/api/v1/dashboard/stats/"


def test_dashboard_requires_admin(specialist_client):
    assert specialist_client.get(URL).status_code == 403


def test_dashboard_survey_counters(admin_client):
    survey = TestFactory(is_active=True)
    TestFactory(is_admin_conducted=True)
    emp = EmployeeFactory()
    done = SurveySession.objects.create(test=survey, employee=emp)
    SurveySession.objects.filter(pk=done.pk).update(completed_at=timezone.now())
    SurveySession.objects.create(test=survey, employee=EmployeeFactory())  # in progress

    today = timezone.localdate().isoformat()
    resp = admin_client.get(f"{URL}?date={today}")
    assert resp.status_code == 200
    assert resp.data["sessions"]["total"] == 2
    assert resp.data["sessions"]["completed"] == 1
    assert resp.data["sessions"]["in_progress"] == 1
    assert resp.data["totals"]["active_tests"] == 2  # 'survey' + admin-conducted are both active
    assert resp.data["totals"]["admin_conducted_tests"] == 1
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && .venv/bin/pytest tests/test_dashboard_surveys.py -q
```
Expected: failure — old `DashboardStatsView` imports `apps.assessments`/`apps.medical` (already removed by Plan 1) or returns the old `tests/medical` shape. `KeyError: 'sessions'` or an ImportError.

- [ ] **Step 3: Write minimal implementation**

Replace the entire contents of `backend/apps/core/views.py`:

```python
# backend/apps/core/views.py
"""Admin dashboard statistics — survey counters."""
import datetime

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdmin
from apps.employees.models import Employee
from apps.surveys.models import SurveySession, Test


def _parse_date(raw: str | None) -> datetime.date:
    if not raw:
        return timezone.localdate()
    try:
        return datetime.date.fromisoformat(raw)
    except ValueError:
        return timezone.localdate()


class DashboardStatsView(APIView):
    """Daily survey counters. `?date=YYYY-MM-DD` defaults to today."""

    permission_classes = [IsAdmin]

    def get(self, request):
        date = _parse_date(request.query_params.get("date"))

        sessions = SurveySession.objects.filter(started_at__date=date)
        aggregated = sessions.aggregate(
            total=Count("id"),
            completed=Count("id", filter=Q(completed_at__isnull=False)),
            in_progress=Count("id", filter=Q(completed_at__isnull=True)),
        )
        totals = {
            "active_employees": Employee.objects.filter(is_active=True).count(),
            "active_tests": Test.objects.filter(is_active=True).count(),
            "admin_conducted_tests": Test.objects.filter(
                is_active=True, is_admin_conducted=True
            ).count(),
        }
        return Response(
            {
                "date": date.isoformat(),
                "sessions": {
                    "total": aggregated["total"],
                    "completed": aggregated["completed"],
                    "in_progress": aggregated["in_progress"],
                },
                "totals": totals,
            }
        )
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && .venv/bin/pytest tests/test_dashboard_surveys.py -q
```
Expected: `2 passed`.

- [ ] **Step 5: Commit**

```bash
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center && \
git add backend/apps/core/views.py backend/tests/test_dashboard_surveys.py && \
git commit -m "surveys: rewrite DashboardStatsView for survey counters

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Full suite green + ruff clean (gate)

**Files:**
- No new production code (fix-forward only).

**Interfaces:**
- Consumes: everything above.
- Produces: green pytest suite + clean ruff for `apps/surveys` and `tests`.

- [ ] **Step 1: Run the whole backend suite**

```bash
cd backend && .venv/bin/pytest -q
```
Expected: all tests pass (0 failed). Fix any regressions in `apps/surveys` before proceeding — do not edit unrelated apps.

- [ ] **Step 2: Run ruff**

```bash
cd backend && .venv/bin/ruff check apps/surveys tests
```
Expected: `All checks passed!`
(If ruff flags the intentional camelCase serializer fields, confirm each such line already carries `# noqa: N815`; N815 is not in the configured `select` list `["E","F","I","W","UP","B"]`, so no suppression is actually needed — remove stray noqa only if ruff reports `RUF100 unused noqa`.)

- [ ] **Step 3: Run migrations check**

```bash
cd backend && .venv/bin/python manage.py makemigrations --check --dry-run
```
Expected: `No changes detected` (the 0001 migration already captures every model).

- [ ] **Step 4: Commit any fixes**

```bash
cd /Users/rakhmatulloazizov/Downloads/rakhmatullo/July-2026/decor-center && \
git add -A && git commit -m "surveys: full suite green + ruff clean

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" || echo "nothing to commit"
```

- [ ] **Step 5: Verify final state**

```bash
cd backend && .venv/bin/pytest -q && .venv/bin/ruff check apps/surveys tests && echo "SURVEYS BACKEND GREEN"
```
Expected final line: `SURVEYS BACKEND GREEN`.
