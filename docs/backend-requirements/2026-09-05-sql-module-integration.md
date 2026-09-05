# Backend/Frontend handoff — SQL-модуль как внешний практический модуль

Дата: 2026-09-05. **Статус: спека, концепт пересмотрен 2026-09-05, к реализации не приступали.**
Проекты: `Backend/SqlModule` (`.NET`, minimal API + `IEndpoint`/CQRS через `ISender`)
и `Frontend/sql-module-web` (standalone React SPA).

Общий дизайн и обоснование — [`../MODULE_INTEGRATION.md`](../MODULE_INTEGRATION.md)
(редакция от 2026-09-05, раздел «Отличия от первой редакции» — что поменялось).
Требования к Education — [`2026-09-04-practical-modules.md`](./2026-09-04-practical-modules.md)
(⚠️ ещё не переписан под новый концепт, см. «Что ещё не синхронизировано» в конце).
Требования к IdentityService — [`2026-09-04-identity-token-exchange.md`](./2026-09-04-identity-token-exchange.md)
(⚠️ то же).

Исполнительная доска модуля: [`sql-module-web/docs/PLATFORM_INTEGRATION_KANBAN.md`](../../../sql-module-web/docs/PLATFORM_INTEGRATION_KANBAN.md).
Kanban платформы: `MOD-013` (frontend `/launch` + handoff), `MOD-013a` (backend каталог),
`MOD-014` (backend: приём пуша, publisher, `/complete`), `MOD-014a` (backend audience).

---

## Ключевая мысль нового концепта

Модуль **не вызывает** Education, чтобы «приаттачиться». Наоборот: Education при
старте сессии сам **пушит** её бэкенду модуля (сервер-сервер) со всеми данными,
включая секрет сессии. Дальше модуль:

- принимает вызовы студента по `module_access_token` (сессию берёт из claim
  `session_id` в токене);
- пишет **лог действий** в Kafka (топик `scoodle.practice.events`);
- по завершению задания **HTTP-запросом** отправляет оценку в Education.

Kafka — только лог. Оценка — HTTP. Обратного `attach` нет. `moduleToken`, `seq`,
`Idempotency-Key`, transactional outbox как паттерн — из спеки убраны.

## Словарь (полностью — в `MODULE_INTEGRATION.md`)

| Слово | Для модуля это | Откуда берётся |
|---|---|---|
| `module_access_token` | Bearer в каждом вызове студента; внутри claim `session_id` | фрагмент URL `/launch` → `sessionStorage` |
| `sessionKey` | секрет: кладётся в каждое Kafka-событие и в HTTP-оценку | приходит в пуше от Education, хранится в `ModuleSession`, **в браузер не отдаётся** |
| `sessionId` | Guid сессии, не секрет | claim токена / query `?session=` / пуш |
| `serviceKey` | общий статический пароль с Education | secret-конфиг обоих; заголовок `X-Service-Key` на прямых вызовах |

---

## Зависимости

- **`MOD-002a/b`** (IdentityService, Done) — Token Exchange работает. **Нужна
  доработка:** exchange-токен должен нести claim `session_id` (Education передаёт
  `sessionId` в запрос). Пока не сделано — см. handoff IdentityService.
- **`MOD-003`** (Kafka, Done) — брокер поднят, топик `scoodle.practice.events`
  создан. Топик `scoodle.practice.completion` **больше не используется**.
- **`MOD-004`** (реестр модулей, Done) — регистрация SQL: `slug=sql`,
  `basePath=/modules/sql`, `identityAudience=sql-module-api`,
  `configuration.catalogEndpoint`.
- **`MOD-005…008`** (Education: каталог/привязка/сессия/пуш/`/complete`/consumer) —
  не реализованы. SqlModule готовится параллельно по контрактам ниже; end-to-end —
  после них.

## Существующее состояние SqlModule (для оценки объёма)

Зрелый самодостаточный бэкенд с контуром Student: `StudentEndpoints.cs` отдаёт
темы, задания, **безопасную схему БД задания** (`.../schema`), попытки. Отправка
решения — `POST` в `Web/Features/Training/Attempts/SubmitAttempt`
(`SubmitAttemptRequest { TaskId, SubmittedSql }`), **синхронно**: попытка тут же
проверяется, `IsCorrect`/`CheckReason`/грид возвращаются в ответе и пишутся в
`Attempt`. Долгого исполнения и своего polling нет — интеграционные механизмы
добавляются **сверху** этого flow.

Роли (`Web/Common/Auth/Policies.cs`): `Admin/Teacher/Student` — совпадают с
IdentityService, доработок не требуют.

Аутентификация сейчас: `Auth.Authority=http://localhost:5101`,
`Auth.Audience=scoodle-api` — общий audience с Education, который убирается в S7.

## Границы: два deployment-профиля

Один код и один билд, поведение — конфигом:

- **`standalone`** — как сейчас: прямой логин через IdentityService, все контуры
  teacher/admin/student, `Auth:Audience=scoodle-api`. Не зависит от Education,
  Kafka, пуша. **Постоянный обязательный режим.**
- **`platform`** — `Auth:Audience=sql-module-api`; включены эндпоинты
  `module-integration/*`, publisher, вызов Education `/complete`. Приходит только
  трафик из платформы (через `/launch`).

Общий инстанс, принимающий оба audience сразу, — **позже**, не в этой итерации.

---

# BACKEND (`Backend/SqlModule`)

## S1 — каталог заданий (`MOD-013a`)

Ручка, которую Education дёргает сервер-сервер, проксируя свой
`GET /api/v1/practical-modules/{id}/tasks`.

```
GET /api/v1/module-integration/tasks-catalog
  X-Service-Key: <serviceKey>
 200 [ { ref: string, name: string, description: string } ]
 401 — serviceKey не совпал
```

- Источник — как `GetStudentTasks`, фильтр **только** `PublicationStatus.Published`.
  Без пагинации (Education берёт список целиком; массив, не `PageResponse` —
  `offset/limit` можно добавить потом без breaking change).
- `ref = task.Id.ToString()`. Education хранит его непрозрачно в
  `PracticalTask.ExternalTaskRef`.
- `name = task.TaskName`; `description` — `TaskText` до ~200 символов.
- **Аутентификация — `X-Service-Key`.** Один и тот же секрет в конфиге SqlModule
  (`Auth:ServiceKey`) и Education (`PracticalModules:sql:ServiceKey`). Не в
  `PracticalModule.configuration` (её возвращает admin-API). Для dev — фиксированный
  сид, как `InitialClients`.
- Лёгкий SELECT, Education ставит таймаут 2–3 с.

## S2 — приём пуша сессии (`MOD-014`)

Education при старте (и при продолжении) сессии зовёт:

```
POST /api/v1/module-integration/sessions
  X-Service-Key: <serviceKey>
  { sessionId, sessionKey, userId, taskRef, returnUrl, expiresAt }   -- expiresAt может быть null
 200  -- upsert выполнен
 401  -- serviceKey не совпал
```

Логика: `ModuleSession` по `sessionId` — нет → INSERT, есть → UPDATE (продолжение
попытки шлёт тот же `sessionId` с новым/тем же содержимым). **Идемпотентно.**
Никаких обратных вызовов в Education отсюда.

`ModuleSession` (новая сущность + миграция):

```
session_id    uuid PK          -- из Education
session_key   text             -- секрет, redaction в логах/ProblemDetails/telemetry
user_id       uuid
task_ref      text
return_url    text
expires_at    timestamptz null
status        text             -- ACTIVE | COMPLETED
created_at / updated_at timestamptz
```

Модулю не нужен статус `EXPIRED`: время контролирует Education. Модуль лишь
перестаёт принимать submit'ы после своего `expires_at` (если задан) и помечает
`COMPLETED`, когда Education подтвердил оценку (или ответил `409` на `/complete`).

## S3 — «текущая сессия» для фронта (`MOD-014`)

```
GET /api/v1/module-integration/sessions/current
  Bearer module_access_token
 200 { taskId, returnUrl, expiresAt }
 404 — в токене нет claim session_id, или ModuleSession не найдена, или чужой user
```

Читает `session_id` из claim, находит `ModuleSession`, сверяет `user_id` с `sub`
токена, отдаёт **канонические** `task_ref` (как `taskId`) и `return_url`. Фронт
доверяет этому, не query-параметрам `/launch`.

## S4 — привязка `SubmitAttempt` к сессии (`MOD-014`, профиль `platform`)

В профиле `platform` каждый авторизованный запрос несёт claim `session_id`. На
`POST /training/attempts/submit`:

1. Найти `ModuleSession` по `session_id` из claim. Нет → `409 ModuleSessionRequired`.
2. `ModuleSession.user_id == sub` токена? Нет → `403`.
3. `ModuleSession.task_ref == request.TaskId`? Нет → `409 SessionTaskMismatch`
   (не навигировать по недоверенному GUID).
4. `ModuleSession.status == ACTIVE` и (`expires_at == null` или `now <= expires_at`)?
   Нет → `409 ModuleSessionClosed`.
5. Выполнить попытку как обычно (синхронная проверка, запись `Attempt`).
6. В той же транзакции, что и `Attempt`, добавить строку в `pending_publish`
   (`kind=event`).
7. Если `IsCorrect` и `ModuleSession.status == ACTIVE` → добавить строку
   `pending_publish` (`kind=grade`), `ModuleSession.status = COMPLETED`.

Ответ студенту `SubmitAttempt` **не меняется** — публикация асинхронна (S5).

В профиле `standalone` шаги 1–4, 6–7 пропускаются: обычная попытка без сессии и
без Kafka.

## S5 — `pending_publish` + фоновый publisher (`MOD-014`)

Вместо «transactional outbox» как паттерна — маленькая таблица и цикл. Надёжность
та же: строки пишутся в одной транзакции с `Attempt`, доставка — отдельно с retry,
рестарт процесса ничего не теряет.

```
pending_publish
  id              uuid PK
  kind            text          -- "event" | "grade"
  session_id      uuid
  message         jsonb         -- готовое тело сообщения (см. ниже)
  attempts        int  default 0
  next_attempt_at timestamptz
  sent_at         timestamptz null
```

Фоновый `BackgroundService`: берёт `sent_at IS NULL AND next_attempt_at <= now`,
по одной:

- `kind=event` → publish в Kafka `scoodle.practice.events`, key = `sessionId`.
  Успех брокера (ack) → `sent_at = now`. Ошибка → `attempts++`,
  `next_attempt_at = now + backoff(attempts)`.
- `kind=grade` → `POST {EducationBaseUrl}/api/v1/module-sessions/{sessionId}/complete`
  (S = «Оценка» ниже). `200` → `sent_at`. `409` → `sent_at` (Education закрыл
  сессию не в нашу пользу — прекращаем), лог WARN. Сеть/`5xx` → backoff.

Порядок: `sent_at` ставится **после** подтверждения, не до. Один «ядовитый»
message не должен стопорить очередь (обрабатывать по одной, при исчерпании
`attempts` — в «мёртвую» с алертом, не блокировать остальные). Чистка
`sent_at IS NOT NULL` старше N дней.

Пакет — `Confluent.Kafka` (версия своя, разумно взять `2.15.0` как в Education).
`Education.Kafka` как NuGet **не переиспользуется** (общего фида между репо нет).
Сериализация — camelCase (`JsonSerializerDefaults.Web`), под контракт Education.

### Тело события (Kafka `scoodle.practice.events`)

```json
{
  "sessionId": "…",
  "sessionKey": "…из ModuleSession…",
  "eventId": "uuid — генерит модуль на каждое событие, ключ дедупа у Education",
  "kind": "sql_submit",
  "occurredAt": "2026-09-05T10:15:30Z",
  "payload": {
    "submittedSql": "SELECT …",
    "status": "SUCCESS",
    "rowCount": 25,
    "durationMs": 120,
    "isCorrect": false,
    "reason": "…CheckReason…"
  }
}
```

`kind` для MVP всегда `sql_submit` (одно событие на `SubmitAttempt`). `payload` —
произвольный, Education не разбирает. Захочет модуль слать `sql_run`/`hint_open`
позже — контракт не меняется.

### Тело оценки (HTTP → Education)

```
POST {EducationBaseUrl}/api/v1/module-sessions/{sessionId}/complete
  X-Service-Key: <serviceKey>
  {
    "sessionKey": "…из ModuleSession…",
    "grade": 100,
    "completionData": { "totalAttempts": 3, "correctAttemptId": "…Attempt.Id…" },
    "completedAt": "2026-09-05T10:40:00Z"
  }
 200 — принято (или уже COMPLETED)
 409 — сессия не ACTIVE у Education (истекла/прервана) — оценка отклонена
 401 — serviceKey/sessionKey не совпал
```

**Критерий завершения (решение владельца 2026-09-05):** первая новая
`IsCorrect=true` попытка. Ровно одно `complete` на сессию. Шкала 100-балльная;
для текущей бинарной проверки `grade ∈ {0, 100}` (решил верно → 100). Контракт
допускает промежуточные 0–100 в будущих типах заданий. Явной кнопки «Сдать» в MVP
нет — можно добавить позже как ещё один триггер того же `pending_publish`/`grade`.

Нужен новый исходящий `HttpClient` (`IHttpClientFactory` + типизированный клиент).
Прецедента исходящих вызовов к сервисам платформы в репо нет — только входящая
JWT-валидация через `Authority`.

## S6 — жизненный цикл `ModuleSession`

- Создаётся/обновляется пушем S2 (`status=ACTIVE`).
- `COMPLETED` — после подтверждённой оценки (S5) или `409` от Education.
- Просроченные (`expires_at < now`, всё ещё `ACTIVE`) — фоновая уборка помечает,
  submit'ы по ним уже отбиваются в S4.4. Синхронизировать статус с Education не
  обязательно: Education сам истекает свою сессию, а `/complete` по ней вернёт
  `409`.
- Никаких событий/оценок по `COMPLETED`/просроченной сессии.

## S7 — собственная `Audience` (`MOD-014a`)

Профиль `platform`: `Auth:Audience=sql-module-api` (вместо `scoodle-api`). Код
JWT-валидации не трогается, только конфиг. Значение должно совпадать с
`PracticalModule.IdentityAudience` (реестр Education) и `allowedAudiences` клиента
`education-core` в IdentityService (`["sql-module-api"]`, уже настроено).

Профиль `standalone` остаётся на `scoodle-api` — прямой логин и контуры
teacher/admin/student работают как раньше. Переключение — конфигом, без условной
бизнес-логики в компонентах.

---

# FRONTEND (`Frontend/sql-module-web`)

## F1 — маршрут `/launch` (`MOD-013`)

Добавить в `AppRouter.tsx` **до** `RequireAuth`-маршрутов (сам `/launch` и есть
механизм входа).

```
GET /launch?session={sessionId}#access_token={module_access_token}
```

`LaunchPage` (в `src/session/`, симметрично `LoginPage`):

1. На маунте, до рендеров: прочитать `location.hash` → `#access_token`.
2. Декодировать через существующий `decodeSessionUser` — **не** писать новый декодер.
3. Положить токен в **`sessionStorage`** (не `localStorage`) — см. F4.
4. Сразу `history.replaceState(null, '', location.pathname + '?session=' + sessionId)`
   — токен не должен остаться в истории/при копировании ссылки.
5. `GET /api/v1/module-integration/sessions/current` (S3, уже с новым Bearer) —
   до `200` показывать лоадер.
6. Успех → `navigate('/student/tasks/' + taskId)` (`taskId` из ответа S3, **не** из
   URL). Сохранить `sessionId` + `returnUrl` в контекст запуска (F2).
7. `404` от S3 → «ссылка недействительна, вернитесь на платформу и начните заново».
   Пути назад нет (`returnUrl` в этом случае неизвестен).

Ни `launch_token`, ни вызова `attach` — их больше нет.

## F2 — контекст активного запуска (`MOD-013`)

Вкладка хранит `{ sessionId, returnUrl }` активного запуска — в `sessionStorage`
под отдельным ключом (не в общем session-store). Контекст:

- изолирован от standalone (в standalone его просто нет);
- очищается при завершении (F3) и при ошибке `/launch`;
- используется F3 и (в профиле `platform`) для гейта «редиректить или нет».

## F3 — возврат в платформу (`MOD-013`)

После `SubmitAttempt` с `IsCorrect=true` **и** при наличии активного контекста
запуска (F2) → `window.location.assign(returnUrl)` (значение из F2, канонический
адрес от Education; **не** `navigate()` — это уход на другое приложение).

Вне контекста запуска (обычный standalone) редирект не срабатывает.

## F4 — `TokenProvider: handoff` + источник токена в HTTP-слое (`MOD-013`)

Сейчас generated-клиенты читают токен из Zustand-синглтона (`session-store.ts`,
жёстко `localStorage`). Отдельный `TokenProvider` сам по себе ничего не изменит —
сначала ввести **общий источник access-token** для HTTP-мутаторов (абстракция),
потом подключить к нему режимы.

`handoff`-провайдер (`src/session/providers/handoff-token-provider.ts`, по образцу
`memory-token-provider.ts`):

```ts
export function createHandoffTokenProvider(): TokenProvider {
  const KEY = 'sql-module-handoff-token';
  return {
    getAccessToken: () => sessionStorage.getItem(KEY),
    setTokens: ({ accessToken }) => sessionStorage.setItem(KEY, accessToken),
    clear: () => sessionStorage.removeItem(KEY),
    // без getRefreshToken/refresh: истёк — новый launch из платформы («Продолжить»)
  };
}
```

`sessionStorage`, не `localStorage` (узкоаудиторный токен, TTL ~5 мин, не должен
жить между визитами). Без auto-refresh.

---

## Плохие пути — что делает модуль

| Ситуация | Поведение модуля |
|---|---|
| Пуш S2 пришёл повторно (тот же `sessionId`) | upsert, no-op |
| `SubmitAttempt` без claim `session_id` (профиль `platform`) | `409 ModuleSessionRequired` |
| `taskId` в submit ≠ `task_ref` сессии | `409 SessionTaskMismatch` |
| submit после `expires_at` | `409 ModuleSessionClosed` |
| Kafka недоступна при публикации события | строка `pending_publish` копится, publisher ретраит; на оценку не влияет |
| Education недоступен при `/complete` | `pending_publish(grade)` ретраится до `200`; студент уже редиректнут, страница практики покажет оценку, когда ретрай пройдёт |
| Education ответил `409` на `/complete` | строка помечается отправленной, `ModuleSession=COMPLETED`, WARN в лог |
| Дабл-сабмит верного решения | второй submit видит `ModuleSession.status=COMPLETED` → события/оценки не порождает |
| Студент вернулся и продолжил (новый пуш на тот же `sessionId`) | upsert обновил `ModuleSession`, новый `module_access_token` — работа продолжается |

---

## Как закрыты прежние 10 замечаний бэк-команды

| # | Замечание (первая редакция) | Как закрыто |
|---|---|---|
| 1 | Привязка `SubmitAttempt` к сессии не определена | claim `session_id` в токене + проверки S4.1–4.4; standalone — без сессии |
| 2 | `return_url` нельзя брать из URL как доверенный | Education строит и хранит его, пушит модулю (S2); фронт берёт из S3, не из query |
| 3 | Фронт не должен доверять `task` из query | S3 отдаёт канонический `taskId`; `/launch` навигирует по нему (F1.6) |
| 4 | Надёжность Kafka занижена (fire-and-forget) | `pending_publish` + publisher с retry (S5); оценка вообще ушла с Kafka на HTTP-ретрай |
| 5 | Идемпотентность попытки/события | `eventId` (uuid) — дедуп у Education; `/complete` идемпотентен по статусу сессии; `Idempotency-Key` не нужен |
| 6 | Service key в возвращаемом `configuration` | В secret-конфиге Education по slug'у, не в `configuration` (S1) |
| 7 | Хранение `moduleToken` | Один `sessionKey`; redaction в логах/ProblemDetails/telemetry (S2); шифрование в БД — tech-debt |
| 8 | Смена audience ломает teacher/admin | Два deployment-профиля (S7); `standalone` остаётся на `scoodle-api` |
| 9 | handoff-provider не подключён к HTTP-слою | F4: сначала абстракция источника токена, потом режимы |
| 10 | Нужен lifecycle модульной сессии | S6: `ACTIVE/COMPLETED`, `expires_at`, уборка, запрет после terminal |

---

## Декомпозиция на малые итерации

| Итерация | Зона | Задача | Зависимость | Гейт |
|---|---|---|---|---|
| INT-01 | Решения | Зафиксировано: completion по первой верной попытке; 100-балльная шкала; два профиля; serviceKey в secret Education; пуш вместо attach; оценка по HTTP; `session_id` claim | — | В спеке нет P0-развилок ✅ |
| INT-02 | SqlModule API | S1: каталог `Published`-заданий, `X-Service-Key`, лимит, integration-тесты | INT-01 | S1 принят |
| INT-03 | Education | Прокси каталога с таймаутом, `X-Service-Key`, обработкой `502` | INT-02 | `MOD-005` |
| INT-04 | Education | External-practical 1:1: привязка модуля, canonical `taskRef`, `triesCount`, `timeLimitMinutes` | INT-03 | `MOD-006` |
| INT-05 | platform-web | Admin CRUD реестра без вывода секретов | INT-01 | `MOD-009` |
| INT-06 | platform-web | Teacher UI: выбор модуля/задания, `triesCount`, `timeLimitMinutes` | INT-04 | `MOD-010` |
| INT-07 | IdentityService | Claim `session_id` в exchange-токене (параметр `sessionId`) | INT-01 | exchange отдаёт claim |
| INT-08 | Education | Session lifecycle: старт/продолжение, гейт попыток, `abandon`, `expiresAt`, лениво-`EXPIRED`, Token Exchange с `sessionId`, **пуш модулю** | INT-04, INT-07 | `MOD-007` |
| INT-09 | SqlModule API | S2 (`ModuleSession` + приём пуша, upsert) + S3 (`sessions/current`) | INT-08 | S2/S3 приняты |
| INT-10 | SqlModule Auth | S7: профиль `platform` с `aud=sql-module-api`, `standalone` не сломан | INT-01, INT-09 | S7 принят |
| INT-11 | sql-module-web | F4: абстракция источника токена в HTTP-слое + `handoff` (`sessionStorage`) | INT-10 | F4 принят |
| INT-12 | sql-module-web | F1 (`/launch`: hash→sessionStorage, scrub, `current`, navigate) + F2 (контекст запуска) | INT-09, INT-11 | F1/F2 приняты |
| INT-13 | SqlModule API | S4: привязка `SubmitAttempt` к сессии (проверки owner/task/status) | INT-09 | Параллельные вкладки безопасны |
| INT-14 | SqlModule API | S5: `pending_publish` + фоновый publisher (события в Kafka, `attempts`/backoff) | INT-13 | Рестарт не теряет событие |
| INT-15 | Education | Kafka-consumer: `INSERT … ON CONFLICT (id) DO NOTHING` → лента; событий после terminal нет | INT-08, INT-14 | `MOD-008` |
| INT-16 | Education + SqlModule | `POST /module-sessions/{id}/complete` (Education-приём) + `kind=grade` в publisher SqlModule; идемпотентность/`409` | INT-14, INT-15 | Оценка не теряется и не задваивается |
| INT-17 | Education | best-of-N в `GET /practicals/{id}/grade` для `kind=external` | INT-16 | `MOD-008a` |
| INT-18 | sql-module-web | F3: возврат по `returnUrl` только для верной попытки в контексте запуска | INT-12, INT-16 | F3 принят |
| INT-19 | platform-web | Student: гейт «Начать»/«Продолжить»/«Прервать» по `current`; возврат → статус → grade/протокол (poll как запасной путь) | INT-08, INT-17 | `MOD-011/012` |
| INT-20 | Infra/E2E | Reverse proxy, CSP/referrer-policy, логи без секретов, happy path + security/chaos smoke | INT-03–INT-19 | `MOD-015/016` |

Каждая итерация — целевые тесты + Swagger/Orval при смене HTTP-контракта +
проходящий build/typecheck затронутого фронта. E2E — не первая точка проверки
wire-контракта.

---

## Приёмка

- [ ] S1: `GET /module-integration/tasks-catalog` — `ref/name/description` по
      `Published`, `X-Service-Key`, тест.
- [ ] S2: `POST /module-integration/sessions` — upsert `ModuleSession`,
      идемпотентен, `X-Service-Key`, тесты 200/401.
- [ ] S3: `GET /module-integration/sessions/current` — канонические `taskId`/
      `returnUrl` по claim `session_id`, `404` на чужой/несуществующей.
- [ ] S4: `SubmitAttempt` в профиле `platform` проверяет `session + owner + task +
      status`; standalone — без изменений; тесты на 409/403.
- [ ] S5: `pending_publish` пишется в транзакции с `Attempt`; publisher шлёт
      события в Kafka и оценку в Education с retry; рестарт процесса ничего не
      теряет; формат события — camelCase под consumer Education.
- [ ] S6: `ModuleSession` `ACTIVE→COMPLETED`, submit после `expires_at` → `409`,
      нет событий/оценок после terminal.
- [ ] S7: профиль `platform` — `aud=sql-module-api`; `standalone` teacher/admin/
      student работают без Education/Kafka; переключение конфигом.
- [ ] F1: `/launch` — hash→`sessionStorage`, немедленный scrub, `current`,
      navigate по каноническому `taskId`.
- [ ] F2: контекст запуска в `sessionStorage`, изолирован от standalone, чистится.
- [ ] F3: `window.location.assign(returnUrl)` только для верной попытки в контексте
      запуска.
- [ ] F4: единый источник токена в HTTP-слое; `handoff` в `sessionStorage`, без
      refresh.
- [ ] OpenAPI SqlModule обновлён (S1–S3 — новые контракты); Orval у sql-module-web
      перегенерирован.

## Не входит в эту итерацию

- Явная кнопка «Сдать» как альтернативный триггер оценки — расширение, контракт не
  ломает.
- `payload` события сложнее `{ submittedSql, status, rowCount, durationMs,
  isCorrect, reason }` — не нужен, пока Education использует событие только как лог.
- Общий инстанс SqlModule на оба audience сразу — позже; сейчас два профиля.
- Шифрование `sessionKey` в БД модуля — tech-debt (`INT-TD-001`), redaction в
  логах — обязательна уже сейчас.

---

## Что ещё не синхронизировано с новым концептом

Эти доки всё ещё описывают первую редакцию (attach / Kafka-completion / `moduleToken` /
`seq`) — их правка отдельной задачей:

- [`2026-09-04-practical-modules.md`](./2026-09-04-practical-modules.md) — Education:
  убрать `attach` (E6), добавить пуш модулю и `POST /module-sessions/{id}/complete`;
  `Practical.timeLimitMinutes`; `PracticalModuleSession` — `session_key`/`return_url`/
  `expires_at`/`end_reason` вместо `launch_token`/`module_token`; `abandon`;
  продолжение вместо `409 SessionActive`; `PracticalTaskEvent` — `eventId`/`kind`/
  `payload` вместо `seq`/`event_type`; consumer — только события.
- [`2026-09-04-identity-token-exchange.md`](./2026-09-04-identity-token-exchange.md) —
  IdentityService: параметр `sessionId` в `/token/exchange`, claim `session_id` в
  выпускаемом токене.
- `MIGRATION_KANBAN.md` — строки `MOD-007/008/013/014` переформулировать под пуш и
  HTTP-оценку.
