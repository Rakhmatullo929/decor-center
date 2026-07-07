# Публичный киоск прохождения тестов: распознавание лица + SMS-код (OTP)

**Дата:** 2026-07-08
**Статус:** дизайн согласован, ожидает финального ревью спецификации

## 1. Проблема и цель

Сейчас весь поток прохождения тестов («киоск») закрыт за логином:

- **Фронтенд:** маршруты `/kiosk` и `/kiosk/answer` обёрнуты в `AuthGuard` + `DashboardLayout` + `PermissionGuard page="survey" action="submit"` — чтобы включить камеру, надо войти под учётной записью.
- **Бэкенд:** kiosk-действия (`identify`, `due`, `start`, `submit`) на `SurveySessionViewSet` требуют `IsAdminOrEmployee` (валидный JWT). Глобальный дефолт DRF — `IsAuthenticated`.
- Поток начинается с **ручного выбора** сотрудника, а не с камеры.

**Цель:** сотрудники проходят тесты **без логина/пароля**. Отдельный публичный URL, где камера включается сразу и сразу распознаёт сотрудника. После распознавания — подтверждение по **SMS-коду** на телефон сотрудника (второй фактор). Только администратор продолжает работать под логином.

**Требования пользователя (дословно учтены):**
- Добавить сотруднику поле `phone`.
- После распознавания лица отправлять SMS-код на его номер; допуск к тесту — после ввода кода.
- **Сейчас** код фиксированный `0000` (реальная SMS не отправляется). **Позже** подключим **Eskiz** — реальную отправку.
- Резервный путь (лицо не распозналось) допускает по **одному только SMS-коду**.
- Старый `/kiosk` заменяем публичным потоком (редирект).

## 2. Что уже есть (переиспользуем)

- **Распознавание лица работает end-to-end:** `InsightFaceAdapter` (ArcFace, 512-мерные эмбеддинги, косинус) и `MockFaceRecognitionService`; порт/адаптер/registry в `apps/integrations`. Эндпоинт `POST /survey-sessions/identify/` уже делает **1:N** поиск сотрудника по кадру (`backend/apps/surveys/views.py:246-273`).
- **Kiosk-поток на фронте:** камера через нативный `getUserMedia` (`frontend/src/utils/camera.ts`, `.../components/face-id-step.tsx`), список доступных тестов, экран ответов, «Спасибо» (`frontend/src/sections/app/survey-kiosk/*`).
- **Enrollment лиц:** мульти-фото с проверками качества (`backend/apps/employees/face_enrollment.py`), эмбеддинг-центроид на `Employee.face_embedding`.
- **Аудит:** `FaceVerificationLog` (`backend/apps/surveys/models.py:158-184`).
- **Паттерн порт/адаптер/registry** в `apps/integrations` — повторяем для SMS.

Таким образом основной объём работы — **не новая функциональность, а**: (1) открыть часть эндпоинтов без логина за SMS-OTP, (2) новый публичный маршрут «камера-first», (3) поле `phone` + OTP-инфраструктура + SMS-порт.

## 3. Поток для сотрудника (UX)

```
Планшет открыт на /scan   (публично, без логина, без админ-сайдбара)
        │
   [1] Камера включается СРАЗУ, автозахват кадра
        │  POST /survey-sessions/identify/   (1:N поиск по лицу, публично)
        │
        ├── Узнан ──► «Это вы, Иван И.? Отправим код на +998 90 *** ** 34»  [Отправить код]
        │                 │  POST /survey-sessions/request-otp/  {employee_id}
        │                 ▼
        │      [2] Экран ввода 4-значного кода  (сейчас всегда 0000)
        │                 │  POST /survey-sessions/verify-otp/  {employee_id, code}
        │                 │  ◄── kiosk-токен (короткоживущий, подписанный)
        │                 ▼
        │      [3] Список доступных тестов   GET /survey-sessions/due/?employee=<id>   (kiosk-токен)
        │                 │  выбор → POST /start/ (kiosk-токен + кадр лица) → вопросы → POST /{id}/submit/
        │                 ▼
        │      [4] «Спасибо» → авто-возврат к камере (киоск-цикл, next employee)
        │
        └── НЕ узнан (3 попытки) ──► поиск себя по имени (резерв)
                                        │  → request-otp → verify-otp → тесты
                                        │  (в резерве лицо НЕ сверяется, гарант — только SMS-код)
```

**Ключевое:** камера — первый шаг; ручной выбор сотрудника убран из основного пути (только резерв). После «Спасибо» киоск сам возвращается к камере.

## 4. Модель данных (бэкенд)

### 4.1 `Employee.phone`
- Новое поле `phone: CharField(max_length=20, null=True, blank=True)` в `backend/apps/employees/models.py`.
- Формат `+998XXXXXXXXX` (валидация на сериализаторе/форме). В БД **nullable** для обратной совместимости с уже импортированными сотрудниками; в **форме админа обязательное**.
- Если у узнанного сотрудника `phone` пуст → бэкенд возвращает ошибку `phone_not_set` (фронт: «Телефон не указан, обратитесь к администратору»).
- Миграция `employees/migrations/000X_employee_phone.py`.

### 4.2 `OtpChallenge` (новая модель)
Поля: `employee` (FK, PROTECT), `code_hash` (хэш кода, не хранить открытым), `purpose` (`kiosk`), `is_used` (bool), `attempts` (int), `expires_at` (datetime), `created_at`. Индекс по `(employee, created_at)`.
- TTL из настройки `DECOR_KIOSK_OTP_TTL_SECONDS` (по умолчанию 300 с).
- Лимит попыток из `DECOR_KIOSK_OTP_MAX_ATTEMPTS` (по умолчанию 5).
- Одноразовость: после успешной проверки `is_used=True`; активная попытка на сотрудника — последняя невыполненная и не истёкшая.
- Миграция `surveys/migrations/000X_otpchallenge.py` (или отдельное приложение `kiosk`; по умолчанию кладём в `surveys`, т.к. связано с прохождением опросов).

### 4.3 Аудит
Расширяем существующий `FaceVerificationLog` либо добавляем компактный лог OTP-попыток (успех/провал, employee, stage). Переиспользуем стиль существующего логирования.

## 5. SMS-провайдер: порт / адаптер / registry (по образцу face)

В `backend/apps/integrations/`:
- `sms/base.py`: `class SmsSender(ABC)` с методом `send(phone: str, text: str) -> None` (и, при необходимости, `SmsError`).
- `sms/mocks.py`: `MockSmsSender` — **ничего не отправляет**, пишет в лог «would send code to <masked phone>»; используется сейчас.
- `sms/eskiz.py`: `EskizSmsSender` — **заглушка на будущее** (реальная интеграция с Eskiz позже; сигнатура готова, тело — TODO/NotImplemented с понятным сообщением).
- `sms/registry.py`: `get_sms_sender()` → `import_string(settings.DECOR["SMS_BACKEND"])()` — в точности как `apps/integrations/registry.py` для лиц.

### Генерация кода и «дефолт 0000»
- Настройка `DECOR_KIOSK_OTP_STATIC_CODE` (по умолчанию `"0000"`).
  - Если **не пусто** (текущая фаза): `request-otp` создаёт challenge с ожидаемым кодом = статический код; `MockSmsSender` только логирует. Сотрудник вводит `0000`.
  - Если **пусто** (будущее, Eskiz включён): генерируется случайный 4-значный код, отправляется реальным `EskizSmsSender`.
- Переход на Eskiz = сменить `DECOR_SMS_BACKEND` на `EskizSmsSender` и очистить `DECOR_KIOSK_OTP_STATIC_CODE`. Остальной код не меняется.

## 6. Эндпоинты и авторизация (бэкенд)

Все действия остаются на `SurveySessionViewSet` (`backend/apps/surveys/views.py`), меняется `get_permissions` и добавляются два действия.

| Эндпоинт | Метод | Доступ | Защита |
|---|---|---|---|
| `survey-sessions/identify/` | POST | **AllowAny** | Throttling по IP; **минимальный** ответ: `{employee_id, full_name, phone_masked}` — без полного фото/должности |
| `survey-sessions/employees-lookup/` | GET | **AllowAny** | Только для резервного пути. Требует поисковый запрос `?q=` (мин. 2–3 символа), возвращает **минимум** `[{id, full_name}]` совпадений; без сброса всего списка; throttling |
| `survey-sessions/request-otp/` | POST | **AllowAny** | Throttling по IP **и по employee** (например 1/60с, ≤5/час); проверка наличия `phone` |
| `survey-sessions/verify-otp/` | POST | **AllowAny** | Throttling; лимит попыток; при успехе выдаёт **kiosk-токен** |
| `survey-sessions/due/` | GET | **kiosk-токен** | `IsKioskVerified` + employee из токена == employee запроса |
| `survey-sessions/start/` | POST | **kiosk-токен** | `IsKioskVerified`; face-gate (см. 6.3) |
| `survey-sessions/{id}/submit/` | POST | **kiosk-токен** | `IsKioskVerified`; сессия принадлежит employee из токена |
| `tests/`, `results`, `export`, `admin-fill`, employees/specialties CRUD | — | **JWT-логин админа** (как сейчас) | Без изменений |

### 6.1 `get_permissions`
- `identify`, `request_otp`, `verify_otp` → `[AllowAny]`.
- `due`, `start`, `submit` → `[IsKioskVerified]`.
- всё остальное → `[IsAdmin]` (как сейчас).

### 6.2 Kiosk-токен
- Подписанный токен через `django.core.signing.dumps({"employee_id": id, "purpose": "kiosk", "fallback": bool}, salt="kiosk-token")`, TTL из `DECOR_KIOSK_TOKEN_TTL` (например 900 с).
- **Не логин**: выдаётся автоматически после «лицо/имя + код», сотрудник ничего не вводит из учётных данных.
- Проверка — permission-класс `IsKioskVerified` (в `backend/apps/accounts/permissions.py` или новом `apps/surveys/permissions.py`): читает заголовок `X-Kiosk-Token`, валидирует подпись и `max_age`, кладёт `request.kiosk_employee_id`/`request.kiosk_fallback`, и требует, чтобы `employee` в запросе совпадал с токеном.
- Хранение на фронте: **в памяти вкладки** (React state/ref), не в localStorage; очищается после submit и по таймауту.

### 6.3 Face-gate на `/start/`
- **Основной путь** (`fallback=False`): `start_survey_session` продолжает **жёстко сверять лицо** (как сейчас, `backend/apps/surveys/services.py:120-152`) — двойная защита (лицо + код).
- **Резервный путь** (`fallback=True`): сверка лица в режиме **«лог, не блокируем»** — гарантом выступает SMS-код (решение пользователя). Флаг `fallback` берётся из kiosk-токена.

## 7. Фронтенд

### 7.1 Маршрутизация
- Новый **публичный** маршрут-группа `kioskPublicRoutes` (рядом с `authRoutes`/`mainRoutes` в `frontend/src/routes/sections/`), **вне** `AuthGuard` и `DashboardLayout`.
- Путь `paths.scan = '/scan'` в `frontend/src/routes/paths.ts`. Возможен подпуть под шаги (`/scan`, при необходимости внутренняя state-машина без смены URL).
- Старый `/kiosk` и `/kiosk/answer` → **редирект** на `/scan`. Пункт «Kiosk» в админ-навигации ведёт на `/scan` (открыть сканер).

### 7.2 Компоненты (максимум переиспользования)
- Переиспользовать: `camera.ts`, `face-id-step.tsx` (сканер), `due-surveys-step.tsx`, `answer-view.tsx`, `question-step.tsx`, `thank-you-step.tsx`.
- **Новая state-машина** публичного киоска: `scan(identify) → confirm → otp → due → answer → thankyou → (reset → scan)`.
  - `scan`: камера включается сразу, автозахват, `identify`. При неуспехе — счётчик попыток; после 3 → шаг `manualPick` (резерв). Список берётся из **публичного** `employees-lookup/?q=` (не из закрытого `/employees/`), поиск по имени с минимальной длиной запроса.
  - `confirm`: «Это вы, {Имя}? Отправить код на {masked}». Кнопка → `request-otp`.
  - `otp`: **новый компонент** ввода 4-значного кода → `verify-otp` → сохранить kiosk-токен в памяти.
  - `due`/`answer`/`thankyou`: как сейчас, но `start`/`submit` несут kiosk-токен.
  - После `thankyou`: авто-сброс состояния и возврат к `scan` через N секунд.

### 7.3 API-слой фронта
- Публичные вызовы (`identify`, `request-otp`, `verify-otp`) — через существующий `skipAuth`/`isPublic` (`frontend/src/lib/api/request.ts`), **без** `Authorization`.
- Post-OTP вызовы (`due`, `start`, `submit`) — добавляют заголовок `X-Kiosk-Token`.
- Новые записи в `frontend/src/lib/api/endpoints.ts`: `requestOtp`, `verifyOtp`.

## 8. Настройки (`backend/config/settings/base.py`, блок `DECOR`)

Добавить (все env-переопределяемые, по образцу существующих `DECOR_*`):
- `SMS_BACKEND` ← `DECOR_SMS_BACKEND` (default `apps.integrations.sms.mocks.MockSmsSender`).
- `KIOSK_OTP_STATIC_CODE` ← `DECOR_KIOSK_OTP_STATIC_CODE` (default `"0000"`).
- `KIOSK_OTP_TTL_SECONDS` ← default `300`.
- `KIOSK_OTP_MAX_ATTEMPTS` ← default `5`.
- `KIOSK_TOKEN_TTL` ← default `900`.
- Throttle-ставки для kiosk (scoped throttles): `identify`, `request-otp`, `verify-otp`.
- `.env.example` дополнить перечисленными переменными (значения-плейсхолдеры, без секретов).

## 9. Безопасность и краевые случаи

- **Throttling** на `identify`/`request-otp`/`verify-otp` (DRF ScopedRateThrottle) — против перебора и SMS-бомбинга (актуально при включении Eskiz).
- **Минимизация PII в `identify`**: только имя + маскированный телефон (`+998 90 *** ** 34`), без полного фото/должности — снижает ценность массового сбора данных из интернета.
- **OTP**: TTL, лимит попыток, одноразовость, хэширование кода.
- **Kiosk-токен**: короткий TTL, привязка к employee, проверка совпадения employee в каждом запросе; хранится только в памяти вкладки.
- **Нет телефона** у сотрудника → `phone_not_set`, понятное сообщение.
- **Вне рамок сейчас** (зафиксировано осознанно):
  - Anti-spoofing/liveness — реального бэкенда нет (только mock); лицо + SMS уже дают приемлемую защиту; полноценный liveness — отдельная задача.
  - Реальная интеграция Eskiz — только порт/заглушка сейчас.
  - OTP запрашивается **на каждую сессию** (безопаснее; в фазе `0000` без трения). «Запомнить на N минут на устройстве» — возможное будущее улучшение.

## 10. Тестирование

**Бэкенд (pytest):**
- Миграция `phone`; сериализатор админа принимает/валидирует телефон.
- `request-otp`: создаёт challenge; `phone_not_set` при пустом телефоне; throttle/лимит частоты.
- `verify-otp`: успех со статическим `0000`; неверный код; истёкший код; превышение попыток; выдаёт валидный kiosk-токен.
- `identify`: публичный доступ; **минимальный** ответ (нет полного фото/должности).
- `employees-lookup`: публичный; требует `?q=` (короткий запрос отклоняется/пуст), возвращает только `{id, full_name}`; throttling.
- `IsKioskVerified`: валидный токен допускает `due`/`start`/`submit`; чужой/просроченный/поддельный токен → 403; несовпадение employee → 403.
- Face-gate: основной путь блокирует при несовпадении лица; резервный путь (`fallback=True`) — не блокирует.
- `MockSmsSender` ничего не отправляет; registry резолвит бэкенд из настройки.

**Фронтенд:**
- Сценарий `/scan`: моки камеры/`identify`/`request-otp`/`verify-otp` → прохождение теста → «Спасибо» → авто-reset.
- Резервный путь: 3 неудачи распознавания → ручной поиск → OTP → тест.
- Публичный маршрут доступен без логина; старый `/kiosk` редиректит.

## 11. Затрагиваемые файлы (ориентир)

**Бэкенд:**
- `apps/employees/models.py` (+`phone`), `apps/employees/serializers.py`, `apps/employees/migrations/`.
- `apps/surveys/models.py` (+`OtpChallenge`), `apps/surveys/views.py` (`get_permissions`, `request_otp`, `verify_otp`, минимальный `identify`), `apps/surveys/services.py` (OTP-логика, kiosk-токен, face-gate по `fallback`), `apps/surveys/serializers.py`, `apps/surveys/permissions.py` (новый `IsKioskVerified`) или `apps/accounts/permissions.py`.
- `apps/integrations/sms/` (`base.py`, `mocks.py`, `eskiz.py`, `registry.py`).
- `config/settings/base.py` (блок `DECOR` + throttles), `.env.example`.
- `tests/` (новые тесты OTP/kiosk-токена/identify).

**Фронтенд:**
- `src/routes/paths.ts`, `src/routes/sections/{index,dashboard}.tsx` (+ новая группа публичных маршрутов, редирект старого kiosk).
- `src/sections/app/survey-kiosk/` (новая публичная state-машина + компонент OTP; переиспользование существующих шагов) — либо новый каталог `src/sections/public/scan/`.
- `src/lib/api/endpoints.ts`, `src/lib/api/request.ts`/`http-client.ts` (заголовок `X-Kiosk-Token`).
- `src/sections/app/employees/` (поле телефона в форме сотрудника).

## 12. Критерии готовности

1. Сотрудник открывает `/scan` **без логина**, камера включается сразу, лицо распознаётся.
2. После распознавания приходит запрос на ввод кода; ввод `0000` (текущая фаза) допускает к доступным тестам.
3. Тест проходится и отправляется; после «Спасибо» киоск возвращается к камере.
4. Резервный путь (по имени + код) работает без сверки лица.
5. Админ-функции остаются под логином и не затронуты.
6. Публичные эндпоинты защищены throttling; `identify` не отдаёт лишние PII.
7. Переключение на Eskiz — только через настройки, без изменения кода.
8. Все новые тесты зелёные.
