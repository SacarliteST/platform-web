# Подключение практических модулей (Host–Plugin, редирект + Kafka)

Проработка механизма подключения внешних модулей отработки навыков к платформе
Scoodle. Пилот — **SQL-модуль** (`Backend/SqlModule` + `Frontend/sql-module-web`).

Статус: **дизайн, к реализации не приступали.** Основа — концепция курсовой
(«Хост–Плагин», EDA, разделы 2.2 и 2.5): ядро `Education` — диспетчер, модули —
самостоятельные единицы; «цифровой след» течёт в ядро отдельным каналом, поэтому
модуль не «чёрный ящик».

## Принятые решения

| Вопрос | Решение |
|---|---|
| Размещение UI модуля | **Тот же origin, под путём** — `/<platform>/modules/<slug>/…`, реверс-прокси заводит SPA модуля внутрь платформы. Общие куки/сессия допустимы. |
| Переход в модуль | **Замена вкладки** — `window.location.assign(launchUrl)`. Платформа не остаётся открытой. |
| Возврат | Модуль по завершении редиректит на **`return_url`** платформы (origin платформы, проверяется ядром). Страница практики поллит статус сессии и показывает оценку/протокол. |
| Шина событий | **Kafka** (не SignalR). Модуль — producer, `Education` — consumer. Асинхронный брокер, гарантия доставки, переигрывание. |
| Объём | Полный цикл: реестр модулей + инициализация сессии + возврат + приём «цифрового следа» и завершения через Kafka. |

## Компоненты и зоны ответственности

```
Браузер студента
  │  (1) POST /practicals/{id}/module-sessions            REST
  ▼
Education (ядро-диспетчер)  ── реестр модулей, жизненный цикл сессии,
  │                            выпуск launch-токена, расчёт оценки
  │  (2) 302 → launchUrl (тот же origin, /modules/sql/launch?…)
  ▼
sql-module-web (SPA модуля, reverse-proxy под /modules/sql/)
  │  (3) отдаёт launch-контекст своему бэкенду
  ▼
SqlModule.Web (бэкенд модуля)
  │  (4) Kafka producer: события + завершение
  ▼
Kafka  ──topic: scoodle.practice.events / .completion──►  Education consumer
                                                            │ PracticalTaskEvents,
                                                            │ статус сессии, оценка
  (5) модуль → window.location = return_url (origin платформы)
  ▼
platform-web: страница практики поллит GET /module-sessions/{id} → оценка/протокол
```

| Компонент | Что делает нового |
|---|---|
| **Education** (бэкенд, моя зона — спека) | сущности `PracticalModule`, `PracticalModuleSession`, `PracticalTaskEvent`; вид практики `external`; эндпоинты admin-CRUD реестра, привязки модуля к практике, жизненного цикла сессии; выпуск/проверка короткоживущего launch-токена; **Kafka consumer** (события + завершение); расчёт оценки за модульную практику; чтение протокола |
| **platform-web** (моя зона — реализация) | распознавание вида практики; страница внешней практики (кнопка «Начать» → `POST session` → `window.location = launchUrl`); обработчик возврата (`?session=` → поллинг → результат + ссылка на протокол); UI преподавателя «привязать модуль + выбрать задание»; UI администратора для реестра модулей; регенерация `api/` + `entities/` после обновления swagger |
| **sql-module-web** (отдельный воркстрим) | маршрут `/launch` (читает `session / task / return_url / token`); embedded-режим (base-path и токен от хоста — уже заложено в `CONCEPT.md §3`); по завершении задания → `window.location = return_url` |
| **SqlModule.Web** (отдельный воркстрим) | приём launch/attach от своего UI; **Kafka producer** для событий попыток и завершения; маппинг внутреннего задания/попытки на `taskRef` / `sessionId` |
| **Инфраструктура** | Kafka в `Backend/compose.yaml`; nginx-reverse-proxy (`/` → platform-web, `/modules/sql/` → sql-module-web, `/module-api/sql/` → SqlModule.Web, `/api/v1/` → Education); контейнер/сборка sql-module-web |

## Модель данных (Education, новое)

```
PracticalModule
  id            uuid  PK
  slug          text  AK          -- "sql", в URL: /modules/sql/
  name          text
  description   text
  practice_type text                -- "SQL_SIMULATOR" (из курсовой)
  base_path     text                -- "/modules/sql"  (проксируемый путь)
  is_enabled    bool
  configuration jsonb               -- специфика модуля: kafka-топики, режим
                                    --   маппинга заданий, доп. параметры запуска

Practical  (существующая)  + kind text  -- "internal" (как сейчас) | "external"

PracticalTask (существующая) + practical_module_id uuid null FK
                              + external_task_ref  text null   -- id задачи внутри модуля

PracticalModuleSession
  id            uuid  PK
  practical_task_id  uuid FK
  user_id       uuid FK              -- Education User (не identity sub)
  status        text                 -- PENDING | ACTIVE | COMPLETED | EXPIRED | ABANDONED
  launch_token  text                 -- короткоживущий, single-use, отдаётся в launchUrl
  module_token  text                 -- секрет для Kafka-сообщений модуля, в браузер не уходит
  started_at    timestamptz
  completed_at  timestamptz null
  score         float8 null
  max_score     float8 null
  grade         int4 null
  completion_data jsonb null

PracticalTaskEvent
  id            uuid  PK
  session_id    uuid FK
  seq           int8                 -- порядковый номер от модуля (для дедупа/порядка)
  event_type    text                 -- CODE_EXECUTION | HINT_USED | …
  occurred_at   timestamptz
  data          jsonb
  intermediate_result jsonb null
  UNIQUE (session_id, seq)
```

## Контракты

### 1. Реестр модулей — администратор (Education, `AdminOnly`)

```
GET    /api/v1/admin/practical-modules
POST   /api/v1/admin/practical-modules      { slug, name, description, practiceType, basePath, configuration }
PUT    /api/v1/admin/practical-modules/{id}
DELETE /api/v1/admin/practical-modules/{id}
```

### 2. Привязка модуля к практике — преподаватель (Education, `TeacherOnly`)

```
PUT /api/v1/practicals/{practicalId}/module
    { practicalModuleId, tasks: [ { name, externalTaskRef } ] }
    -- переводит практику в kind=external, создаёт PracticalTask со ссылкой на модуль
```

`externalTaskRef` — идентификатор/ключ задания внутри модуля. Список доступных
заданий модуля преподаватель получает из самого модуля (его API), либо вводит
вручную на первом этапе.

### 3. Инициализация сессии — студент (Education, `StudentOnly`)

```
POST /api/v1/practicals/{practicalId}/module-sessions   { taskId }
 200 {
   sessionId,
   launchUrl,          -- см. ниже, собирается ядром
   expiresAt
 }
 409 — незавершённая сессия уже есть (вернуть её launchUrl либо запретить)
```

`launchUrl` (тот же origin):

```
/modules/sql/launch
  ?session={sessionId}
  &task={externalTaskRef}
  &return_url={ENC(https://<platform-origin>/student/courses/{c}/modules/{m}/practicals/{p}?session={sessionId})}
  &token={launchToken}        -- одноразовый, TTL ~10 мин, привязан к {sessionId, userId, taskRef}
```

`return_url` собирает **ядро** из зарегистрированного origin платформы — модуль не
может подставить произвольный адрес.

### 4. Статус сессии — студент (Education, `StudentOnly`)

```
GET /api/v1/practicals/{practicalId}/module-sessions/{sessionId}
 200 { status, score, maxScore, grade, startedAt, completedAt, eventCount }

GET /api/v1/practicals/{practicalId}/module-sessions/current   { taskId }
 200 { … } | 404   -- последняя сессия студента по заданию, для страницы возврата
```

### 5. Обмен launch-токена — бэкенд модуля → Education

Браузерный `launchToken` не годится для доверия. UI модуля отдаёт его своему
бэкенду, тот обменивает:

```
POST /api/v1/module-sessions/{sessionId}/attach   { launchToken }
 200 { moduleToken, userId, taskRef, kafka: { bootstrap, eventsTopic, completionTopic } }
 401 — токен истёк / израсходован / не тот модуль
```

`moduleToken` — серверный секрет сессии, кладётся в каждое Kafka-сообщение,
в браузер не попадает. `launchToken` после обмена гасится.

### 6. Kafka — модуль (producer) → Education (consumer)

Топик `scoodle.practice.events`, key = `sessionId`:

```json
{
  "sessionId": "88e73f-2211-4a",
  "moduleToken": "…server secret…",
  "moduleSlug": "sql",
  "taskRef": "sql-join-001",
  "seq": 7,
  "eventType": "CODE_EXECUTION",
  "occurredAt": "2026-02-15T10:15:30Z",
  "payload": {
    "input_code": "SELECT * FROM orders WHERE user_id = 1",
    "execution_status": "SUCCESS",
    "rows_affected": 25
  },
  "intermediateResult": { "correct": false }
}
```

Топик `scoodle.practice.completion`, key = `sessionId`:

```json
{
  "sessionId": "88e73f-2211-4a",
  "moduleToken": "…server secret…",
  "status": "COMPLETED",
  "finalScore": 95.0,
  "maxScore": 100.0,
  "completionData": { "total_attempts": 3, "correctness_ratio": 1.0 },
  "completedAt": "2026-02-15T10:40:00Z"
}
```

Consumer ядра: проверяет `moduleToken` против сессии; события — append в
`PracticalTaskEvent` (идемпотентно по `(sessionId, seq)`); completion —
статус `COMPLETED`, расчёт `grade` по порогам практики от `finalScore/maxScore`,
запись результата `PracticalTask`. Completion обрабатывается один раз (терминальный
переход).

### 7. Возврат в платформу

Модуль по завершении: `window.location.assign(return_url)`.
Страница практики platform-web видит `?session=…`, поллит контракт §4 каждые
~2 с, пока `status` не терминальный, затем показывает `score/grade` и ссылку на
протокол (события сессии). Пуш не нужен — событийность на стороне ядра.

## Безопасность

- `launchToken` — одноразовый, короткоживущий, привязан к `sessionId+userId+taskRef`,
  гасится при `attach`. В URL — допустимо (TTL мал, single-use), но не логировать.
- `moduleToken` — только сервер↔сервер, в каждом Kafka-сообщении, никогда в браузер.
- `return_url` строит ядро из зарегистрированного origin платформы; модуль не влияет.
- Kafka — SASL/ACL: producer-права на `scoodle.practice.*` только у сервис-аккаунта
  модуля; ядро — только consumer.
- Сессия одноразовая: повторный `attach` или `completion` по завершённой сессии — 409/ignore.
- Тот же origin → CSRF-поверхность общая с платформой; формы модуля защищены как обычно.
- Заброшенная сессия: TTL (напр. 2 ч без событий) → `EXPIRED`, без оценки.

## Открытые вопросы

1. **Кто ставит оценку 2–5**: ядро считает от `finalScore/maxScore` по порогам
   практики (как во внутреннем тесте), или модуль присылает готовую оценку?
2. **Число заданий на внешнюю практику**: 1:1 практика↔задание модуля, или
   несколько `PracticalTask`?
3. **Живой просмотр «цифрового следа» преподавателем во время сессии** — нужен
   (тогда нужен пуш к преподавателю), или достаточно протокола постфактум?
4. **Каталог заданий модуля**: преподаватель выбирает из списка (нужен эндпоинт
   в модуле) или вводит `externalTaskRef` вручную на первом этапе?
5. **Аутентификация UI модуля в embedded-режиме**: хост передаёт токен
   IdentityService (у модуля и платформы общий Identity) — модуль не логинится сам?
6. **Реверс-прокси**: единый nginx перед всем, или nginx платформы проксирует к
   контейнерам модуля? (влияет на `compose.yaml` из `PLT-019`)
7. **Kafka в dev**: одиночный брокер KRaft в `Backend/compose.yaml` — ок?

## План работ (черновик, до утверждения)

Раздел `Phase 7 — Подключение практических модулей` в `MIGRATION_KANBAN.md`,
серия `MOD-`. Порядок: контракт Education (спека) → Kafka в dev → Education backend →
platform-web (реестр/привязка/запуск/возврат) → sql-module-web `/launch` + embedded →
SqlModule.Web Kafka-producer → сквозной smoke на SQL-модуле.
