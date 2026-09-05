# Backend handoff — подключение практических модулей (Education)

Дата: 2026-09-04, **переписан под пересмотренный концепт 2026-09-05.**
**Статус: E1 реализован (`MOD-004`, 2026-09-05), E2–E11 — спека.**
Проект бэкенда: `Education` (`C:\Users\vladislav.bokovoi\SQLTren\Education`).
Контекст: подключение внешних модулей отработки навыков к платформе
(`Frontend/platform-web`, `MOD-` в `docs/MIGRATION_KANBAN.md`, Phase 7).

Полный дизайн и обоснование — [`../MODULE_INTEGRATION.md`](../MODULE_INTEGRATION.md)
(редакция 2026-09-05). Требования к SQL-модулю —
[`2026-09-05-sql-module-integration.md`](./2026-09-05-sql-module-integration.md).
Этот документ — что реализовать в `Education`.

> **Изменения против редакции 2026-09-04:** нет обратного `attach` — Education
> **пушит** сессию модулю (E6). Оценка приходит **HTTP-запросом** (E7), не через
> Kafka. Kafka несёт только лог событий (E8), топик `completion` удалён. Секрет
> сессии один (`session_key`), в браузер не уходит. `seq` → `eventId`. Время на
> попытку задаёт преподаватель. Есть «Прервать попытку» (E9) и продолжение
> `ACTIVE`-сессии вместо `409 SessionActive` (E4).

## Подтверждённые контрактные ответы (2026-09-05, запрос backend-команды SqlModule)

Backend SqlModule заблокирован до фиксации этих пунктов — здесь они закрыты
окончательно. Соответствующие задачи kanban подняты в приоритете
(`MOD-002c → MOD-006 → MOD-007 → MOD-008`, `MOD-005` параллельно).

### Пуш сессии (E6)

| Вопрос | Ответ |
|---|---|
| Повторный вызов с тем же `sessionId` | **Идемпотентный upsert.** Нет строки → INSERT, есть → UPDATE. Education шлёт повторный пуш при «Продолжить» и как ретрай, если первый не получил `2xx`. |
| Какие поля меняются при повторном пуше | **Никакие в MVP.** `sessionKey` не ротируется (один на всю жизнь сессии); `userId`, `taskRef`, `returnUrl` неизменны для данной сессии; `expiresAt` не сдвигается (продолжение не докупает время). Повторный пуш несёт идентичное тело — он существует, чтобы пересоздать строку у модуля, если она потерялась. Если модуль видит расхождение — Education источник истины, модуль перезаписывает. |
| Можно ли обновлять уже завершённую сессию | **Нет.** Если у модуля `ModuleSession.status=COMPLETED` — вернуть `409`, тело игнорировать. Education и не пушит завершённую (продолжение возможно только для `ACTIVE`). |
| `taskRef` | **= `SqlTask.Id`** (строкой). Это тот же `ref`, что модуль отдал в каталоге E2; Education хранит его непрозрачно в `PracticalTask.ExternalTaskRef`. |
| `returnUrl` | **Формирует Education** из зарегистрированного origin платформы (конфиг, не заголовки запроса). Доверенный канонический адрес; модуль навигирует ровно на него, из URL `/launch` return не берёт. |
| Порядок | **Пуш → Token Exchange → сборка `launchUrl` → ответ студенту.** `launchUrl` отдаётся только после успешного пуша и обмена. Пуш не `2xx` → весь `POST /module-sessions` → `502`, студент остаётся на платформе. |

### Завершение практики (E7 — `POST /api/v1/module-sessions/{sessionId}/complete`)

| Код | Значение | Действие модуля |
|---|---|---|
| `200` | Оценка принята **или** эта же сессия уже `COMPLETED` (повтор той же операции) | Прекратить ретраи, пометить `pending_publish`-строку отправленной |
| `409` | Сессия закрыта **окончательно** (`EXPIRED` по времени / `abandoned`) — оценка отклонена | **Прекратить ретраи.** Любой `409` = финал, повторять не нужно. Пометить `ModuleSession` закрытой, WARN в лог |
| `401` | Неверный `X-Service-Key` **или** `sessionKey` не совпал с сессией | Не ретраить (конфигурационная ошибка), ERROR в лог |
| `5xx` / сеть / таймаут | Временная ошибка Education | Ретраить с backoff |

**Идемпотентность.** Первый вызов по `ACTIVE`-сессии: `status=COMPLETED`,
`completed_at=now`, `end_reason=completed`, сохранить `grade`/`completion_data`
как прислал модуль. Повторный вызов по уже `COMPLETED`: `200`, **ничего не
менять** (не перезаписывать `grade`, не трогать `completed_at`). Ключ
идемпотентности — сам факт `status=COMPLETED` у сессии; отдельный
`Idempotency-Key` не нужен.

### Kafka / журнал действий (E8)

| Вопрос | Ответ |
|---|---|
| Топик | `scoodle.practice.events` (один; `completion` удалён) |
| Kafka key | `sessionId` |
| Дедупликация | по `eventId` (`INSERT … ON CONFLICT (id) DO NOTHING`) |
| Что в Kafka | **только журнал действий.** Итоговая оценка — по HTTP (E7). Потеря/опоздание события = дырка в ленте, на оценку не влияет |
| Retry / dead-letter | Consumer (`KafkaConsumerBackgroundService`) коммитит офсет только после успешной обработки → падение хендлера = переигрывание при рестарте. Poison-message: после **5** неудачных обработок — ERROR-лог с `eventId`+`sessionId` (**без `sessionKey`**), офсет коммитится (сообщение пропускается, событие теряется из ленты — приемлемо). **Отдельного DLQ-топика в MVP нет**; ручной перезапуск оператором — сброс consumer-группы на нужный офсет вручную, в MVP не автоматизируется |
| `sessionKey` в событии | есть; **в обычные логи/ProblemDetails/telemetry не писать** (redaction обязательна с обеих сторон) |

### Общие секреты и конфигурация

Платформа предоставляет SqlModule (профиль `platform`): одинаковый
`X-Service-Key` (dev-сид, как `InitialClients`), адрес Education API, Kafka
bootstrap servers, имя топика, `audience=sql-module-api`. `serviceKey` живёт в
secret-конфиге Education (`PracticalModules:<slug>:ServiceKey`) и SqlModule
(`Auth:ServiceKey`); **не** в `PracticalModule.configuration` (её возвращает
admin-API) и **не** в браузер.

## Зависимости

- **`MOD-002a`/`MOD-002b`** (IdentityService, Done) — Token Exchange работает.
  **Нужна доработка** ([`2026-09-04-identity-token-exchange.md`](./2026-09-04-identity-token-exchange.md)):
  `/api/v1/auth/token/exchange` принимает `sessionId` и кладёт его в claim
  `session_id` выпускаемого токена.
- **`MOD-003`** (Kafka, Done) — брокер поднят, топик `scoodle.practice.events`
  создан. `scoodle.practice.completion` **не используется**.
- Пилотный модуль (SQL) — отдельный воркстрим (`Backend/SqlModule`), в это
  задание не входит; Education рассчитан на **произвольный** модуль через реестр.

## Модель данных (новое)

```
PracticalModule
  id                uuid  PK
  slug              text  AK          -- "sql", часть URL: /modules/sql/
  name              text
  description       text
  practice_type     text              -- "SQL_SIMULATOR"
  base_path         text              -- "/modules/sql"
  identity_audience text              -- "sql-module-api" — audience для Token Exchange
  is_enabled        bool
  configuration     jsonb             -- { catalogEndpoint: "…", … } — СЕКРЕТОВ здесь нет
                                      --   (admin-API возвращает это поле как есть)

Practical  (существующая PracticalMaterial)
  + kind               text   -- "internal" (дефолт) | "external"
  + tries_count        int4   -- как у внутреннего теста
  + time_limit_minutes int4 null  -- задаёт преподаватель при привязке; null = без лимита

PracticalTask (существующая Case)
  + practical_module_id uuid null FK → PracticalModule
  + external_task_ref   text null       -- ключ задания внутри модуля (из каталога E2)

PracticalModuleSession
  id                uuid  PK
  practical_task_id uuid  FK → PracticalTask
  user_id           uuid  FK → User (Education, не identity sub)
  try_number        int4                 -- 1..triesCount
  status            text                 -- ACTIVE | COMPLETED | EXPIRED
  end_reason        text null            -- completed | timeout | abandoned (для UI, на логику не влияет)
  session_key       text                 -- секрет сессии: подпись Kafka-событий + аутентификация E7.
                                         --   Уходит модулю в пуше (E6), в браузер/HTTP-ответы студенту — НИКОГДА
  return_url        text                 -- собирает Education при старте, уходит модулю в пуше (E6)
  started_at        timestamptz
  expires_at        timestamptz null     -- started_at + time_limit_minutes; null при отсутствии лимита
  completed_at      timestamptz null
  grade             int4 null            -- 0..100, присылает модуль (E7), ядро только хранит
  completion_data   jsonb null

PracticalTaskEvent
  id           uuid  PK                  -- = eventId от модуля; ключ дедупликации
  session_id   uuid  FK → PracticalModuleSession
  kind         text                      -- произвольная строка модуля ("sql_submit" и т.п.), ядро не разбирает
  occurred_at  timestamptz
  payload      jsonb                     -- любой JSON от модуля, ядро хранит как есть
```

Три статуса сессии. `end_reason` — только для текста в UI. `session_key`/
`return_url` заменили `launch_token`/`module_token`; `score`/`max_score` убраны
(модуль кладёт что нужно в `completion_data`).

`serviceKey` для каждого модуля — в **secret-конфиге Education** по slug'у
(`PracticalModules:<slug>:ServiceKey`), не в БД, не в `configuration`.

## Требуемые эндпоинты

Аутентификация/авторизация студенческих и преподавательских ручек — как у
соседних срезов (`AdminOnly`/`TeacherOnly`/`StudentOnly`, `EducationUserResolver`),
ответы — `ProblemDetails`/`HttpValidationProblemDetails`.

### E1 — реестр модулей (администратор) — **реализовано (`MOD-004`)**

```
GET/POST/PUT/DELETE /api/v1/admin/practical-modules                      AdminOnly
  POST { slug, name, description, practiceType, basePath, identityAudience, configuration }
```

### E2 — каталог заданий модуля (преподаватель)

```
GET /api/v1/practical-modules/{practicalModuleId}/tasks                  TeacherOnly
 → 200 [ { ref, name, description } ]
 → 502 — модуль недоступен
```

Сервер-сервер `GET` на `configuration.catalogEndpoint` с заголовком
`X-Service-Key: <serviceKey модуля>`, нормализация ответа, таймаут 2–3 с. Браузер
к API модуля не ходит.

### E3 — привязка модуля к практике (преподаватель)

```
PUT /api/v1/practicals/{practicalId}/module                             TeacherOnly
  { practicalModuleId, externalTaskRef, triesCount, timeLimitMinutes }
 → 204
```

Переводит `Practical.kind` в `external`, создаёт единственный `PracticalTask`
(1:1) со ссылкой на модуль и `externalTaskRef` (из ответа E2, валидировать
принадлежность модулю). `triesCount` — тот же диапазон/валидация, что у
внутреннего теста. `timeLimitMinutes` — положительное целое или `null` (без
лимита). Смена значений при живых сессиях на них не влияет.

### E4 — старт / продолжение сессии (студент)

```
POST /api/v1/practicals/{practicalId}/module-sessions                   StudentOnly
  { taskId }
 → 200 { sessionId, launchUrl, expiresAt, tryNumber, resumed }
 → 409 { reason: "TriesExhausted" }    -- attemptsCount (вкл. EXPIRED) >= triesCount
 → 502 { reason: "ModuleUnavailable" } -- пуш в модуль (E6) не прошёл
```

Логика:
1. Найти последнюю сессию студента по этому `PracticalTask`. Если она `ACTIVE` и
   (`expires_at IS NULL` или `now <= expires_at`) → **продолжение**:
   - НЕ создавать новую, НЕ менять `try_number`/`started_at`/`expires_at`;
   - повторить пуш модулю (E6) с тем же `sessionId`/`session_key`/`return_url`;
   - заново вызвать Token Exchange с этим `sessionId`;
   - вернуть её `launchUrl`, `resumed: true`.
2. Если она `ACTIVE`, но `now > expires_at` → пометить `EXPIRED`
   (`end_reason=timeout`) и идти дальше.
3. `attemptsCount = COUNT(PracticalModuleSession WHERE user_id=… AND practical_task_id=…)`
   — **включая `EXPIRED`** (попытка списывается на старте, как у внутреннего теста
   — `PracticalMaterial.CanStartAttempt`, `EfTestResultsRepository.StartTestAsync`).
   `>= triesCount` → `409 TriesExhausted`.
4. Сгенерировать `session_key` (crypto-random), собрать `return_url` из
   **зарегистрированного origin платформы** (конфиг Education, не заголовки
   запроса).
5. **Пуш в модуль (E6).** Не `2xx` после ограниченного числа ретраев → `502`.
   Рекомендация: создавать `PracticalModuleSession` в БД **после** успешного пуша
   — тогда неудачный запуск не тратит попытку. (Если создавать до — пометить
   `EXPIRED`/`timeout`.)
6. Создать `PracticalModuleSession`: `status=ACTIVE`, `try_number=attemptsCount+1`,
   `started_at=now`, `expires_at = time_limit_minutes ? now + time_limit_minutes : null`.
7. Token Exchange (`audience = PracticalModule.identity_audience`, `sessionId`) →
   `access_token`.
8. Собрать `launchUrl` и вернуть, `resumed: false`:
   ```
   {origin}{PracticalModule.base_path}/launch
     ?session={sessionId}
   #access_token={access_token}
   ```
   В query — только `sessionId`. Секрета в query нет. `session_key` в `launchUrl`
   **не входит** (ушёл модулю пушем).

### E5 — статус сессии (студент)

```
GET /api/v1/practicals/{practicalId}/module-sessions/{sessionId}        StudentOnly
 → 200 { status, tryNumber, startedAt, expiresAt, endReason, grade, completedAt, eventCount }

GET /api/v1/practicals/{practicalId}/module-sessions/current            StudentOnly
  ?taskId={taskId}
 → 200 { session: { sessionId, status, tryNumber, startedAt, expiresAt, endReason, grade } | null,
         attemptsCount, triesCount, timeLimitMinutes, bestGrade }
```

Оба чтения **лениво истекают** просроченную `ACTIVE`-сессию
(`now > expires_at` → `EXPIRED`, `end_reason=timeout`) перед формированием ответа.

`current` — единственный источник для гейта кнопок на фронте (не `?session=` из
`return_url`):
- `session` `ACTIVE` и не истекла → «Продолжить» + «Прервать»;
- иначе `attemptsCount < triesCount` → «Начать»;
- иначе → заблокировано, показать `bestGrade`.

### E6 — пуш сессии в модуль (Education → бэкенд модуля)

```
POST {module}/module-integration/sessions                              [Education → module]
  X-Service-Key: <serviceKey модуля>
  { sessionId, sessionKey, userId, taskRef, returnUrl, expiresAt }     -- expiresAt может быть null
 ← 200  -- модуль сделал upsert своей локальной записи о сессии
```

Вызывается на шаге E4.5 (старт) и E4.1 (продолжение — с тем же `sessionId`).
Education ретраит до `2xx` ограниченно (в рамках запроса студента E4, ~2–3
быстрые попытки); не удалось → `502` из E4. `userId` — идентификатор пользователя
в Education (тот, что попадёт в `sub` обменянного токена).

### E7 — приём оценки (бэкенд модуля → Education)

```
POST /api/v1/module-sessions/{sessionId}/complete                      [module → Education]
  X-Service-Key: <serviceKey модуля>
  { sessionKey, grade, completionData, completedAt }
 → 200  -- ACTIVE → COMPLETED (или уже COMPLETED → 200 без изменений)
 → 409  -- сессия не ACTIVE (EXPIRED/abandoned) — оценка отклонена
 → 401  -- serviceKey ИЛИ sessionKey не совпал с сессией
```

Логика: сверить `X-Service-Key` (грубо) и `sessionKey` против
`PracticalModuleSession.session_key` (точно). Сессия `ACTIVE` → `status=COMPLETED`,
`completed_at=now`, `end_reason=completed`, сохранить `grade` (0..100) и
`completion_data` **как прислал модуль**, без перерасчёта. Уже `COMPLETED` → `200`,
ничего не менять (идемпотентность ретраев модуля). `EXPIRED` → `409`.

### E8 — Kafka consumer (только события)

Топик `scoodle.practice.events` (key = `sessionId`). Терминальных переходов
**нет** — это только лента цифрового следа.

Формат сообщения:
```json
{ "sessionId": "…", "sessionKey": "…", "eventId": "uuid",
  "kind": "sql_submit", "occurredAt": "…", "payload": { … } }
```

Consumer: сверить `sessionKey` против сессии → `INSERT PracticalTaskEvent (id=eventId,
session_id, kind, occurred_at, payload) ON CONFLICT (id) DO NOTHING`
(идемпотентность при переигрывании). Событие по сессии в терминальном статусе —
отбросить. `payload`/`kind` не интерпретировать.

`Education.Contracts.Kafka` (`PracticeEventMessage`) нужно привести к этому
формату: `eventId`/`kind`/`payload` вместо `moduleToken`/`moduleSlug`/`taskRef`/
`seq`/`eventType`/`intermediateResult`; `PracticeCompletionMessage` и константу
топика `PracticeCompletion` — **удалить**.

### E9 — прервать попытку (студент)

```
POST /api/v1/practicals/{practicalId}/module-sessions/{sessionId}/abandon  StudentOnly
 → 200  -- ACTIVE → EXPIRED, end_reason=abandoned
 → 409  -- сессия уже терминальна
```

Только владелец сессии. Модулю не сообщается: поздний `E7` от модуля по этой
сессии вернёт `409`.

### E10 — итоговая оценка практики (best-of-N)

Расширить `GET /api/v1/practicals/{practicalId}/grade`
(`GradesService`/`EfGradesRepository`) для `kind=external`:

```csharp
var bestGrade = sessions
    .Where(s => s.Status == "COMPLETED")
    .Select(s => s.Grade)
    .DefaultIfEmpty()
    .Max();
```

Ни одной `COMPLETED` → `grade: null`, `messages: ["Пройдите практику"]`. Аналог
`testResults.Max(...)` для внутреннего теста.

### E11 — истечение сессии

- **По времени преподавателя:** `ACTIVE`-сессия с `expires_at IS NOT NULL` и
  `now > expires_at` → `EXPIRED` (`end_reason=timeout`). Достаточно ленивой
  проверки при чтении статуса (E5) и на старте (E4.2); фоновая задача — по
  желанию, для чистоты.
- **Потолок:** любая `ACTIVE`-сессия старше `started_at + 24 ч` → `EXPIRED`
  независимо от `time_limit_minutes` (сборка мусора при `null`-лимите).

## Приёмка

- [x] `PracticalModule` — EF-конфигурация, `EnsureCreated` (`MOD-004`, `bc2e45d`).
- [x] E1 (`MOD-004`): `GET/POST/PUT/DELETE /api/v1/admin/practical-modules`,
      `AdminOnly`, валидация slug/basePath, тесты в `PracticalModulesApiTests`.
- [ ] `PracticalModuleSession` (+ `session_key`/`return_url`/`expires_at`/
      `end_reason`), `PracticalTaskEvent` (+ `id=eventId`/`kind`/`payload`) —
      EF-конфигурации, `EnsureCreated`.
- [ ] `Practical.Kind`/`TriesCount`/`TimeLimitMinutes`,
      `PracticalTask.PracticalModuleId`/`ExternalTaskRef` — расширения агрегатов.
- [ ] E2–E11 реализованы, под нужными политиками, с проверкой владения.
- [ ] E4: продолжение `ACTIVE`-сессии (не `409`), гейт `TriesExhausted`,
      `resumed`-флаг, `502` при недоступном модуле — покрыто тестами.
- [ ] E6/E7: пуш в модуль и приём `/complete` — `X-Service-Key` + `sessionKey`,
      `/complete` идемпотентен, `409` для не-`ACTIVE` — тесты.
- [ ] E8: consumer идемпотентен по `eventId`, события после terminal
      отбрасываются; `Education.Contracts.Kafka` приведён к новому формату,
      `completion` удалён.
- [ ] E9: `abandon` → `EXPIRED`/`abandoned`, `409` на терминальной — тест.
- [ ] E10: best-of-N покрыт тестом (несколько `COMPLETED` → максимум).
- [ ] E11: ленивое истечение по `expires_at` и потолок 24 ч — тест.
- [ ] OpenAPI обновлён; `platform-web` перегенерировал Orval-клиент.

## Не входит в эту итерацию

- Реализация самого SQL-модуля — отдельные задачи (`MOD-013…014a`).
- Живой просмотр «цифрового следа» преподавателем (push) — сознательно не делаем.
- Более одного задания на внешнюю практику — ограничение MVP.
- Общий инстанс модуля на оба audience — позже (сейчас два deployment-профиля у
  модуля, Education это не касается).
