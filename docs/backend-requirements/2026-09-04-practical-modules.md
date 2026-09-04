# Backend handoff — подключение практических модулей (Education)

Дата: 2026-09-04. **Статус: спека, к реализации не приступали.**
Проект бэкенда: `Education` (`C:\Users\vladislav.bokovoi\SQLTren\Education`).
Контекст: подключение внешних модулей отработки навыков к платформе
(`Frontend/platform-web`, `MOD-` в `docs/MIGRATION_KANBAN.md`, Phase 7).

Полный дизайн, рациональное обоснование каждого решения и сквозной сценарий —
[`../MODULE_INTEGRATION.md`](../MODULE_INTEGRATION.md). Этот документ — только
то, что нужно реализовать в `Education`, без повторения «почему».

## Зависимости

- **`MOD-002a`/`MOD-002b`** (IdentityService, отдельный handoff —
  [`2026-09-04-identity-token-exchange.md`](./2026-09-04-identity-token-exchange.md)):
  без эндпоинта `/api/v1/auth/token/exchange` не собрать `launchUrl` (раздел
  «Жизненный цикл сессии» ниже).
- **`MOD-003`** (Kafka в dev-инфраструктуре): без брокера не поднять consumer.
- Пилотный модуль (SQL) — отдельный воркстрим (`Backend/SqlModule`), в это
  задание не входит; Education рассчитан на **произвольный** модуль через
  реестр, SQL — первая запись в нём.

## Модель данных (новое)

```
PracticalModule
  id                uuid  PK
  slug              text  AK          -- "sql", часть URL: /modules/sql/
  name              text
  description       text
  practice_type     text                -- "SQL_SIMULATOR"
  base_path         text                -- "/modules/sql"  (проксируемый путь UI модуля)
  identity_audience text                -- "sql-module-api" — audience для Token Exchange
  is_enabled        bool
  configuration     jsonb               -- { catalogEndpoint: "http://sqlmodule-web:8080/training/tasks-catalog", ... }

Practical  (существующая PracticalMaterial)
  + kind         text   -- "internal" (как сейчас, дефолт) | "external"
  + tries_count  int4   -- переиспользуется тот же столбец/смысл, что и для внутреннего теста

PracticalTask (существующая Case)
  + practical_module_id uuid null FK → PracticalModule
  + external_task_ref   text null       -- id/ключ задания внутри модуля (из каталога)

PracticalModuleSession
  id                uuid  PK
  practical_task_id uuid  FK → PracticalTask
  user_id           uuid  FK → User (Education, не identity sub)
  try_number        int4                 -- 1..triesCount
  status            text                 -- ACTIVE | COMPLETED | EXPIRED
  launch_token      text                 -- одноразовый, для attach (см. ниже), гасится после использования
  module_token      text                 -- секрет сессии для Kafka-сообщений модуля, наружу (в HTTP-ответы) никогда не отдаётся
  started_at        timestamptz
  completed_at      timestamptz null
  score             float8 null          -- метаданные модуля, для отображения (ядро НЕ считает по ним grade)
  max_score         float8 null
  grade             int4 null            -- присылает модуль в completion, ядро только хранит
  completion_data   jsonb null

PracticalTaskEvent
  id                   uuid  PK
  session_id           uuid  FK → PracticalModuleSession
  seq                  int8                 -- порядковый номер от модуля
  event_type           text                 -- "CODE_EXECUTION" и т.п., модуль-специфично
  occurred_at          timestamptz
  data                 jsonb
  intermediate_result  jsonb null
  UNIQUE (session_id, seq)
```

Только **три** статуса сессии — не пять. `PENDING`/`ABANDONED` не нужны: сессия
создаётся сразу `ACTIVE` в момент запроса на запуск (переход по ссылке считается
началом попытки), терминальные исходы — `COMPLETED` (пришла Kafka-completion) или
`EXPIRED` (TTL истёк без completion).

## Требуемые эндпоинты

Аутентификация/авторизация — как у соседних срезов (`AdminOnly`/`TeacherOnly`/
`StudentOnly`, `EducationUserResolver`), ответы — `ProblemDetails`/
`HttpValidationProblemDetails`, `204` на мутациях без тела.

### E1 — реестр модулей (администратор)

```
GET    /api/v1/admin/practical-modules                                   AdminOnly
POST   /api/v1/admin/practical-modules                                   AdminOnly
  { slug, name, description, practiceType, basePath, identityAudience, configuration }
  → 201 PracticalModuleResponse
PUT    /api/v1/admin/practical-modules/{id}                              AdminOnly
DELETE /api/v1/admin/practical-modules/{id}                              AdminOnly
```

### E2 — каталог заданий модуля (преподаватель)

```
GET /api/v1/practical-modules/{practicalModuleId}/tasks                  TeacherOnly
 → 200 [ { ref, name, description } ]
```

Реализация: сервер-сервер `GET` на `PracticalModule.configuration.catalogEndpoint`,
нормализация ответа. Таймаут короткий (2–3 с), при недоступности модуля — `502`
с понятным сообщением, браузер к API модуля напрямую не ходит никогда.

### E3 — привязка модуля к практике (преподаватель)

```
PUT /api/v1/practicals/{practicalId}/module                              TeacherOnly
  { practicalModuleId, externalTaskRef, triesCount }
 → 204
```

Переводит `Practical.kind` в `external`, создаёт единственный `PracticalTask`
(1:1 на MVP) со ссылкой на модуль и `externalTaskRef` (должен быть из ответа E2,
валидировать принадлежность модулю). `triesCount` — как у `ConfigurePracticalQuestionsRequest`
для внутреннего теста, тот же диапазон/валидация.

### E4 — инициализация сессии (студент)

```
POST /api/v1/practicals/{practicalId}/module-sessions                    StudentOnly
  { taskId }
 → 200 { sessionId, launchUrl, expiresAt, tryNumber }
 → 409 { reason: "TriesExhausted" }   -- attemptsCount >= triesCount
 → 409 { reason: "SessionActive" }    -- есть незавершённая ACTIVE сессия по этому заданию
```

Логика:
1. `attemptsCount = COUNT(PracticalModuleSession WHERE user_id=… AND practical_task_id=…)`
   — **включая `EXPIRED`** (попытка списывается на старте, как и у внутреннего теста —
   см. `PracticalMaterial.CanStartAttempt`, `EfTestResultsRepository.StartTestAsync`).
2. Если `attemptsCount >= triesCount` → `409 TriesExhausted`.
3. Если есть `PracticalModuleSession.status=ACTIVE` для user+task → `409 SessionActive`.
4. Создать сессию: `status=ACTIVE`, `tryNumber = attemptsCount + 1`, `startedAt = now`,
   сгенерировать `launchToken` (одноразовый, TTL ~10 мин, привязан к `sessionId+userId+taskRef`).
5. Обменять токен запроса на токен модуля — вызов IdentityService Token Exchange
   (см. handoff по IdentityService), `audience = PracticalModule.identityAudience`.
6. Собрать `launchUrl`:
   ```
   {origin}{PracticalModule.basePath}/launch
     ?session={sessionId}&task={externalTaskRef}
     &return_url={ENC(registeredPlatformOrigin + returnPath)}
     &token={launchToken}
   #access_token={exchangedToken}
   ```
   `origin` и `registeredPlatformOrigin` — из конфигурации Education (не из
   заголовков запроса — чтобы модуль не мог подменить `return_url`).

### E5 — статус сессии (студент)

```
GET /api/v1/practicals/{practicalId}/module-sessions/{sessionId}         StudentOnly
 → 200 { status, tryNumber, score, maxScore, grade, startedAt, completedAt, eventCount }

GET /api/v1/practicals/{practicalId}/module-sessions/current             StudentOnly
  ?taskId={taskId}
 → 200 { session: {...} | null, attemptsCount, triesCount, bestGrade }
```

`current` — основной источник для гейта кнопки «Начать» на фронте (не только
`?session=` из `return_url`): работает одинаково после честного возврата, при
обычном открытии страницы, при заходе «назад» из модуля браузером.

### E6 — обмен launch-токена (бэкенд модуля → Education)

```
POST /api/v1/module-sessions/{sessionId}/attach                          [сервис модуля]
  { launchToken }
 → 200 { moduleToken, userId, taskRef, kafka: { bootstrap, eventsTopic, completionTopic } }
 → 401 — токен истёк / уже использован / сессия не та
```

Аутентификация вызывающего — TBD при реализации (mTLS/сервисный API-ключ модуля;
зафиксировать в `MOD-007`). `launchToken` гасится сразу после первого успешного
использования (single-use).

### E7 — Kafka consumer

Топик `scoodle.practice.events` (key=`sessionId`): валидировать `moduleToken`
против сессии → `INSERT PracticalTaskEvent` с `ON CONFLICT (session_id, seq) DO NOTHING`
(идемпотентность при переигрывании).

Топик `scoodle.practice.completion` (key=`sessionId`): валидировать `moduleToken`,
проверить что сессия ещё `ACTIVE` (терминальный переход **один раз** — повторная
completion по уже `COMPLETED` сессии игнорируется, не переписывает `grade`) →
`status=COMPLETED`, `completedAt=now`, сохранить `grade`/`score`/`maxScore`/
`completionData` **как прислал модуль**, без перерасчёта.

Схемы сообщений — см. `MODULE_INTEGRATION.md` §7.

### E8 — итоговая оценка практики (best-of-N)

Расширить существующий `GET /api/v1/practicals/{practicalId}/grade`
(`GradesService`/`EfGradesRepository`) для `kind=external`:

```csharp
// по аналогии с существующим testResults.Max(...) для kind=internal
var bestGrade = sessions
    .Where(s => s.Status == "COMPLETED")
    .Select(s => s.Grade)
    .DefaultIfEmpty()
    .Max();
```

Если ни одной `COMPLETED`-сессии нет — `grade: null`, `messages: ["Пройдите практику"]`.

### E9 — TTL сессии

Фоновая задача (или ленивая проверка при чтении статуса): `ACTIVE`-сессия без
новых `PracticalTaskEvent` дольше N времени → `EXPIRED`. Точное значение N —
согласовать при реализации (ориентир ~2 часа, см. остаточный вопрос в
`MODULE_INTEGRATION.md`).

## Приёмка

- [ ] `PracticalModule`, `PracticalModuleSession`, `PracticalTaskEvent` — EF-конфигурации, миграции/`EnsureCreated`.
- [ ] `Practical.Kind`/`TriesCount`, `PracticalTask.PracticalModuleId`/`ExternalTaskRef` — расширения существующих агрегатов.
- [ ] E1–E9 реализованы, под нужными политиками, с проверкой владения где применимо.
- [ ] Гейт попыток (`TriesExhausted`/`SessionActive`) покрыт интеграционными тестами (аналог `TeacherWriteEndpointsApiTests`).
- [ ] Kafka consumer идемпотентен (переигрывание сообщения не дублирует события/не переоткрывает завершённую сессию).
- [ ] `best-of-N` в `GET /practicals/{id}/grade` покрыт тестом (несколько `COMPLETED`-сессий → выбирается максимальная).
- [ ] OpenAPI обновлён, экспортирован владельцем; `platform-web` перегенерировал Orval-клиент.

## Не входит в эту итерацию

- Реализация самого SQL-модуля (`Backend/SqlModule`/`Frontend/sql-module-web`) — отдельные задачи `MOD-013…014a`.
- Живой просмотр «цифрового следа» преподавателем (push) — сознательно не делаем, см. `MODULE_INTEGRATION.md`.
- Более одного задания на внешнюю практику — зафиксировано как ограничение MVP.
