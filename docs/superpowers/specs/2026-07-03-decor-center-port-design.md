# decor-center — Design Spec (порт из `depo`)

**Дата:** 2026-07-03
**Автор:** дизайн-сессия (brainstorming)
**Статус:** на ревью пользователем

Платформа **опросов мнений сотрудников** для «decor-center». Строится как порт
референса `~/Downloads/rakhmatullo/June-2026/depo` (Django 5.2 + DRF, React 18 + TS,
MUI, PostgreSQL, Docker). Из `depo` копируются **только 3 части**: распознавание лица,
справочник Сотрудники+Специальности, админ-шаблон (MUI + JWT + RBAC + i18n ru/uz).
Всё, что связано с медосмотрами, ИИ-генерацией вопросов, TTS/аудио, техбезопасностью и
подсчётом баллов — **удаляется**. Движок тестов (`assessments`) заменяется новым
приложением `surveys` — опросы мнений **без правильных ответов и без баллов**.

---

## 1. Подтверждённые требования

| # | Решение |
|---|---|
| Концепция | Опросы мнений. Нет правильных ответов, нет баллов/pass-fail. Собираем и агрегируем мнения. |
| Объём копии | Только 3 части: (1) Face recognition, (2) Employees+Specialties, (3) admin-shell (MUI+JWT+RBAC+i18n). |
| Роли | `admin` + `employee` (киоск). Роль `medic` удаляется. |
| Киоск | Сотрудники — справочник (не логин-юзеры). На киоске: поиск по имени/фото → Face ID → список подошедших опросов. |
| Беседа 1в1 | Заполняет админ вручную, **без Face ID**. |
| «Работает с» | Дата найма (`hire_date`, DateField) → драйвит авто-расписание опросов. |
| Расписание | Семантика «день месяца» (см. §4.2). |
| Типы вопросов | Ровно 3: `single` / `multiple` / `textarea`. |
| Языки | ru + uz (i18n сохраняется). |

## 2. Подход к реализации

**Fork-and-strip:** копируем весь репозиторий `depo` как базу → удаляем `medical`,
`instructions`, TTS/аудио, scoring, техбезопасность → заменяем `assessments` новым
приложением `surveys` → переименовываем токены `depo/DEPO_` → `decor/DECOR_`.

Инфраструктура (Docker, settings, JWT, MUI-shell, face-пайплайн, employees) наследуется
1:1 — минимум риска рассинхрона конфигов.

---

## 3. Целевая структура проекта

```
decor-center/
├── docker-compose.yml              # adapt (postgres:18, backend, frontend)
├── docker-compose.prod.yml         # adapt (name: decor-center; decor-* контейнеры)
├── Makefile                        # adapt (заголовок; убрать seed-demo TTS)
├── .env.prod.example / DEPLOYMENT.md  # adapt (decor-токены, домены)
├── .github/workflows/{ci,deploy-production}.yml  # adapt
├── deploy/{deploy.sh, issue-certs.sh, nginx/*.conf}  # adapt (decor-*)
├── backend/
│   ├── Dockerfile / Dockerfile.prod   # adapt (сохранить OpenCV+InsightFace)
│   ├── .env.example                   # adapt (DECOR_*, убрать TTS/TESTGEN/scoring)
│   ├── pyproject.toml / manage.py     # verbatim
│   ├── requirements/{base,dev,prod}.txt  # base: adapt; dev/prod: verbatim
│   ├── config/
│   │   ├── settings/{__init__,base,dev,prod,test}.py  # base/test: adapt; dev/prod: verbatim
│   │   ├── api_v1.py                  # adapt (survey viewsets; drop medical/instructions)
│   │   └── {urls,health,asgi,wsgi}.py # verbatim
│   └── apps/
│       ├── core/                      # verbatim (models/pagination/excel); adapt (views/seeds)
│       ├── accounts/                  # adapt (drop medic)
│       ├── employees/                 # adapt (+hire_date, +work_experience) + face pipeline
│       ├── integrations/              # keep face-only (drop test-generator parts)
│       └── surveys/                   # НОВЫЙ app (заменяет assessments/instructions)
└── frontend/
    ├── Dockerfile* / deploy/nginx.conf / .env.example  # verbatim/adapt
    └── src/
        ├── lib/api/endpoints.ts       # adapt (surveys.* + employees.facePhotos)
        ├── routes/{paths.ts, sections/dashboard.tsx}  # adapt (survey + admin routes)
        ├── layouts/ theme/ components/ auth/ locales/ redux/ hooks/ utils/  # verbatim/rename
        └── sections/app/
            ├── employees/             # keep + новые поля
            ├── specialties/           # verbatim
            ├── survey-kiosk/          # НОВЫЙ (из sections/app/testing, урезан)
            └── admin/surveys/         # НОВЫЙ: tests / question-blocks / questions / results
```

---

## 4. Новое backend-приложение `surveys`

Заменяет `assessments` + `instructions`. Переиспользует **паттерн Face-ID-гейта** из
`assessments/services.py` + `views.py` (не копия файлов). Нигде нет scoring.

### 4.1 Модели (`apps/surveys/models.py`)

Все наследуют `apps.core.models.TimeStampedModel`.

```python
class Test(TimeStampedModel):
    """Определение опроса (мнения, без баллов)."""
    title = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)
    # Заполняется админом вручную (беседа 1в1), без Face-ID киоска:
    is_admin_conducted = models.BooleanField(default=False)

    # Режим A: одноразовый, через N дней после найма.
    is_after_application = models.BooleanField(default=False)
    after_days = models.PositiveIntegerField(null=True, blank=True)

    # Режим B: периодический, в окне дней месяца внутри перечисленных месяцев.
    test_days_from = models.PositiveSmallIntegerField(null=True, blank=True)  # 1..31
    test_days_to   = models.PositiveSmallIntegerField(null=True, blank=True)  # 1..31
    month = models.JSONField(default=list, blank=True)  # напр. [1,4,7,10]; [] => каждый месяц

    class Meta:
        ordering = ['title']
        constraints = [
            models.CheckConstraint(
                name='after_days_required_when_after_application',
                check=(models.Q(is_after_application=False) | models.Q(after_days__isnull=False)),
            ),
        ]


class QuestionBlock(TimeStampedModel):
    test  = models.ForeignKey(Test, on_delete=models.CASCADE, related_name='blocks')
    order = models.PositiveIntegerField(default=0)
    title = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ['order', 'id']


class Question(TimeStampedModel):
    class Type(models.TextChoices):
        SINGLE   = 'single',   'По одному (radio)'
        MULTIPLE = 'multiple', 'Несколько (checkbox)'
        TEXTAREA = 'textarea', 'Свободный текст'

    block   = models.ForeignKey(QuestionBlock, on_delete=models.CASCADE, related_name='questions')
    type    = models.CharField(max_length=16, choices=Type.choices, default=Type.SINGLE)
    order   = models.PositiveIntegerField(default=0)
    text    = models.TextField()
    # Стабильные ID вариантов (устойчивы к переупорядочиванию → аналитика не «плывёт»):
    options = models.JSONField(default=list, blank=True)  # [{"id": "<uuid>", "text": "..."}]; [] для textarea

    class Meta:
        ordering = ['order', 'id']


class SurveySession(TimeStampedModel):
    """Одно прохождение опроса сотрудником. Face-ID-гейт (кроме admin-conducted). Без баллов."""
    test     = models.ForeignKey(Test, on_delete=models.PROTECT, related_name='sessions')
    employee = models.ForeignKey('employees.Employee', on_delete=models.PROTECT,
                                 related_name='survey_sessions')
    # Заполнено админом (беседа 1в1) — тогда Face-ID не требуется:
    created_by = models.ForeignKey('accounts.User', null=True, blank=True,
                                   on_delete=models.SET_NULL, related_name='+')
    # Face-ID snapshot (зеркалит заморозку сессии в assessments):
    face_verified  = models.BooleanField(default=False)
    face_embedding = models.JSONField(null=True, blank=True, editable=False)  # snapshot на старте
    model_version  = models.CharField(max_length=64, blank=True)
    started_at   = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-started_at']


class Answer(TimeStampedModel):
    session  = models.ForeignKey(SurveySession, on_delete=models.CASCADE, related_name='answers')
    question = models.ForeignKey(Question, on_delete=models.PROTECT, related_name='answers')
    # Полиморфная нагрузка ответа (без корректности):
    selected_option_ids = models.JSONField(default=list, blank=True)  # list[str] id вариантов
    text_value          = models.TextField(blank=True)                # для textarea

    class Meta:
        unique_together = [('session', 'question')]


class FaceVerificationLog(models.Model):
    """Порт из assessments — аудит каждой Face-ID-попытки на киоске."""
    # employee, session(FK SurveySession), stage(start/submit), success, similarity_score, reason, created_at
```

### 4.2 Расписание — алгоритм «подошедших опросов» (`apps/surveys/scheduling.py`)

```
def due_surveys(employee, today):
    days = None if employee.hire_date is None else (today - employee.hire_date).days
    result = []
    for test in Test.objects.filter(is_active=True, is_admin_conducted=False):

        if test.is_after_application:                        # одноразовый после найма
            if days is None or test.after_days is None: continue
            if days >= test.after_days and not completed_before(test, employee):
                result.append(test)

        else:                                                # периодический
            months = test.month or ALL_MONTHS                # [] => каждый месяц
            if today.month not in months: continue
            lo = test.test_days_from or 1
            hi = min(test.test_days_to or lo, last_day_of_month(today))   # клип по короткому месяцу
            if not (lo <= today.day <= hi): continue
            window_start = date(today.year, today.month, lo)
            if not completed_since(test, employee, window_start):
                result.append(test)
    return result
```

**Идемпотентность:** одноразовый (after_application) — один раз навсегда; периодический —
не повторяется в пределах текущего окна месяца, но снова появляется в следующем периоде.
`is_admin_conducted` тесты (беседа 1в1) в киоск-список не попадают — их создаёт админ.

### 4.3 Пресеты типов тестов (сид `seed_surveys`)

| Пресет | is_after_application | after_days | month | days_from..to | is_admin_conducted |
|---|---|---|---|---|---|
| Через 30 дней после найма | True | 30 | — | — | False |
| Через 90 дней после найма | True | 90 | — | — | False |
| 1в1 ежемесячно (беседа) | False | — | `[]` | — | **True** |
| Краткий пульс | False | — | `[1,4,7,10]` | 1..7 | False |
| Глубокий опрос | False | — | `[1,7]` | 1..14 | False |

### 4.4 Эндпоинты (`config/api_v1.py`)

- `tests/` — `TestViewSet` (ModelViewSet, `IsAdminOrReadOnly`) + вложенные блоки/вопросы.
- `question-blocks/` — `IsAdmin` на запись.
- `questions/` — `IsAdmin` на запись.
- `survey-sessions/` — `SurveySessionViewSet` с actions:
  - `POST identify/` (multipart `face_image`) → 1:N поиск: `service.identify_best_match(candidates, frame)` по активным сотрудникам с `face_embedding`. Возвращает сотрудника. Порт `TestSessionViewSet.identify`.
  - `GET due/?employee=<id>` → `due_surveys(employee, today)` как список Test.
  - `POST start/` (multipart `employee`, `test`, `face_image`) → **Face-ID-гейт**: `service.compare(employee.face_embedding, frame) → (matched, score)`; при успехе создаёт `SurveySession`, замораживает `face_embedding` + `model_version = backend_model_version(service)`, возвращает `{session, test, blocks:[{questions:[...]}]}` (замороженный набор). Провал → 403 `face_verify_failed`.
  - `POST {id}/submit/` (JSON `answers:[{question, selectedOptionIds?, textValue?}]`, опц. `faceImage`) → опц. ре-верификация по `DECOR_REVERIFY_ON_SUBMIT` (по умолчанию `off` для опросов); сохраняет Answers; ставит `completed_at`. Возвращает завершённую сессию (без баллов).
  - `POST admin-fill/` (JSON `employee`, `test`, `answers`) — `IsAdmin`; создаёт завершённую `SurveySession` с `created_by=request.user`, `face_verified=False`. Для беседы 1в1.
  - `GET results/`, `GET export/` (XLSX через `core.excel.xlsx_response`) — `IsAdmin`.

### 4.5 Face-ID-гейт (переиспользуемый интерфейс сервиса)

Из `apps/integrations` (порт verbatim):
`service.compare(embedding, image_bytes) → (matched, score)` · `service.extract_embedding(image_bytes) → embedding` · `service.compare_embeddings(e1, e2) → (matched, score)` · `service.identify_best_match(candidates, image_bytes) → (best_id, score)`.
Выбор бэкенда через `DECOR_FACE_BACKEND` (mock для dev/CI, insightface для prod).

---

## 5. Изменения в `employees`

Новые поля на `Employee`:

```python
hire_date       = models.DateField('Работает с', null=True, blank=True)          # драйвит расписание
work_experience = models.PositiveIntegerField('Стаж', null=True, blank=True)      # ручной int (лет), независим
```

- Оба `null/blank=True` (импорт без значения работает).
- Serializer: добавить `hire_date`, `work_experience` в `Meta.fields`; `face_embedding` остаётся исключён.
- Views: `hire_date` в `ordering_fields`. Admin: оба в `list_display`; `hire_date` в `list_filter`.
- Миграции: для чистой БД decor — свести оба поля в свежий `0001` (проект новый, легаси-БД нет).
- `import_employees`: расширить JSON-схему на оба поля.

---

## 6. Изменения в `accounts` / роли

- `Roles`: удалить `MEDIC`. Оставить `ADMIN`. **Оставить внутренний токен `'specialist'`**, но
  сменить отображаемое имя на «Сотрудник» (избегаем каскада переименований). Дефолт-роль = киоск.
- `permissions.py`: удалить `IsMedic`, `IsAdminOrMedic`, `IsAdminOrMedicOrSpecialist`.
  Оставить `HasAnyRole`, `IsAdmin`, `IsSpecialist` (киоск), `IsAdminOrSpecialist`, `IsAdminOrReadOnly`.
- `permission_catalog.py`: убрать MEDIC; переписать ключи ADMIN (`surveys:*`, `questions:*`,
  `results:read`, `dashboard:read`) и киоска (`survey:submit`) — это FE-хинты.
- Косметический ренейм `Depo*`→`Decor*` в serializers/views/admin.
- `seed_initial_data`: убрать medic-аккаунт; оставить admin (staff+superuser) + specialist(киоск);
  `DEPO_*_PASSWORD`→`DECOR_*`.
- **Киоск-аутентификация:** один общий User роли `specialist` (сид) с долгоживущим JWT
  аутентифицирует устройство-киоск; сотрудники выбираются по имени/Face-ID и не логинятся.
  Киоск-User гейтит `survey-sessions/{identify,start,submit}`; admin — всё управление + результаты.

---

## 7. Settings / Docker / env

**Ренейм `depo`/`DEPO_` → `decor`/`DECOR_`** во всех местах: compose (POSTGRES_*, DATABASE_URL,
`name:`, контейнеры, volumes), `ci.yml`, `base.py` (DATABASE default), `test.py` (media-префикс),
`deploy.sh` (COMPOSE_PROJECT_NAME, vhost, cert-пути), nginx `proxy_pass`, `DEPLOYMENT.md`,
Python-словарь настроек `DEPO`→`DECOR` (и все чтения в `face_enrollment.py`,
`insightface_adapter.py`, `integrations/apps.py`, `registry.py`).

**`INSTALLED_APPS` (цель):** `django.contrib.*`, `rest_framework`,
`rest_framework_simplejwt.token_blacklist`, `corsheaders`, `django_filters`, `drf_spectacular`,
`apps.core`, `apps.accounts`, `apps.employees`, `apps.integrations`, **`apps.surveys`**.
Удалены: `apps.medical`, `apps.instructions`, `apps.assessments`.

**СОХРАНИТЬ (face в объёме):** `DECOR_FACE_BACKEND`, `DECOR_FACE_SIMILARITY_THRESHOLD`,
`DECOR_FACE_INSIGHTFACE_MODEL`, `DECOR_FACE_DET_SIZE`, `DECOR_FACE_MAX_PHOTOS`,
`DECOR_FACE_MIN_FACE_PIXELS`, `DECOR_FACE_BLUR_MIN_VARIANCE`, `DECOR_ANTI_SPOOFING_*`,
`DECOR_FACE_WARMUP_ON_STARTUP`, `DECOR_REVERIFY_ON_SUBMIT` (дефолт `off`), все `JWT_*`,
`DECOR_SKIP_SEED`, `DECOR_ADMIN_PASSWORD`, `DECOR_SPECIALIST_PASSWORD`.

**УДАЛИТЬ (настройки + env + код):** TTS (`UZBEKVOICE_API_KEY`, `DEPO_TTS_*`, post_save аудио),
AI-генерация (`DEPO_TESTGEN_*`, `TestGeneratorService`, `get_test_generator_service`),
scoring (`DEPO_QUESTIONS_PER_TEST`, `DEPO_PASS_THRESHOLD`), medic (`DEPO_MEDIC_PASSWORD`, `apps.medical`).

**Сохранить verbatim:** `prod.py` (WhiteNoise/SSL/HSTS/secure cookies — env-driven), SIMPLE_JWT,
AUTH_USER_MODEL, REST_FRAMEWORK. **Переписать:** SPECTACULAR TITLE/DESCRIPTION.
**Dockerfiles:** сохранить OpenCV apt-libs + InsightFace-bake (face в prod).

---

## 8. Frontend

### 8.1 Админ-экраны (MUI-shell verbatim)

**Оставить (адаптировать данные):**
- **Сотрудники** — переиспользовать list/detail/form; **добавить** `hire_date` (DatePicker,
  «Работает с») + `work_experience` (number, «Стаж») в форму и таблицу. Сохранить вкладку
  face-photo enrollment (`face-photos-requests.ts` + `use-face-photos-api.ts`).
- **Специальности** — CRUD verbatim.

**Добавить (новые CRUD-экраны):**
- **Тесты** — форма Test (title, is_active, is_admin_conducted, режим расписания: тумблер
  is_after_application → after_days; иначе month multiselect [1..12] + days_from/days_to).
- **Блоки вопросов** — per-Test список блоков с `order`, `title`, реордер.
- **Вопросы** — per-block, селектор `type` (single/multiple/textarea), `order`, `text`,
  динамический редактор `options` (скрыт для textarea).
- **Результаты опросов** — агрегация по Test/Question (счётчики по вариантам, список textarea-ответов),
  экспорт XLSX. Без scoring/pass-fail.

### 8.2 Киоск-флоу (`sections/app/testing` → `sections/app/survey-kiosk`)

7 шагов:
1. **EmployeeStep** — поиск по имени/фото (переиспользовать `employee-step.tsx`).
2. **Face-ID verify** — сохранить getUserMedia-lifecycle + captureFrame + сканер; **убрать ModuleSelector**; POST кадра в `survey-sessions/identify` (или верификация выбранного сотрудника).
3. **Due-surveys list** (НОВЫЙ) — `GET survey-sessions/due/?employee=`.
4. **Start** — POST `survey-sessions/start/` → `{session, blocks/questions}` через location-state.
5. **Answer blocks** — прогресс + prev/next + framer-motion. Обобщить: single→radio, multiple→checkbox, textarea→MUI textarea. **Убрать весь TTS**.
6. **Submit** — POST `survey-sessions/{id}/submit/`. Ветку SubmitFaceStep оставить только если включат submit-reverify (по умолчанию нет).
7. **Thank-you** (НОВЫЙ, вместо `result-step.tsx`) — простое подтверждение, без баллов.

**Verbatim:** `utils/camera.ts`, getUserMedia-lifecycle, `three-bg.tsx`, `cursor-glow.tsx`,
panel-shell, inline-error паттерн, location-state hand-off, MUI layout/theme/auth guards.
**Удалить:** `result-step.tsx`, `module-step.tsx`, TTS, TestModule, `audioUrl`, passed/failed строки.

**API/types:** `endpoints.ts` — группа `surveys.{due,start,submit,identify}` +
`employees.facePhotos` (сохранить multipart `face_image` snake_case). `types.ts` — Question с
`type`, ответы `string[] | string`; убрать `score/passed/total/audioUrl`. `paths.ts` +
`routes/sections/dashboard.tsx` — survey-роуты + admin-роуты. i18n: сохранить ru+uz, namespace `survey.json`.

---

## 9. Разрешённые решения (по открытым рискам)

| # | Решение (дефолт) |
|---|---|
| Роль-токен | Оставить `'specialist'` внутри, отображать «Сотрудник». |
| Киоск-аутентификация | Один общий User `specialist` с долгоживущим JWT. |
| Идемпотентность due | after_application — один раз; периодический — раз в окно/месяц. |
| `month=[]` | «Каждый месяц». |
| Беседа 1в1 | `Test.is_admin_conducted=True`; `SurveySession.created_by=admin`, без Face-ID; отдельный endpoint `admin-fill/`. |
| Короткий месяц | Клип `test_days_to` до последнего дня месяца. |
| Submit re-verify | По умолчанию `off` (механизм оставлен под флагом). |
| Face backend | InsightFace в prod, mock в dev/CI. |
| Хранение ответов | Стабильные ID вариантов: `options=[{id,text}]`, `Answer.selected_option_ids=[id...]`. |
| Топология сети | Standalone (свой nginx+certbot) по умолчанию. |
| Dashboard | Переписать `DashboardStatsView` под счётчики опросов. |
| Аналитика v1 | Счётчики по вариантам + список textarea-ответов + XLSX-экспорт. |

## 10. Тестирование

- **Backend (pytest):** модели+констрейнты; `due_surveys` (after_days-триггер, окно дней месяца,
  клип короткого месяца, `month=[]`, идемпотентность); Face-ID-гейт `start` (порт mock-паттернов
  из depo); `submit` (сохранение single/multiple/textarea); `admin-fill` без Face-ID; RBAC на всех
  эндпоинтах; агрегация результатов + XLSX.
- **Frontend:** `npx tsc --noEmit`, `npm run lint`, `npm run build`; smoke-тесты киоск-флоу и
  admin-CRUD (переиспользовать setup из depo).
- **CI:** адаптировать `ci.yml` (postgres creds → decor); mock face-backend в CI.

## 11. Порядок реализации (для плана)

1. Скелет: копия репо `depo` → удалить medical/instructions/assessments/TTS → ренейм depo→decor → поднять Docker+migrate+seed.
2. `accounts`: убрать medic, роли/пермишены/сиды.
3. `employees`: новые поля + serializer/admin/import + фронт-форма.
4. `surveys` backend: модели+миграции → scheduling → serializers/views → seed-пресеты → тесты.
5. Frontend admin: Тесты / Блоки / Вопросы / Результаты.
6. Frontend киоск: survey-kiosk флоу (identify → due → start → answer → submit → thank-you).
7. Dashboard + XLSX-экспорт + i18n (ru/uz).
8. E2E-прогон, CI зелёный, DEPLOYMENT.md.

## 12. Ссылки

- Референс: `~/Downloads/rakhmatullo/June-2026/depo`
- Пофайловый манифест копирования (полный синтез): результат воркфлоу `map-depo-reference`
  (`.../workflows/wf_6b20a54a-28c`).
