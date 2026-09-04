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
| Оценка | **Ставит модуль**, не ядро. Completion-сообщение несёт готовую `grade` (2–5); ядро её только сохраняет, порогов практики для внешних практик нет. |
| Заданий на практику | **1:1** — одна внешняя практика ссылается ровно на одно задание модуля (MVP). |
| Просмотр «цифрового следа» | **Постфактум** — протокол читается после завершения сессии, живого пуша преподавателю не делаем. |
| Каталог заданий модуля | Выбор из списка, **не** ручной ввод. У модуля будет отдельная ручка со списком заданий; ядро её проксирует. |
| Реверс-прокси | **Единый nginx** перед всем: platform-web, sql-module-web, SqlModule.Web, Education — один слой. |

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
| **Education** (бэкенд, моя зона — спека) | сущности `PracticalModule`, `PracticalModuleSession`, `PracticalTaskEvent`; вид практики `external`; эндпоинты admin-CRUD реестра, привязки модуля к практике (1:1), жизненного цикла сессии; **проксирование каталога заданий модуля**; выпуск/проверка короткоживущего launch-токена; **Kafka consumer** (события + completion с готовой `grade` от модуля); чтение протокола |
| **platform-web** (моя зона — реализация) | распознавание вида практики; страница внешней практики (кнопка «Начать» → `POST session` → `window.location = launchUrl`); обработчик возврата (`?session=` → поллинг → результат + ссылка на протокол); UI преподавателя «привязать модуль + выбрать задание из каталога»; UI администратора для реестра модулей; регенерация `api/` + `entities/` после обновления swagger |
| **sql-module-web** (отдельный воркстрим) | маршрут `/launch` (читает `session / task / return_url`, access-токен — из URL-фрагмента, см. «Аутентификация»); новый вариант `TokenProvider` — `handoff` (вместо JS-передачи из `CONCEPT.md §5`, т.к. переход полной навигацией, а не монтированием); по завершении задания → `window.location = return_url` |
| **SqlModule.Web** (отдельный воркстрим) | приём launch/attach от своего UI; **новая ручка каталога заданий** (`GET .../training/tasks-catalog`) для проксирования ядром; **Kafka producer** для событий попыток и завершения (с `grade`, которую вычисляет сам модуль); маппинг внутреннего задания/попытки на `taskRef` / `sessionId`; конфигурация `Authority`/`Audience` = как у Education (тот же IdentityService) |
| **Инфраструктура** | Kafka в `Backend/compose.yaml`; **единый** nginx-reverse-proxy (`/` → platform-web, `/modules/sql/` → sql-module-web, `/module-api/sql/` → SqlModule.Web, `/api/v1/` → Education); контейнер/сборка sql-module-web |

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
  score         float8 null          -- метаданные модуля, для отображения
  max_score     float8 null          --   (ядро по ним оценку НЕ считает)
  grade         int4 null            -- присылает модуль в completion, ядро только хранит
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

### 2. Каталог заданий модуля — преподаватель (Education, `TeacherOnly`)

```
GET /api/v1/practical-modules/{practicalModuleId}/tasks
 200 [ { ref, name, description } ]
```

Ядро дёргает **сервер-сервер** ручку каталога у самого модуля (URL — из
`PracticalModule.configuration.catalogEndpoint`, например
`http://sqlmodule-web:8080/training/tasks-catalog`) и отдаёт преподавателю
нормализованный список — браузер к API модуля напрямую не ходит.

### 3. Привязка модуля к практике — преподаватель (Education, `TeacherOnly`)

```
PUT /api/v1/practicals/{practicalId}/module
    { practicalModuleId, externalTaskRef }
    -- переводит практику в kind=external, создаёт единственный PracticalTask
    --   со ссылкой на модуль (1:1, MVP)
```

`externalTaskRef` выбирается из каталога §2, ручного ввода нет.

### 4. Инициализация сессии — студент (Education, `StudentOnly`)

```
POST /api/v1/practicals/{practicalId}/module-sessions   { taskId }
 200 {
   sessionId,
   launchUrl,          -- см. ниже, собирается ядром
   expiresAt
 }
 409 — незавершённая сессия уже есть (вернуть её launchUrl либо запретить)
```

`launchUrl` (тот же origin, query — для сессии; фрагмент — для токена доступа модуля к своему API, см. «Аутентификация»):

```
/modules/sql/launch
  ?session={sessionId}
  &task={externalTaskRef}
  &return_url={ENC(https://<platform-origin>/student/courses/{c}/modules/{m}/practicals/{p}?session={sessionId})}
  &token={launchToken}        -- одноразовый, TTL ~10 мин, привязан к {sessionId, userId, taskRef};
                              --   для attach модуля к Education, НЕ для вызовов API модуля
  #access_token={jwt}         -- фрагмент, не уходит на сервер/в логи — см. «Аутентификация»
```

`return_url` собирает **ядро** из зарегистрированного origin платформы — модуль не
может подставить произвольный адрес.

### 5. Статус сессии — студент (Education, `StudentOnly`)

```
GET /api/v1/practicals/{practicalId}/module-sessions/{sessionId}
 200 { status, score, maxScore, grade, startedAt, completedAt, eventCount }

GET /api/v1/practicals/{practicalId}/module-sessions/current   { taskId }
 200 { … } | 404   -- последняя сессия студента по заданию, для страницы возврата
```

### 6. Обмен launch-токена — бэкенд модуля → Education

Браузерный `launchToken` не годится для доверия. UI модуля отдаёт его своему
бэкенду, тот обменивает:

```
POST /api/v1/module-sessions/{sessionId}/attach   { launchToken }
 200 { moduleToken, userId, taskRef, kafka: { bootstrap, eventsTopic, completionTopic } }
 401 — токен истёк / израсходован / не тот модуль
```

`moduleToken` — серверный секрет сессии, кладётся в каждое Kafka-сообщение,
в браузер не попадает. `launchToken` после обмена гасится. Это **не** тот
токен, которым модуль ходит в свой собственный API как пользователь — см.
«Аутентификация».

### 7. Kafka — модуль (producer) → Education (consumer)

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
  "grade": 5,
  "finalScore": 95.0,
  "maxScore": 100.0,
  "completionData": { "total_attempts": 3, "correctness_ratio": 1.0 },
  "completedAt": "2026-02-15T10:40:00Z"
}
```

`grade` — обязательное поле, **ставит модуль** (2–5). Ядро оценку не
пересчитывает — здесь нет порогов практики, как во внутреннем тесте, только
для внутренних практик.

Consumer ядра: проверяет `moduleToken` против сессии; события — append в
`PracticalTaskEvent` (идемпотентно по `(sessionId, seq)`); completion —
статус `COMPLETED`, сохраняет `grade`/`score`/`maxScore`/`completionData` как есть,
запись результата `PracticalTask`. Completion обрабатывается один раз (терминальный
переход).

### 8. Возврат в платформу

Модуль по завершении: `window.location.assign(return_url)`.
Страница практики platform-web видит `?session=…`, поллит контракт §5 каждые
~2 с, пока `status` не терминальный, затем показывает `score/grade` и ссылку на
протокол (события сессии). Пуш не нужен — событийность на стороне ядра.

## Аутентификация UI модуля (разобрано детальнее)

Два *разных* токена решают две *разных* задачи — их нельзя путать:

| Токен | Кто выдал | Для чего | Где живёт |
|---|---|---|---|
| `launchToken` (§4, query) | Education | однократно доказать бэкенду модуля, что сессию открыл именно он, и получить `moduleToken` для Kafka (§6) | query-параметр → сразу в `attach`, гасится |
| `access_token` (фрагмент URL) | **IdentityService** (уже есть у студента — это его текущий токен из platform-web) | обычные вызовы UI модуля к **своему** API (`SqlModule.Web`) как аутентифицированный пользователь | `location.hash` → `sessionStorage` модуля |

Ключевой факт, который разбирали: `IdentityService` выдаёт токен с
**единым фиксированным `aud=scoodle-api`** независимо от того, какое приложение
инициировало логин (`Backend/IdentityService/.../appsettings*.json`, `Jwt.Audience`).
`Education` и `SqlModule.Web` оба валидируют JWT-bearer одинаково — `Authority`/`Audience`
из конфига (`SqlModule/Web/WebExtensions.cs`). Значит **токен, который студент уже
получил при логине в platform-web, валиден и против API SqlModule.Web** без
отдельной выдачи — при условии, что `SqlModule.Web` задеплоен с тем же
`Authority=<IdentityService>` / `Audience=scoodle-api` (сейчас это не
настроено — пункт в `MOD-013`).

**Почему не `TokenProvider: host-token` из `sql-module-web/CONCEPT.md §5`.**
Этот режим спроектирован для **JS-встраивания** (`mount(element, config)` —
хост передаёт токен объектом в память того же процесса). Наш редирект — это
**полная навигация**, новый JS-контекст, объекта передать некому. Нужен третий
вариант провайдера — **`handoff`**:

1. Ядро при сборке `launchUrl` не хранит `access_token` — его добавляет в
   URL **сам браузер** платформы непосредственно перед `window.location.assign`
   (платформа и так держит текущий токен в Zustand-сторе `session-store.ts`).
2. `sql-module-web` на старте (`TokenProvider: handoff`) читает `location.hash`,
   кладёт в `sessionStorage`, сразу чистит фрагмент через `history.replaceState`
   (чтобы токен не остался в видимом URL/истории).
3. Дальше — как в обычном standalone-режиме модуля, тем же токеном, до истечения
   (15 мин, `AccessTokenMinutes`) или до возврата.

Риск/остаток: сессия SQL-практики может идти дольше 15 минут — у модуля нет
refresh-токена платформы (тот приватен для platform-web). На MVP — не решаем;
варианты на будущее: раздельная выдача модулю собственного access-токена через
`attach` (аналогично `moduleToken`, но пользовательский), либо разовое продление
через ядро при приближении истечения. Зафиксировано как остаточный риск, не блокер.

## Безопасность

- `launchToken` — одноразовый, короткоживущий, привязан к `sessionId+userId+taskRef`,
  гасится при `attach`. В URL (query) — допустимо (TTL мал, single-use), не логировать.
- `access_token` — не минтится заново, это существующий токен IdentityService
  студента; передаётся во **фрагменте** URL (не query — фрагмент не уходит на сервер
  и не попадает в access-логи nginx), сразу вычищается модулем через `history.replaceState`.
- `moduleToken` — только сервер↔сервер, в каждом Kafka-сообщении, никогда в браузер.
- `return_url` строит ядро из зарегистрированного origin платформы; модуль не влияет.
- Kafka — SASL/ACL: producer-права на `scoodle.practice.*` только у сервис-аккаунта
  модуля; ядро — только consumer.
- Сессия одноразовая: повторный `attach` или `completion` по завершённой сессии — 409/ignore.
- Тот же origin → CSRF-поверхность общая с платформой; формы модуля защищены как обычно.
- Заброшенная сессия: TTL (напр. 2 ч без событий) → `EXPIRED`, без оценки.
- `SqlModule.Web` должен быть задеплоен с тем же `Authority`/`Audience`, что и
  Education (единый IdentityService) — иначе `access_token` не пройдёт валидацию.

## Закрытые вопросы (решения владельца, 2026-09-03)

1. Оценку ставит **модуль** (см. §7, `grade` обязательное поле в completion).
2. Заданий на практику — **1:1** (MVP).
3. Цифровой след — **постфактум**, без живого пуша.
4. Каталог заданий модуля — **выбор из списка** (§2), для этого модулю добавляется
   новая ручка (`MOD-013`).
5. Аутентификация — разобрана выше («Аутентификация UI модуля»): переиспользуем
   существующий `access_token` IdentityService через фрагмент URL + новый
   `TokenProvider: handoff` в `sql-module-web`.
6. Реверс-прокси — **единый nginx**.

## Остаточные вопросы (не блокируют `MOD-002`, решить по ходу реализации)

- Kafka в dev — одиночный брокер KRaft в `Backend/compose.yaml`, топики создаются
  при старте consumer'а (auto-create) или явным init-скриптом?
- Долгая сессия модуля vs TTL `access_token` (15 мин) — см. риск в разделе
  «Аутентификация»; на MVP не решаем, помечено остаточным.
- Формат `PracticalModule.configuration.catalogEndpoint` — прямой URL до
  `SqlModule.Web` внутри docker-сети или через тот же nginx?

## План работ (черновик, до утверждения)

Раздел `Phase 7 — Подключение практических модулей` в `MIGRATION_KANBAN.md`,
серия `MOD-`. Порядок: контракт Education (спека) → Kafka в dev → Education backend →
platform-web (реестр/привязка/запуск/возврат) → sql-module-web `/launch` + embedded →
SqlModule.Web Kafka-producer → сквозной smoke на SQL-модуле.
