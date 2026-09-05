# ТЗ — интеграция SQL-модуля с платформой (as-built)

Дата: 2026-09-05, обновлено 2026-09-06 под реализованные контракты.
**Статус: контракты со стороны платформы (Education + IdentityService) реализованы
и покрыты тестами. Ниже — что модуль обязан реализовать в ответ.**

Проекты модуля: `Backend/SqlModule` (`.NET`, minimal API + `IEndpoint`/CQRS) и
`Frontend/sql-module-web` (React SPA). Исполнительная доска модуля —
[`sql-module-web/docs/PLATFORM_INTEGRATION_KANBAN.md`](../../../sql-module-web/docs/PLATFORM_INTEGRATION_KANBAN.md)
(`SQLI-*`). Общий дизайн и обоснование — [`../MODULE_INTEGRATION.md`](../MODULE_INTEGRATION.md).

## Что уже сделано на стороне платформы (проверять контракты по этому разделу)

| Что | Где | Коммит |
|---|---|---|
| Token Exchange с `session_id` в токене | IdentityService | `952965e` |
| Прокси каталога заданий (`GET .../practical-modules/{id}/tasks`) | Education `MOD-005` | `7e79e46` |
| `Practical.kind=external` + привязка модуля | Education `MOD-006` | `4bae06f` |
| Жизненный цикл сессии + **пуш модулю** + **приём оценки** + `abandon` | Education `MOD-007` | `094934f` |
| Kafka-consumer «цифрового следа» | Education `MOD-008` | `a4fd185` + `3522126` |
| best-of-N в оценке практики | Education `MOD-008a` | `094934f` |

Kafka-инфраструктура (`MOD-003`) и реестр модулей (`MOD-004`) — тоже готовы.
**Не готово (не блокирует backend модуля):** UI platform-web (`MOD-009…012`),
единый reverse-proxy (`MOD-015`).

---

## Словарь

| Слово | Для модуля это | Откуда берётся |
|---|---|---|
| `module_access_token` | Bearer в каждом вызове студента; внутри claim `session_id` | фрагмент URL `/launch` → `sessionStorage` |
| `sessionKey` | секрет сессии: в каждом Kafka-событии и в HTTP-оценке; **в браузер не отдаётся** | приходит в пуше от Education, хранится в `ModuleSession` |
| `sessionId` | Guid сессии, не секрет | claim `session_id` токена / query `?session=` / пуш |
| `serviceKey` | общий статический пароль модуля и Education | secret-конфиг обоих; заголовок `X-Service-Key` |

---

## Контракты, реализованные Education (модуль подстраивается ровно под них)

### C1. Пуш сессии: Education → бэкенд модуля

Education **сам** вызывает модуль при старте и при продолжении попытки, **до**
Token Exchange и сборки launch URL. Ретраит до `2xx` в рамках запроса студента;
не удалось — весь запуск отдаёт `502` и попытка **не тратится**.

```
POST {catalogEndpoint-хост}/api/v1/module-integration/sessions      ← адрес модуля
  X-Service-Key: <serviceKey>
  Content-Type: application/json
  {
    "sessionId":  "8f14e45f-...",     // Guid, PK у модуля
    "sessionKey": "9b1a...c7",        // hex-секрет, 64 símb
    "userId":     "aaaaaaaa-...",     // пользователь Education (legacy id), не identity sub
    "taskRef":    "sql-join-001",     // = ref из каталога C2
    "returnUrl":  "https://platform/student/practicals/{practicalId}?session={sessionId}",
    "expiresAt":  "2026-09-05T12:00:00Z"   // ISO8601 или null (без лимита)
  }

  → 200   любой 2xx = upsert принят
  → иначе Education считает пуш неуспешным
```

**Требования к модулю (`SQLI-005`):**
- `ModuleSession` по `sessionId`: нет → INSERT, есть → UPDATE. **Идемпотентно**,
  конкурентно-безопасно (уникальный ключ `sessionId`, проигравший вставку
  перечитывает).
- В MVP поля повторного пуша **идентичны** первому (`sessionKey` не ротируется,
  `userId`/`taskRef`/`returnUrl`/`expiresAt` для сессии неизменны). Расхождение —
  Education источник истины, модуль перезаписывает.
- Пуш по локально `COMPLETED` сессии → `409` (Education такую не пушит, но
  защититься надо).
- Адрес, на который Education шлёт пуш, берётся из `PracticalModule.configuration`
  реестра (поле `sessionsEndpoint`, см. C5). `serviceKey` в `configuration` **не
  хранится** — он в secret-конфиге Education (`PracticalModules:<slug>:ServiceKey`).

### C2. Каталог заданий: Education → модуль (проксируется преподавателю)

```
GET {configuration.catalogEndpoint}
  X-Service-Key: <serviceKey>

  → 200  [ { "ref": "string", "name": "string", "description": "string" } ]
```

**Требования к модулю (`SQLI-003`):** только `PublicationStatus.Published`
задания; `ref = SqlTask.Id` (строкой); `name = TaskName`; `description` —
`TaskText` до ~200 симв. Без пагинации (массив целиком). Таймаут на стороне
Education 2–3 с; недоступность/ошибка → преподаватель видит `502`.

### C3. Приём оценки: бэкенд модуля → Education

```
POST {EducationBaseUrl}/api/v1/module-sessions/{sessionId}/complete
  X-Service-Key: <serviceKey>
  Content-Type: application/json
  {
    "sessionKey":     "9b1a...c7",
    "grade":          100,                 // 0..100, Education делает Clamp(0,100)
    "completionData": { "totalAttempts": 3, "correctAttemptId": "..." },  // произвольный JSON или null
    "completedAt":    "2026-09-05T12:00:00Z"    // информационно, Education пишет своё now
  }

  → 200   принято ИЛИ сессия уже COMPLETED (та же операция) — прекратить ретраи
  → 409   сессия не ACTIVE (EXPIRED/abandoned) — оценка отклонена ОКОНЧАТЕЛЬНО, не ретраить
  → 401   X-Service-Key не в списке ключей модулей ИЛИ sessionKey ≠ session.session_key
```

**Идемпотентность (реализована):** Education хранит терминальность в
`status=COMPLETED`; повтор `/complete` по завершённой сессии → `200`, `grade` не
перезаписывается. Отдельный `Idempotency-Key` не нужен.

**Требования к модулю (`SQLI-015/016`):** типизированный `HttpClient`; `200`/`409`
завершают доставку (строку `pending_publish` в `sent`), `401`/прочие `4xx` —
неретраимы (лог ERROR), сеть/`5xx` — ретрай с backoff.

### C4. Kafka «цифровой след»: модуль (producer) → Education (consumer)

Топик `scoodle.practice.events`, key = `sessionId`, **camelCase**
(`JsonSerializerDefaults.Web`). Топик `scoodle.practice.completion` **удалён** —
оценка идёт только по C3.

```json
{
  "sessionId":  "8f14e45f-...",
  "sessionKey": "9b1a...c7",
  "eventId":    "d290f1ee-...",        // Guid, модуль генерит на каждое событие — ключ дедупа
  "kind":       "sql_submit",          // произвольная строка, Education не разбирает
  "occurredAt": "2026-09-05T10:15:30Z",
  "payload":    { "submittedSql": "SELECT ...", "status": "SUCCESS",
                  "rowCount": 25, "durationMs": 120, "isCorrect": false, "reason": "..." }
}
```

**Реализовано в Education (`PracticeEventHandler`):** сверка `sessionKey` против
сессии → `INSERT PracticalTaskEvent (id=eventId, kind, payload) ON CONFLICT (id)
DO NOTHING`. События по **неизвестной / с чужим `sessionKey` / терминальной**
сессии — молча отбрасываются. Никаких терминальных переходов через Kafka.

**Требования к модулю (`SQLI-013/014`):** событие пишется в `pending_publish` в
**одной транзакции** с `Attempt`; фоновый publisher ack-ит брокер **до** `sentAt`;
`kind=sql_submit` (одно событие на `SubmitAttempt`); `sessionKey` **не писать** в
обычные логи/ProblemDetails/telemetry.

### C5. Регистрация модуля в реестре Education (`MOD-004`, делает администратор)

`PracticalModule.configuration` (jsonb-строка, отдаётся admin-API как есть —
**секретов в ней нет**):

```json
{
  "catalogEndpoint":  "http://sql-module-web-backend/api/v1/module-integration/tasks-catalog",
  "sessionsEndpoint": "http://sql-module-web-backend/api/v1/module-integration/sessions"
}
```

`slug=sql`, `basePath=/modules/sql`, `identityAudience=sql-module-api`. Ключ
`PracticalModules:sql:ServiceKey` — в secret-конфиге Education; тот же секрет —
`Auth:ServiceKey` (или аналог) у модуля.

### C6. Токен студента (Token Exchange, `MOD-002c`, реализовано)

`module_access_token`, который прилетает во фрагменте `/launch`:
- `aud = sql-module-api`, `sub = <userId студента>` (тот же, что в `userId` пуша C1),
  роль `Student`, claim **`session_id = <sessionId>`**;
- TTL — стандартный обмен (30 мин) либо короче, если сессия истекает раньше;
- refresh нет. Истёк — студент жмёт «Продолжить» на платформе, прилетает новый.

Модуль (`platform`-профиль) берёт сессию **из claim `session_id`**. Отдельного
заголовка `X-Module-Session-Id` в схеме нет.

---

## BACKEND модуля (`Backend/SqlModule`)

### S1 — каталог (`SQLI-003`) — под C2

### S2 — приём пуша `POST /api/v1/module-integration/sessions` (`SQLI-005`) — под C1

`ModuleSession` (сущность + миграция):

```
session_id  uuid PK      session_key text      user_id uuid
task_ref    text         return_url  text      expires_at timestamptz null
status      text         -- ACTIVE | COMPLETED  (EXPIRED модулю не нужен: время у Education)
created_at / updated_at timestamptz
```

### S3 — `GET /api/v1/module-integration/sessions/current` (`SQLI-006`)

```
GET /api/v1/module-integration/sessions/current
  Bearer module_access_token
  → 200 { "taskId": "<task_ref>", "returnUrl": "...", "expiresAt": "..."|null }
  → 404  нет claim session_id | ModuleSession не найдена | user_id ≠ sub токена
```

Фронт доверяет **этому** ответу, а не query-параметрам `/launch`.

### S4 — привязка `SubmitAttempt` к сессии (`SQLI-012`, профиль `platform`)

На `POST /training/attempts/submit`:
1. `ModuleSession` по `session_id` из claim. Нет → `409 ModuleSessionRequired`.
2. `user_id == sub` → иначе `403`.
3. `task_ref == request.TaskId` → иначе `409 SessionTaskMismatch`.
4. `status == ACTIVE` и (`expires_at == null` или `now <= expires_at`) → иначе `409 ModuleSessionClosed`.
5. Обычная синхронная проверка + запись `Attempt`.
6. В той же транзакции — строка `pending_publish` `kind=event`.
7. Если `IsCorrect` и `status == ACTIVE` → строка `pending_publish` `kind=grade`,
   `ModuleSession.status = COMPLETED`.

`standalone`-профиль: шаги 1–4, 6–7 пропускаются.

### S5 — `pending_publish` + фоновый publisher (`SQLI-013/014/015`) — под C3, C4

```
pending_publish
  id uuid PK   kind text ("event"|"grade")   session_id uuid
  message jsonb (готовое тело)   attempts int   next_attempt_at timestamptz   sent_at timestamptz null
```

Publisher по одной строке: `event` → Kafka (ack → `sent_at`); `grade` → C3
(`200`/`409` → `sent_at`; сеть/`5xx` → backoff). Poison-message — в «мёртвую» с
алертом, очередь не блокировать. Чистка `sent_at` старше N дней.

### S6 — lifecycle `ModuleSession` (`SQLI-017`)

`ACTIVE → COMPLETED` после `200`/`409` от Education. Submit после `expires_at` или
по терминальной — `409`. Просроченные ACTIVE — фоновая уборка. Событий/оценок по
не-ACTIVE нет.

### S7 — `Audience` профилей (`SQLI-007`)

`platform`: `Auth:Audience=sql-module-api`. `standalone`: `scoodle-api`. Один
билд, переключение конфигом, без условной бизнес-логики в компонентах.

---

## FRONTEND модуля (`Frontend/sql-module-web`)

### F1 — `/launch` (`SQLI-010`)

`GET /launch?session={sessionId}#access_token={module_access_token}` — маршрут
**до** `RequireAuth`.

`LaunchPage`:
1. Прочитать `location.hash` → `#access_token` до рендеров.
2. Декодировать существующим `decodeSessionUser`.
3. Токен → **`sessionStorage`** (не `localStorage`), см. F4.
4. Сразу `history.replaceState(null, '', pathname + '?session=' + sessionId)`.
5. `GET /api/v1/module-integration/sessions/current` (S3) — до `200` лоадер.
6. Успех → `navigate('/student/tasks/' + taskId)` (`taskId` из S3, **не** из URL);
   `{sessionId, returnUrl}` → контекст запуска (F2).
7. `404` от S3 → безопасная ошибка «ссылка недействительна».

### F2 — контекст активного запуска (`SQLI-011`)

`{sessionId, returnUrl}` в отдельном ключе `sessionStorage`. Изолирован от
standalone, чистится при завершении/ошибке. Битый JSON = отсутствие запуска
(ложного редиректа быть не должно).

### F3 — возврат в платформу (`SQLI-018`)

После `SubmitAttempt` с `IsCorrect=true` **и** активном контексте запуска →
`window.location.assign(returnUrl)` (значение из F2, не `navigate()`). Вне
контекста запуска (standalone) — не срабатывает.

### F4 — источник токена + `handoff`-provider (`SQLI-008/009`, готово)

Реестр активного `TokenProvider` в HTTP-слое; `createHandoffTokenProvider`
хранит токен в `sessionStorage`, без refresh; `logout`/`401` очищают.

---

## Плохие пути — поведение модуля

| Ситуация | Модуль |
|---|---|
| Повторный пуш C1 (тот же `sessionId`) | upsert, no-op |
| `SubmitAttempt` без claim `session_id` (`platform`) | `409 ModuleSessionRequired` |
| `taskId` submit ≠ `task_ref` сессии | `409 SessionTaskMismatch` |
| submit после `expires_at` | `409 ModuleSessionClosed` |
| Kafka недоступна | `pending_publish` копится, publisher ретраит; на оценку не влияет |
| Education недоступен при `/complete` | `pending_publish(grade)` ретраится до `200`; студент уже редиректнут |
| Education ответил `409` на `/complete` | строка `sent`, `ModuleSession=COMPLETED`, WARN |
| Дабл-сабмит верного решения | 2-й submit видит `COMPLETED` → ни события, ни оценки |
| Вернулся и продолжил (новый пуш на тот же `sessionId`) | upsert обновил запись, новый токен — работа продолжается |

---

## Соответствие доске модуля (`SQLI-*`)

| Раздел ТЗ | SQLI | Готово по доске модуля на 2026-09-05 |
|---|---|---|
| S1 / C2 | SQLI-003 | Done |
| S2 / C1 | SQLI-005 | Done |
| S3 / C6 | SQLI-006 | Done |
| S4 | SQLI-012 | Done |
| S5 / C4 | SQLI-013, SQLI-014 | Done |
| S5 / C3 | SQLI-015, SQLI-016 | Done |
| S6 | SQLI-017 | Done |
| S7 | SQLI-007 | Done |
| F1 | SQLI-010 | Ready |
| F2 | SQLI-011 | Ready |
| F3 | SQLI-018 | Backlog |
| F4 | SQLI-008, SQLI-009 | Done |
| OpenAPI/Orval | SQLI-020 | Backlog |
| Тесты/smoke | SQLI-021, SQLI-022, SQLI-023 | Backlog / Blocked |

`SQLI-023` (E2E) больше **не** блокируется Education/Identity — эта часть готова;
остаётся ждать platform-web `MOD-010…012` и reverse-proxy `MOD-015`.

---

## Приёмка модуля

- [x] S1–S7 и F4 — по доске `SQLI-*` (backend-команда, 2026-09-05).
- [ ] F1/F2 (`SQLI-010/011`) — довести до Done против реальных C1/C6.
- [ ] F3 (`SQLI-018`) — возврат по `returnUrl` только для верной попытки в контексте запуска.
- [ ] `SQLI-020` — OpenAPI модуля (S1–S3) + Orval у `sql-module-web` без ручных правок.
- [ ] `SQLI-021` — негативные/конкурентные тесты (чужая сессия, task mismatch,
      expiry, double submit, Kafka outage, Education outage, рестарт publisher).
- [ ] `SQLI-022` — standalone-регрессия (прямой логин + teacher/admin/student без Education/Kafka).

## Не входит

- Кнопка «Сдать» как альтернативный триггер оценки — расширение того же `pending_publish/grade`.
- `payload` события сложнее текущего набора полей — не нужно, пока Education
  использует событие только как лог.
- Общий инстанс модуля на оба audience — позже, сейчас два профиля.
- Шифрование `sessionKey` at rest в БД модуля — техдолг `SQLI-TD-001`; redaction
  в логах обязательна уже сейчас.

## Известные несостыковки на стороне платформы (не блокируют backend модуля)

- **`return_url` vs маршрут студента.** Education строит `returnUrl` по шаблону
  `{origin}/student/practicals/{practicalId}?session=…`, а страница практики
  platform-web вложена в `/student/courses/:courseId/modules/:moduleId/practicals/:practicalId`.
  Решается на стороне platform-web (плоский redirect-маршрут) либо в Education
  (шаблон с `courseId/moduleId`). Модуль просто делает `assign(returnUrl)` — его это
  не касается.
- Чтение текущей привязки практики (`kind`, модуль, `externalTaskRef`,
  `timeLimitMinutes`) для UI преподавателя — отдельная доработка Education
  (`MOD-006b`, в бэклоге).
- Read-эндпоинт ленты `PracticalTaskEvent` для UI протокола — доработка Education
  (`MOD-012a`, в бэклоге).
