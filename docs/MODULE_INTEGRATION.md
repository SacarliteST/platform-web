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
| Размещение UI модуля | **Тот же origin, под путём** — `/<platform>/modules/<slug>/…`, единый реверс-прокси заводит SPA модуля внутрь платформы. |
| Переход в модуль | **Замена вкладки** — `window.location.assign(launchUrl)`. |
| Возврат | Модуль по завершении редиректит на **`return_url`** платформы (origin платформы, собирает ядро). Страница практики поллит статус сессии. |
| Шина событий | **Kafka** (не SignalR). Модуль — producer, `Education` — consumer. |
| Оценка | **Ставит модуль**, не ядро. Completion несёт готовую `grade` (2–5); ядро её только хранит. |
| Заданий на практику | **1:1** — одна внешняя практика ↔ одно задание модуля (MVP). |
| Просмотр «цифрового следа» | **Постфактум**, без живого пуша. |
| Каталог заданий модуля | Выбор из списка (новая ручка у модуля, ядро проксирует), не ручной ввод. |
| Реверс-прокси | **Единый nginx** перед всем. |
| Аутентификация UI модуля к своему API | **Token Exchange через IdentityService** — модуль получает токен со своей собственной `audience`, не токен платформы (см. раздел «Аутентификация»). |
| Повторные попытки | **Есть**, по образцу внутреннего теста: `triesCount`, попытка списывается **на старте** (включая `EXPIRED`), итоговая оценка — **лучшая из завершённых** (`MAX(grade)`). |

## Полный путь, целиком

```
══ 0. ГЕЙТ ПЕРЕД ЗАПУСКОМ ═══════════════════════════════════════════════════
Студент открывает страницу практики (kind=external).
platform-web: GET /practicals/{id}/module-sessions/current
  ├─ нет сессии / последняя EXPIRED, attemptsCount < triesCount
  │    → «Начать» активна, «Попытка N из triesCount»
  ├─ есть сессия ACTIVE
  │    → «Начать» заблокирована, «Попытка обрабатывается»
  └─ attemptsCount >= triesCount (считая EXPIRED)
       → «Начать» заблокирована навсегда, «Попытки исчерпаны»,
         показана лучшая оценка из COMPLETED (если есть)

══ 1. ЗАПУСК ════════════════════════════════════════════════════════════════
Браузер (platform_token, aud=education-api)
  │ POST /practicals/{id}/module-sessions {taskId}   Bearer platform_token
  ▼
Education
  ├─ attemptsCount = COUNT(PracticalModuleSession WHERE user+task)   -- вкл. EXPIRED
  ├─ attemptsCount >= triesCount   → 409 «Попытки исчерпаны»
  ├─ есть ACTIVE сессия            → 409 «Попытка уже выполняется»
  ├─ создаёт PracticalModuleSession: status=ACTIVE, tryNumber=attemptsCount+1,
  │    startedAt=сейчас, launchToken (одноразовый, для attach)
  ├─ POST /api/v1/auth/token/exchange → IdentityService        [сервер-сервер]
  │    Authorization: Basic education_client_id:secret
  │    { subjectToken: platform_token, audience: "sql-module-api" }
  │  ← { accessToken: module_access_token, expiresIn: 1800 }
  ├─ собирает launchUrl (тот же origin):
  │    /modules/sql/launch
  │      ?session={sessionId}&task={externalTaskRef}
  │      &return_url={ENC(https://platform/…/practicals/{p}?session={sessionId})}
  │      &token={launchToken}
  │      #access_token={module_access_token}
  ▼
 200 { sessionId, launchUrl, expiresAt, tryNumber }
  ▼
Браузер: window.location.assign(launchUrl)   ← замена вкладки, попытка уже списана

══ 2. РАБОТА В МОДУЛЕ ═══════════════════════════════════════════════════════
sql-module-web (открылся на /modules/sql/launch?…)
  ├─ TokenProvider: handoff — читает module_access_token из #фрагмента
  │    → sessionStorage, чистит фрагмент (history.replaceState)
  ├─ POST /module-api/sql/attach {launchToken}
  ▼
SqlModule.Web
  ├─ POST /api/v1/module-sessions/{sessionId}/attach {launchToken} → Education
  │  ← { moduleToken, userId, taskRef, kafka: {...} }     (launchToken гасится)
  ├─ вызовы студента — Bearer module_access_token, Audience=sql-module-api
  ├─ каждая попытка → Kafka producer → scoodle.practice.events
  │    {sessionId, moduleToken, seq, eventType, payload}
  ▼
Education (Kafka consumer, фоново)
  └─ append PracticalTaskEvent, идемпотентно по (sessionId, seq)

… студент решает задачу …

SqlModule.Web (студент нажал «Сдать», модуль сам посчитал вердикт)
  └─ Kafka producer → scoodle.practice.completion
       {sessionId, moduleToken, status: "COMPLETED",
        grade: 5,   ← оценку ставит МОДУЛЬ
        finalScore, maxScore, completionData}
  ▼
Education (consumer, терминальный переход — только один раз)
  └─ PracticalModuleSession.status=COMPLETED, grade/score/completionData сохранены

══ 3. ВОЗВРАТ ════════════════════════════════════════════════════════════════
sql-module-web
  └─ window.location.assign(return_url)
       = https://platform/…/practicals/{p}?session={sessionId}
  ▼
Браузер: полная навигация обратно, тот же origin — platform_token в сторе платформы
         никуда не делся, повторный вход не нужен
  ▼
platform-web: страница практики видит ?session={sessionId}
  ├─ GET /practicals/{id}/module-sessions/{sessionId}   Bearer platform_token
  ├─ status ACTIVE     → поллинг раз в ~2с (гонка с Kafka), «Попытка обрабатывается»,
  │                       таймаут ~30–60с → «обрабатывается дольше обычного» + «Обновить»
  └─ status COMPLETED  → «Оценка: {grade}» (лучшая из всех COMPLETED — MAX(grade)
                          на вкладке «Оценка»), ссылка на протокол (постфактум)

Кнопка «Начать» на этой же странице — снова смотрит на шаг 0: если
attemptsCount < triesCount, можно начать ещё раз (новый tryNumber).
```

## Компоненты и зоны ответственности

| Компонент | Что делает нового |
|---|---|
| **IdentityService** (отдельный воркстрим — новая ответственность) | реестр клиентов (`Clients`, allow-list разрешённых `audience` на клиента); эндпоинт **Token Exchange** (`/api/v1/auth/token/exchange`), аутентификация клиента Basic client_id:secret |
| **Education** (бэкенд, моя зона — спека) | сущности `PracticalModule` (+ `identity_audience`, `configuration.catalogEndpoint`), `Practical.kind=external`, `PracticalModuleSession` (+ `try_number`), `PracticalTaskEvent`; admin-CRUD реестра; проксирование каталога заданий; привязка модуля (1:1) с `triesCount`; жизненный цикл сессии с гейтом попыток; вызов Token Exchange при выпуске `launchUrl`; **Kafka consumer** (события + completion с `grade` от модуля); best-of-N в `GetPracticalGrade` |
| **platform-web** (моя зона — реализация) | распознавание вида практики; гейт «Начать» по `current`-сессии + `triesCount`; кнопка «Начать» → `POST session` → `window.location = launchUrl`; страница возврата (`?session=` → поллинг → результат + протокол); UI преподавателя «привязать модуль + каталог + triesCount»; UI администратора для реестра модулей |
| **sql-module-web** (отдельный воркстрим) | маршрут `/launch`; новый `TokenProvider: handoff` (читает `access_token` из фрагмента, не JS-передача из `CONCEPT.md §5` — там расчёт на монтирование, у нас полная навигация); по завершении → `window.location = return_url` |
| **SqlModule.Web** (отдельный воркстрим) | приём `attach`; **ручка каталога заданий**; **Kafka producer** (события + completion с `grade`, которую вычисляет сам); `Authority`=IdentityService / `Audience=sql-module-api` — **собственная**, отличная от Education |
| **Инфраструктура** | Kafka в `Backend/compose.yaml`; единый nginx (`/`→platform-web, `/modules/sql/`→sql-module-web, `/module-api/sql/`→SqlModule.Web, `/api/v1/`→Education) |

## Модель данных (Education, новое)

```
PracticalModule
  id                uuid  PK
  slug              text  AK          -- "sql"
  name              text
  description       text
  practice_type     text                -- "SQL_SIMULATOR"
  base_path         text                -- "/modules/sql"
  identity_audience text                -- "sql-module-api" — для Token Exchange
  is_enabled        bool
  configuration     jsonb               -- catalogEndpoint и прочая специфика модуля

Practical (существующая) + kind text  -- "internal" | "external"
                          + tries_count int4  -- переиспользуется и для external

PracticalTask (существующая) + practical_module_id uuid null FK
                              + external_task_ref  text null

PracticalModuleSession
  id            uuid  PK
  practical_task_id  uuid FK
  user_id       uuid FK              -- Education User
  try_number    int4                 -- 1..triesCount
  status        text                 -- ACTIVE | COMPLETED | EXPIRED
  launch_token  text                 -- одноразовый, для attach
  module_token  text                 -- секрет Kafka, в браузер не уходит
  started_at    timestamptz
  completed_at  timestamptz null
  score         float8 null          -- метаданные модуля, для отображения
  max_score     float8 null          --   (оценку по ним ядро НЕ считает)
  grade         int4 null            -- присылает модуль, ядро только хранит
  completion_data jsonb null

PracticalTaskEvent
  id            uuid  PK
  session_id    uuid FK
  seq           int8
  event_type    text
  occurred_at   timestamptz
  data          jsonb
  intermediate_result jsonb null
  UNIQUE (session_id, seq)
```

Статусов три (не пять, как в первой версии дизайна) — `PENDING`/`ABANDONED` убраны:
переход по ссылке = попытка уже началась, поэтому сессия создаётся сразу в `ACTIVE`.

## Контракты

### 1. Реестр модулей — администратор (Education, `AdminOnly`)

```
GET    /api/v1/admin/practical-modules
POST   /api/v1/admin/practical-modules   { slug, name, description, practiceType,
                                            basePath, identityAudience, configuration }
PUT    /api/v1/admin/practical-modules/{id}
DELETE /api/v1/admin/practical-modules/{id}
```

### 2. Каталог заданий модуля — преподаватель (Education, `TeacherOnly`)

```
GET /api/v1/practical-modules/{practicalModuleId}/tasks
 200 [ { ref, name, description } ]
```

Ядро дёргает **сервер-сервер** ручку каталога у самого модуля
(`PracticalModule.configuration.catalogEndpoint`) и отдаёт нормализованный список —
браузер к API модуля напрямую не ходит.

### 3. Привязка модуля к практике — преподаватель (Education, `TeacherOnly`)

```
PUT /api/v1/practicals/{practicalId}/module
    { practicalModuleId, externalTaskRef, triesCount }
    -- переводит практику в kind=external, единственный PracticalTask (1:1, MVP)
```

`externalTaskRef` — из каталога §2. `triesCount` — тот же смысл, что у внутреннего
теста (`PracticalMaterial.TriesCount`).

### 4. Инициализация сессии — студент (Education, `StudentOnly`)

```
POST /api/v1/practicals/{practicalId}/module-sessions   { taskId }
 200 { sessionId, launchUrl, expiresAt, tryNumber }
 409 { reason: "TriesExhausted" }       -- attemptsCount (вкл. EXPIRED) >= triesCount
 409 { reason: "SessionActive" }        -- есть незавершённая ACTIVE сессия
```

`launchUrl` (тот же origin; query — для сессии, фрагмент — для токена доступа
модуля к своему API, см. «Аутентификация»):

```
/modules/sql/launch
  ?session={sessionId}
  &task={externalTaskRef}
  &return_url={ENC(https://<platform-origin>/student/courses/{c}/modules/{m}/practicals/{p}?session={sessionId})}
  &token={launchToken}        -- одноразовый, TTL ~10 мин, для attach; НЕ для вызовов API модуля
  #access_token={module_access_token}   -- фрагмент, не уходит на сервер/в логи
```

`return_url` собирает **ядро** из зарегистрированного origin платформы.

### 5. Статус сессии — студент (Education, `StudentOnly`)

```
GET /api/v1/practicals/{practicalId}/module-sessions/{sessionId}
 200 { status, tryNumber, score, maxScore, grade, startedAt, completedAt, eventCount }

GET /api/v1/practicals/{practicalId}/module-sessions/current
 200 { session: {...} | null, attemptsCount, triesCount, bestGrade }
    -- всегда используется для гейта «Начать», не только из return_url
```

### 6. Обмен launch-токена — бэкенд модуля → Education

```
POST /api/v1/module-sessions/{sessionId}/attach   { launchToken }
 200 { moduleToken, userId, taskRef, kafka: { bootstrap, eventsTopic, completionTopic } }
 401 — токен истёк / израсходован / не тот модуль
```

`moduleToken` — серверный секрет сессии, в каждом Kafka-сообщении, в браузер не
попадает. Это **не** тот токен, которым модуль ходит в свой API как пользователь.

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
  "payload": { "input_code": "SELECT * FROM orders WHERE user_id = 1",
               "execution_status": "SUCCESS", "rows_affected": 25 },
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

`grade` — обязательное поле, **ставит модуль**. Ядро оценку не пересчитывает.

Consumer ядра: проверяет `moduleToken`; события — append в `PracticalTaskEvent`
(идемпотентно по `(sessionId, seq)`); completion — статус `COMPLETED`, сохраняет
`grade`/`score`/`maxScore`/`completionData` как есть. Обрабатывается один раз
(терминальный переход).

### 8. Итоговая оценка практики (best-of-N)

Аналогично внутреннему тесту (`EfGradesRepository.GetPracticalGradeAsync`,
`testResults.Max(...)`):

```
GET /api/v1/practicals/{practicalId}/grade
 200 { grade: MAX(grade) по всем PracticalModuleSession.status=COMPLETED, messages }
```

Если ни одной `COMPLETED` сессии нет — `grade: null`, `messages: ["Пройдите практику"]`.

### 9. Возврат в платформу

Модуль по завершении: `window.location.assign(return_url)`. Страница практики
видит `?session=…`, поллит §5 каждые ~2с, пока `status` не терминальный
(таймаут ~30–60с → сообщение + ручное «Обновить»), затем показывает
`grade`/протокол. Пуш не нужен — событийность на стороне ядра.

## Аутентификация UI модуля (Token Exchange)

**Почему не «переиспользовать токен платформы как есть».** Токен, выданный
IdentityService, должен быть годен ровно для того сервиса, под который выписан
(`aud`), а не работать «универсальным ключом» по всей системе — если он утечёт
из вкладки модуля, не должен открывать API Education, и наоборот. Сейчас в
IdentityService такого разделения нет (`Backend/IdentityService/.../appsettings*.json`
— один глобальный `Jwt.Audience` на весь инстанс, никакого понятия клиента).
Значит нужен настоящий механизм per-service токенов, а не констатация
случайного совпадения аудиторий.

**Схема — Token Exchange (RFC 8693-стиль), выполняет ядро, сервер-сервер:**

1. У IdentityService появляется **реестр клиентов**:
   ```
   Clients
     client_id          text PK   -- "education-core"
     client_secret_hash text
     allowed_audiences  text[]    -- ["sql-module-api", …] — что клиенту можно запрашивать
   ```
   Один клиент — Education. Новый модуль = новая аудитория в allow-list, без нового кода.

2. Новый эндпоинт:
   ```
   POST /api/v1/auth/token/exchange
     Authorization: Basic base64(client_id:client_secret)
     { grantType: "token-exchange", subjectToken, audience }
    200 { accessToken, expiresIn }
    401 — клиент неизвестен / audience не в allow-list / subjectToken невалиден
   ```
   IdentityService: валидирует `subjectToken` как обычно, проверяет что клиент
   (`education-core`) вправе запрашивать `audience=sql-module-api`, минтит новый
   подписанный токен: тот же `sub`/роли, `aud=sql-module-api`, TTL короче обычного
   (напр. 30 мин — можно больше 15, т.к. аудитория узкая). Refresh-токен для него
   не выдаётся — он одноразовый по смыслу, живёт только на длительность сессии в модуле.

3. Education вызывает это при сборке `launchUrl` (шаг 1 «Полного пути»), кладёт
   результат в **фрагмент** `launchUrl` (не query — фрагмент не уходит на сервер
   и не попадает в access-логи nginx).

4. `sql-module-web` не может использовать готовый `TokenProvider: host-token` из
   своего `CONCEPT.md §5` — тот спроектирован для **JS-встраивания**
   (`mount(element, config)`, токен передаётся объектом в памяти того же процесса).
   Наш запуск — полная навигация, новый JS-контекст, объекта передать некому.
   Нужен новый вариант — **`handoff`**: читает `access_token` из `location.hash`
   на старте, кладёт в `sessionStorage`, сразу чистит фрагмент через
   `history.replaceState`. Дальше — как обычный Bearer, до истечения или до возврата.

5. `SqlModule.Web` продолжает валидировать JWT ровно как раньше (`Authority`/`Audience`
   из конфига, `WebExtensions.cs`) — просто `Audience` теперь **своя**
   (`sql-module-api`), а не совпадающая с Education по случайности.

**Что это даёт.** Токен из вкладки модуля физически не проходит против API
Education (другой `aud`) — и наоборot. Компрометация одной вкладки не даёт
доступа к другому сервису. Компрометация самого механизма exchange ограничена
allow-list'ом клиентов в IdentityService — только Education может попросить
`sql-module-api`-токен, и только потому что явно на это уполномочен.

**Остаточный риск.** Долгая сессия модуля может пережить TTL обменянного токена.
На MVP не решаем (TTL — компромиссный, крупнее обычного, т.к. риск утечки ниже
из-за узкой аудитории); на будущее — Education может хранить выданный при exchange
refresh и перевыпускать модульный токен по запросу через `moduleToken`
(`POST /module-sessions/{id}/refresh-token`), не трогая пользователя.

## Повторные попытки (по образцу внутреннего теста)

Скопировано с уже работающей политики `PracticalMaterial.CanStartAttempt` /
`EfTestResultsRepository.StartTestAsync` / `EfGradesRepository.GetPracticalGradeAsync`
(`testResults.Max(...)`) — единая механика попыток что для внутреннего теста, что
для внешнего модуля:

- Лимит — `Practical.triesCount`, задаёт преподаватель при привязке модуля (§3).
- **Списывается на старте**, не на завершении: `attemptsCount = COUNT(*)` всех
  `PracticalModuleSession` пользователя по практике, **включая `EXPIRED`** —
  как и во внутреннем тесте, обрыв/незавершение не даёт бесплатной попытки.
- Итоговая оценка практики — **`MAX(grade)`** по всем `COMPLETED`-сессиям (§8),
  не последняя и не средняя — так же, как `testResults.Max(...)` для теста.
- Отказ при исчерпании — `409` на `POST .../module-sessions`, тот же паттерн
  сообщения, что уже есть у внутреннего теста («Попытки исчерпаны»).

## Состояния сессии

```
(нет сессии) ──POST /module-sessions──▶ ACTIVE (startedAt=сейчас, tryNumber++)
                                            │
                Kafka: completion получена  │  TTL истёк (напр. 2ч без событий),
                и обработана                │  completion не пришла
                ▼                           ▼
            COMPLETED                    EXPIRED
        (терминально для ЭТОЙ           (терминально для ЭТОЙ попытки,
         попытки; новую можно            но НЕ освобождает лимит —
         начать, если остались           попытка всё равно списана,
         попытки)                        см. «Повторные попытки»)
```

Гейт на `POST /module-sessions` и на UI кнопки «Начать» — всегда через
`GET .../module-sessions/current` (§5), а не только через `?session=` из
`return_url` — работает одинаково и сразу после честного возврата, и если
студент просто открыл страницу практики заново, и если нажал «назад» в модуле:
пока последняя попытка `ACTIVE`, новую начать нельзя ни при каких условиях
(сервер, не клиентское состояние).

## Безопасность

- `launchToken` — одноразовый, короткоживущий, привязан к `sessionId+userId+taskRef`,
  гасится при `attach`. В URL (query) — допустимо (TTL мал, single-use), не логировать.
- `module_access_token` — выпускается Token Exchange специально под
  `sql-module-api`, короче обычного TTL; передаётся во **фрагменте** URL;
  вычищается модулем через `history.replaceState`; бесполезен против API Education.
- `moduleToken` — только сервер↔сервер, в каждом Kafka-сообщении, никогда в браузер.
- `return_url` строит ядро из зарегистрированного origin платформы; модуль не влияет.
- Kafka — SASL/ACL: producer-права на `scoodle.practice.*` только у сервис-аккаунта
  модуля; ядро — только consumer.
- Token Exchange — только зарегистрированные клиенты (Basic client_id:secret),
  только разрешённые для клиента `audience` (allow-list, не произвольная строка).
- Сессия одноразовая: повторный `attach` или `completion` по завершённой сессии — 409/ignore.
- Тот же origin → CSRF-поверхность общая с платформой; формы модуля защищены как обычно.

## Закрытые вопросы (решения владельца, 2026-09-03)

1. Оценку ставит **модуль** (§7, `grade` обязательное поле в completion).
2. Заданий на практику — **1:1** (MVP).
3. Цифровой след — **постфактум**, без живого пуша.
4. Каталог заданий модуля — **выбор из списка** (§2), у модуля новая ручка.
5. Аутентификация — **Token Exchange через IdentityService**, а не переиспользование
   токена платформы как есть (см. «Аутентификация UI модуля» выше — это финальная
   версия, отменяет более раннюю идею «просто передать существующий токен»).
6. Реверс-прокси — **единый nginx**.
7. Повторные попытки — **есть**, `triesCount` списывается на старте (вкл. `EXPIRED`),
   оценка — `MAX(grade)` по завершённым, по образцу внутреннего теста.

## Закрыто в MOD-003

- **Kafka в dev** — явный init-скрипт (`kafka-init` в `Backend/compose.yaml`, пред-создаёт
  оба топика с 3 партициями) **плюс** `AUTO_CREATE_TOPICS=true` — на одном брокере иначе не
  создаётся внутренний `__consumer_offsets`, и любая consumer-группа виснет с
  `COORDINATOR_NOT_AVAILABLE` без единой ошибки на стороне продюсера. Проверено на реальном
  контейнере (продюсер репортит успех, консьюмер молча ничего не читает — нашли только
  включив debug-лог консьюмера).
- Абстракции вынесены в отдельный проект `Education/src/Education.Kafka` — не зависит от
  `Education.Domain`/`Education.Application`, чтобы контракты сообщений и обёртки над
  `Confluent.Kafka` были переносимы (при появлении общего NuGet-фида между репозиториями —
  без переписывания).

## Остаточные вопросы (не блокируют `MOD-002`, решить по ходу реализации)

- Долгая сессия модуля vs TTL обменянного токена — см. «Аутентификация», не блокер.
- Формат `PracticalModule.configuration.catalogEndpoint` — прямой URL до
  `SqlModule.Web` внутри docker-сети или через тот же nginx?
- TTL сессии до `EXPIRED` (перегиб между «дать доработать» и «не висеть вечно») —
  предварительно ~2 часа без событий, подтвердить при реализации `MOD-007`.

## План работ

Раздел `Phase 7 — Подключение практических модулей` в `MIGRATION_KANBAN.md`,
серия `MOD-`. Порядок: контракт Education (спека) → IdentityService (Token
Exchange) → Kafka в dev → Education backend → platform-web → sql-module-web →
SqlModule.Web → сквозной smoke.
