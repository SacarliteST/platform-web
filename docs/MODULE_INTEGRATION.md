# Подключение практических модулей (Host–Plugin, редирект)

Механизм подключения внешних модулей отработки навыков к платформе Scoodle.
Пилот — **SQL-модуль** (`Backend/SqlModule` + `Frontend/sql-module-web`).

Статус: **концепт пересмотрен 2026-09-05, к реализации не приступали.** Основа —
курсовая («Хост–Плагин», EDA): ядро `Education` — диспетчер, модули —
самостоятельные единицы; «цифровой след» течёт в ядро отдельным каналом.

> Эта редакция заменяет более раннюю схему (`attach`-релей, оценка через Kafka,
> отдельный `moduleToken`, `seq`, claim `module_session_required`). Что и почему
> поменялось — в конце, раздел «Отличия от первой редакции».

---

## Две задачи доверия — всё остальное обвязка для них

Между платформой и модулем есть ровно две вещи, которые нужно защитить. Разберёшь
их — понятен весь механизм.

### Доверие 1: модуль верит «это студент X»

Написать имя в ссылке нельзя — подделают. Наш IdentityService выдаёт подписанный
токен: «это X, роли такие-то, токен для SQL-тренажёра (`aud=sql-module-api`)».
Модуль проверяет подпись — и всё. Токен едет в браузере, в части URL после `#`
(фрагмент не уходит на серверы и не пишется в логи).

### Доверие 2: платформа верит «эта оценка и этот лог — правда от сессии S»

Оценка и события действий идут в платформу отдельно от браузера. Кто угодно, кто
дотянется до канала, мог бы написать «X получил 100». Значит каждое сообщение
несёт **ключ сессии** — случайный секрет, который:

- платформа придумывает при создании сессии;
- платформа отдаёт бэкенду модуля **напрямую, сервер-серверу** (в браузер не
  попадает → не утечёт);
- модуль вставляет в каждое Kafka-событие и в HTTP-запрос с оценкой;
- платформа сверяет: ключ совпал с тем, что я выдала для сессии? Нет — выбрасываю.

Никакого рукопожатия, никакого обратного `attach`.

---

## Словарь — 4 слова

| Слово | Что | Кто создаёт | Где ходит |
|---|---|---|---|
| **`module_access_token`** | JWT логина студента: `aud=sql-module-api`, `sub`=студент, claim `session_id` | IdentityService (Token Exchange, зовёт Education) | Education → фрагмент `launchUrl` → `sessionStorage` модуля → в каждом вызове API модуля |
| **ключ сессии** (`session_key`) | случайный секрет сессии: подпись Kafka-событий + аутентификация HTTP-оценки | Education | Education → бэкенд модуля напрямую (пуш) → БД модуля → в каждом сообщении/оценке. **Никогда в браузер** |
| **`sessionId`** | Guid = `PracticalModuleSession.Id`, просто имя сессии | Education | у всех: query-параметр, ключ Kafka, ключ поллинга |
| **`serviceKey`** | статический общий пароль Education↔модуль для прямых вызовов (каталог, пуш, оценка) | задан в secret-конфиге обоих | только прямые сервер-сервер вызовы, не в браузере |

Идентификаторы заданий: `externalTaskRef` — непрозрачная строка модуля (для
SQL-модуля = `SqlTask.Id`), платформа хранит и передаёт как есть.

---

## Полный путь (happy path)

```
0. ГЕЙТ
   platform-web: GET /practicals/{id}/module-sessions/current
     нет ACTIVE-сессии, attemptsCount < triesCount  → «Начать»
     есть ACTIVE-сессия (не истекла)                → «Продолжить» + «Прервать»
     attemptsCount >= triesCount                    → заблокировано, лучшая оценка

1. ЗАПУСК
   browser → Education: POST /practicals/{id}/module-sessions { taskId }   Bearer platform_token
   Education:
     - лениво истекает старую ACTIVE-сессию, если её expiresAt прошёл
     - если ACTIVE-сессия жива → это ПРОДОЛЖЕНИЕ (не новая, tryNumber и startedAt не трогаются)
     - иначе: attemptsCount (вкл. EXPIRED) >= triesCount → 409 TriesExhausted;
              создаёт PracticalModuleSession: ACTIVE, tryNumber++, startedAt=сейчас,
              expiresAt = startedAt + timeLimitMinutes (или null), генерит session_key,
              строит return_url и сохраняет на сессии
     - ПУШ → модуль (сервер-сервер, X-Service-Key):
         POST {module}/module-integration/sessions
         { sessionId, sessionKey, userId, taskRef, returnUrl, expiresAt }
       модуль делает upsert локальной ModuleSession; Education ретраит до 2xx
       (модуль недоступен → весь запуск 409/502, студент остаётся на платформе)
     - Token Exchange → IdentityService:
         { subjectToken: platform_token, audience: "sql-module-api", sessionId }
       ← module_access_token  (внутри claim session_id)
     - 200 { sessionId, launchUrl, expiresAt, tryNumber, resumed }
   launchUrl = {origin}/modules/sql/launch?session={sessionId}#access_token={module_access_token}
   ── в query только sessionId; секрет (токен) во фрагменте; ключ сессии в URL НЕ входит ──
   browser: window.location.assign(launchUrl)

2. РАБОТА В МОДУЛЕ
   sql-module-web на /launch:
     - #access_token → sessionStorage, сразу history.replaceState (чистит фрагмент)
     - GET /module-integration/sessions/current   Bearer module_access_token
       ← { taskId, returnUrl }   ← канонические значения из того, что запушил Education
     - navigate → /student/tasks/{taskId};  sessionId держит в контексте вкладки

   студент решает:
     POST /training/attempts/submit { taskId, submittedSql }   Bearer module_access_token
       (сессия берётся из claim session_id в токене — заголовок не нужен)
     модуль:
       - сохраняет Attempt (как сейчас, синхронная проверка)
       - кладёт в таблицу pending_publish строку события
       - если IsCorrect и сессия ещё ACTIVE:
           кладёт в pending_publish строку «оценка», ModuleSession → COMPLETED
     фоновый publisher разгребает pending_publish:
       - события → Kafka scoodle.practice.events
       - оценка → HTTP POST {education}/module-sessions/{S}/complete
       - retry после сбоя/рестарта, пока не подтвердится

   Education:
     - Kafka consumer: INSERT PracticalTaskEvent ON CONFLICT (eventId) DO NOTHING → лента
     - POST /complete: сверяет sessionKey, ACTIVE → COMPLETED, grade сохранён как есть,
       идемпотентно (повтор → 200 без изменений; не ACTIVE → 409)

3. ВОЗВРАТ
   sql-module-web: по завершению → window.location.assign(returnUrl)   (из шага 2, не из URL)
   platform-web: видит ?session={sessionId} → GET /module-sessions/{sessionId}
     COMPLETED → сразу показывает grade + ссылку на протокол
     ACTIVE    → «обрабатывается» (оценка ещё едет по HTTP-ретраю), обновление раз в ~2с
```

`module_access_token` в браузере — единственный секрет, который туда попадает.
Ключ сессии идёт мимо браузера. Оценка — по HTTP при завершении, **не** через
Kafka. Kafka — только лог действий.

---

## Модель сбоев

### Два разных таймера — не путать

| Таймер | Значение (MVP) | Отсчёт от | Кто следит |
|---|---|---|---|
| Свежесть `module_access_token` | ~5 мин | выдача токена | IdentityService. Протух → мёртвая страница, студент возвращается на платформу и жмёт «Продолжить» |
| Время на попытку | **задаёт преподаватель** (`timeLimitMinutes`, или без лимита) | `startedAt` | Education. Модуль показывает отсчёт, но авторитет — Education |

Экспирации по бездействию нет. При «без лимита» действует жёсткий потолок **24 ч**
на любую `ACTIVE`-сессию — это сборка мусора, не «время на задание».

### Состояния

```
клик «Начать»
  → сессия S = ACTIVE, tryNumber++, ПОПЫТКА СПИСАНА, startedAt=сейчас,
    expiresAt = startedAt + timeLimitMinutes (или null)
  → пуш модулю, Token Exchange, редирект

из ACTIVE:
  ├─ пришёл HTTP /complete            → COMPLETED  (endReason=completed)
  ├─ now > expiresAt (если задан)     → EXPIRED    (endReason=timeout, лениво при чтении статуса)
  ├─ now > startedAt + 24ч            → EXPIRED    (endReason=timeout, потолок-GC)
  ├─ клик «Прервать попытку»          → EXPIRED    (endReason=abandoned, сразу)
  └─ закрыл модуль / нажал «Назад»    → всё ещё ACTIVE (платформе не сообщили)
        практика: «Попытка выполняется» + «Продолжить» + «Прервать»

конец (COMPLETED / EXPIRED):
  attemptsCount < triesCount  → «Начать» (новая сессия, новый tryNumber)
  attemptsCount >= triesCount → заблокировано, «Попытки исчерпаны», лучшая оценка
```

Состояния три. `endReason` (`completed | timeout | abandoned`) — только для текста
в UI, на логику не влияет.

**Правило:** попытка списывается в момент «Начать», не при завершении. Закрыл
модуль, ушёл назад, вышло время, прервал — бесплатной попытки не даёт. Как
внутренний тест (`EfTestResultsRepository.StartTestAsync` считает строку на старте).

### Продолжение попытки (идемпотентно)

`ACTIVE`-сессию можно переоткрывать сколько угодно, не создавая новую и не тратя
попытку. `POST /module-sessions` при живой `ACTIVE`-сессии того же студента по
тому же заданию — это **не** `409`, а продолжение:

- сессия S остаётся, `tryNumber` не растёт, `startedAt`/`expiresAt` не трогаются
  (продолжение не докупает время);
- Education заново пушит модулю ту же `{ sessionId, sessionKey, … }` — модуль
  обрабатывает как upsert (есть S — обновил, нет — вставил);
- Education заново делает Token Exchange (свежий `module_access_token`, снова ~5 мин);
- возвращает тот же `launchUrl`, `resumed: true`.

Жать «Продолжить» можно многократно — каждый клик просто перевыпускает токен и
редиректит. Ограничения: только пока `ACTIVE` и не истекла, только владелец
(`sub` токена == `user_id` сессии).

### Идемпотентность оценки

`POST /module-sessions/{S}/complete` у модуля может уйти повторно (его фоновый
publisher ретраит). Education: первый вызов ставит `COMPLETED` + `grade`, отвечает
`200`. Повтор — видит «уже `COMPLETED`» → `200`, тело игнорирует, оценку не
перезаписывает (чтобы модуль перестал ретраить). Сессия уже `EXPIRED` →
`409`, поздняя оценка не принимается (студент не выиграет, подкрутив часы в модуле).

### Потеря Kafka-события

Событие потерялось/опоздало → дырка в ленте цифрового следа, **на оценку не
влияет** (оценка идёт по отдельному надёжному HTTP-каналу с ретраем). Дедуп при
переигрывании — по `eventId`.

---

## Принятые решения

| Вопрос | Решение |
|---|---|
| Размещение UI модуля | Тот же origin, под путём `/modules/<slug>/…`, единый nginx перед всем |
| Переход в модуль | Замена вкладки, `window.location.assign(launchUrl)` |
| Возврат | Модуль редиректит на `return_url` (строит Education, отдаёт модулю в пуше). Страница практики читает статус |
| Оценка | **HTTP-запрос модуль → Education при завершении**, не Kafka. Оценку ставит модуль (`grade` 0–100), ядро только хранит |
| Цифровой след | **Только Kafka, только лог.** Событие = что модуль сам счёл действием; ядро не разбирает содержимое, копит ленту постфактум |
| Заданий на практику | 1:1 (MVP) |
| Каталог заданий | Выбор из списка (ручка у модуля, Education проксирует), не ручной ввод |
| Аутентификация UI модуля | Token Exchange через IdentityService, `aud=sql-module-api` + claim `session_id` |
| Повторные попытки | `triesCount` (преподаватель), списывается на старте (вкл. `EXPIRED`), итог — `MAX(grade)` по `COMPLETED` |
| Время на попытку | `timeLimitMinutes` задаёт преподаватель при привязке (или без лимита + потолок 24 ч) |
| Прерывание | Кнопка «Прервать попытку» → сессия `EXPIRED`, попытка засчитана |
| Связь модуля с платформой | Education **пушит** сессию модулю при старте (сервер-сервер), обратного `attach` нет |
| Секрет сессии | Один `session_key`: и подпись Kafka, и аутентификация `/complete`. В браузер не уходит |
| standalone-режим модуля | Постоянный обязательный режим. Пока **два deployment-профиля** (`platform` / `standalone`, разные конфиги, один билд); переход на общий инстанс — позже |

---

## Компоненты и зоны ответственности

| Компонент | Что делает нового |
|---|---|
| **IdentityService** (отдельный воркстрим) | реестр клиентов + Token Exchange (`/api/v1/auth/token/exchange`, Basic client_id:secret); в exchange-токен добавляется claim `session_id` из параметра запроса |
| **Education** (бэкенд, спека — `2026-09-04-practical-modules.md`) | `PracticalModule` (реестр), `Practical.kind=external` + `triesCount` + `timeLimitMinutes`, `PracticalModuleSession` (+ `expiresAt`, `endReason`, `session_key`, `return_url`), `PracticalTaskEvent` (дедуп по `eventId`); admin-CRUD реестра; прокси каталога; привязка модуля 1:1; жизненный цикл сессии + гейт попыток + продолжение + `abandon`; **пуш сессии модулю** при старте; Token Exchange при старте; `POST /module-sessions/{id}/complete` (приём оценки); **Kafka consumer** (только события → лента); best-of-N |
| **platform-web** (реализация) | вид практики; гейт «Начать»/«Продолжить»/«Прервать» по `current`; кнопки → `POST session` → `window.location = launchUrl`; страница возврата (`?session=` → статус → grade/протокол); UI преподавателя (привязать модуль + каталог + `triesCount` + `timeLimitMinutes`); UI администратора реестра |
| **sql-module-web** (отдельный воркстрим — `2026-09-05-sql-module-integration.md`) | маршрут `/launch`; `TokenProvider: handoff` (`sessionStorage`, без refresh) + абстракция источника токена в HTTP-слое; контекст активного запуска; по завершению → `window.location = returnUrl` |
| **SqlModule** (бэкенд — тот же handoff-док) | ручка каталога (`X-Service-Key`); приём пуша `POST /module-integration/sessions` (upsert); `GET /module-integration/sessions/current`; локальные `ModuleSession` + `pending_publish`; фоновый publisher (события → Kafka, оценка → HTTP `/complete`); `Auth:Audience=sql-module-api` (профиль `platform`) |
| **Инфраструктура** | Kafka в `Backend/compose.yaml` (один топик задействован); единый nginx (`/`→platform-web, `/modules/sql/`→sql-module-web, `/module-api/sql/`→SqlModule, `/api/v1/`→Education) |

---

## Модель данных (Education, новое)

```
PracticalModule
  id                uuid PK
  slug              text AK          -- "sql"
  name / description text
  practice_type     text            -- "SQL_SIMULATOR"
  base_path         text            -- "/modules/sql"
  identity_audience text            -- "sql-module-api" — для Token Exchange
  is_enabled        bool
  configuration     jsonb           -- catalogEndpoint и прочее; СЕКРЕТОВ тут нет (отдаётся admin-API)

Practical (существующая)
  + kind               text        -- "internal" (дефолт) | "external"
  + tries_count        int4
  + time_limit_minutes int4 null    -- задаёт преподаватель; null = без лимита (потолок 24ч)

PracticalTask (существующая)
  + practical_module_id uuid null FK
  + external_task_ref   text null

PracticalModuleSession
  id              uuid PK
  practical_task_id uuid FK
  user_id         uuid FK
  try_number      int4
  status          text            -- ACTIVE | COMPLETED | EXPIRED
  end_reason      text null       -- completed | timeout | abandoned
  session_key     text            -- секрет: подпись Kafka + аутентификация /complete; в браузер не уходит
  return_url      text            -- собран ядром при старте, уходит модулю в пуше
  started_at      timestamptz
  expires_at      timestamptz null
  completed_at    timestamptz null
  grade           int4 null       -- 0..100, ставит модуль
  completion_data jsonb null

PracticalTaskEvent
  id           uuid PK            -- = eventId от модуля (дедуп)
  session_id   uuid FK
  kind         text               -- произвольная строка модуля, ядро не разбирает
  occurred_at  timestamptz
  payload      jsonb
```

`serviceKey` для каждого модуля — в secret-конфиге Education по slug'у
(напр. `PracticalModules:sql:ServiceKey`), **не** в колонке `configuration`
(её возвращает admin-API).

---

## Контракты

### 1. Реестр модулей — администратор (Education, `AdminOnly`)

```
GET/POST/PUT/DELETE /api/v1/admin/practical-modules
  POST { slug, name, description, practiceType, basePath, identityAudience, configuration }
```

Реализовано в `MOD-004`.

### 2. Каталог заданий модуля — преподаватель (Education, `TeacherOnly`)

```
GET /api/v1/practical-modules/{practicalModuleId}/tasks   → 200 [ { ref, name, description } ]
```

Education дёргает **сервер-сервер** ручку каталога модуля
(`configuration.catalogEndpoint`, заголовок `X-Service-Key`), нормализует, отдаёт.
Браузер к API модуля не ходит. Таймаут 2–3 с, недоступен → `502`.

### 3. Привязка модуля к практике — преподаватель (Education, `TeacherOnly`)

```
PUT /api/v1/practicals/{practicalId}/module
    { practicalModuleId, externalTaskRef, triesCount, timeLimitMinutes }
```

Переводит практику в `kind=external`, создаёт единственный `PracticalTask` (1:1).
`externalTaskRef` — из каталога §2. `timeLimitMinutes` — положительное число или
`null`. Смена значения при живой сессии на неё не влияет (`expiresAt` заморожен
при старте).

### 4. Старт / продолжение сессии — студент (Education, `StudentOnly`)

```
POST /api/v1/practicals/{practicalId}/module-sessions   { taskId }
 200 { sessionId, launchUrl, expiresAt, tryNumber, resumed }
 409 { reason: "TriesExhausted" }   -- attemptsCount (вкл. EXPIRED) >= triesCount
 502 { reason: "ModuleUnavailable" } -- пуш в модуль не прошёл
```

Логика:
1. Есть `ACTIVE`-сессия студента по заданию и `now <= expiresAt` → **продолжение**:
   re-пуш модулю, новый Token Exchange, вернуть её `launchUrl`, `resumed: true`.
   `tryNumber`/`startedAt`/`expiresAt` не меняются.
2. Есть `ACTIVE`, но `now > expiresAt` → пометить `EXPIRED` и идти в п.3.
3. `attemptsCount = COUNT(PracticalModuleSession по user+task, включая EXPIRED)`;
   `>= triesCount` → `409`.
4. Создать сессию `ACTIVE`, `tryNumber = attemptsCount + 1`, `startedAt = now`,
   `expiresAt = timeLimitMinutes ? now + timeLimitMinutes : null`, `session_key`,
   `return_url` (из зарегистрированного origin платформы — не из заголовков запроса).
5. Пуш модулю (§6). Не 2xx после ретраев → `502`, сессия помечается `EXPIRED`
   (`endReason=timeout`), попытка НЕ возвращается (или: не создавать до успешного
   пуша — предпочтительно, тогда попытка не тратится; решить при реализации).
6. Token Exchange (§ «Аутентификация»), `sessionId` в параметрах.
7. Вернуть `launchUrl = {origin}/modules/{slug}/launch?session={sessionId}#access_token={token}`.

### 5. Статус сессии — студент (Education, `StudentOnly`)

```
GET /api/v1/practicals/{practicalId}/module-sessions/{sessionId}
 200 { status, tryNumber, startedAt, expiresAt, endReason, grade, completedAt, eventCount }

GET /api/v1/practicals/{practicalId}/module-sessions/current
 200 { session: { sessionId, status, tryNumber, startedAt, expiresAt, endReason, grade } | null,
       attemptsCount, triesCount, timeLimitMinutes, bestGrade }
```

`current` — единственный источник для гейта кнопок (не `?session=` из `return_url`):
- `session` `ACTIVE` и `now <= expiresAt` → «Продолжить» + «Прервать»;
- иначе `attemptsCount < triesCount` → «Начать»;
- иначе → заблокировано, показать `bestGrade`.

Чтение `current`/`{sessionId}` лениво истекает просроченную `ACTIVE`-сессию.

### 6. Пуш сессии в модуль — Education → бэкенд модуля (сервер-сервер)

```
POST {module}/module-integration/sessions
  X-Service-Key: <serviceKey>
  { sessionId, sessionKey, userId, taskRef, returnUrl, expiresAt }
 200  -- upsert выполнен
```

Модуль: если строки с `sessionId` нет — вставляет; если есть — обновляет (это же
используется для продолжения попытки). Идемпотентно. Education ретраит до `2xx`
ограниченно (в рамках запроса студента, ~2–3 быстрые попытки).

### 7. Оценка — бэкенд модуля → Education (сервер-сервер, HTTP)

```
POST /api/v1/module-sessions/{sessionId}/complete
  X-Service-Key: <serviceKey>
  { sessionKey, grade, completionData, completedAt }
 200  -- ACTIVE → COMPLETED, grade сохранён; либо уже COMPLETED → 200 (no-op)
 409  -- сессия не ACTIVE (EXPIRED/abandoned) — оценка отклонена
 401  -- serviceKey или sessionKey не совпал
```

`grade` — 0..100, ставит модуль, ядро не пересчитывает. Модуль ретраит до `200`
(или `409` — тогда прекращает: сессия закрыта не в его пользу).

### 8. Цифровой след — модуль (producer) → Education (consumer), Kafka

Топик `scoodle.practice.events`, key = `sessionId`. **Только лог, ничего
терминального.**

```json
{
  "sessionId": "88e73f-…",
  "sessionKey": "…секрет сессии…",
  "eventId": "uuid — дедуп",
  "kind": "sql_submit",
  "occurredAt": "2026-09-05T10:15:30Z",
  "payload": { "submittedSql": "SELECT …", "status": "SUCCESS", "isCorrect": false }
}
```

- `kind` — произвольная строка модуля (`sql_submit`, `sql_run`, `hint_open`, …),
  Education её не перечисляет и не интерпретирует.
- `payload` — любой JSON, Education хранит как есть, показывает лентой на странице
  практики постфактум.
- Consumer: сверяет `sessionKey`; `INSERT PracticalTaskEvent ON CONFLICT (id) DO
  NOTHING`; события по сессии в терминальном статусе — отбрасывает.

### 9. Прерывание попытки — студент (Education, `StudentOnly`)

```
POST /api/v1/practicals/{practicalId}/module-sessions/{sessionId}/abandon
 200  -- ACTIVE → EXPIRED, endReason=abandoned
 409  -- сессия уже терминальна
```

Модулю не сообщается: если студент дорешает в другой вкладке, его `/complete`
упрётся в `409` (§7).

### 10. Возврат

Модуль по завершению: `window.location.assign(returnUrl)` (значение из §6/`current`,
не из URL). Страница практики видит `?session=` → §5:
- `COMPLETED` → сразу `grade` + протокол;
- `ACTIVE` → «обрабатывается», обновление раз в ~2с (оценка ещё в HTTP-ретрае у
  модуля), таймаут ~30–60с → «дольше обычного» + «Обновить».

### 11. Итоговая оценка практики (best-of-N)

```
GET /api/v1/practicals/{practicalId}/grade
 200 { grade: MAX(grade) по PracticalModuleSession.status=COMPLETED, messages }
```

Нет ни одной `COMPLETED` → `grade: null`, `messages: ["Пройдите практику"]`.
Как `EfGradesRepository.GetPracticalGradeAsync` для внутреннего теста.

---

## Аутентификация UI модуля (Token Exchange)

**Почему не «переиспользовать токен платформы».** Токен IdentityService должен
быть годен ровно для сервиса, под который выписан (`aud`), а не быть
«универсальным ключом»: утёк из вкладки модуля — не должен открывать API
Education, и наоборот. Сейчас в IdentityService разделения нет (один глобальный
`Jwt.Audience`).

**Схема (RFC 8693-стиль), выполняет Education, сервер-сервер:**

1. Реестр клиентов в IdentityService: `client_id` (`education-core`),
   `client_secret_hash`, `allowed_audiences text[]` (`["sql-module-api"]`).
   Новый модуль = новая аудитория в allow-list, без кода. **Реализовано в
   `MOD-002a/b`.**
2. Эндпоинт:
   ```
   POST /api/v1/auth/token/exchange
     Authorization: Basic base64(client_id:client_secret)
     { grantType: "token-exchange", subjectToken, audience, sessionId }
    200 { accessToken, expiresIn }
   ```
   IdentityService валидирует `subjectToken`, проверяет право клиента на
   `audience`, минтит токен: тот же `sub`/роли, `aud=sql-module-api`, **claim
   `session_id` = переданный `sessionId`**, TTL ~5 мин, без refresh.
3. Education зовёт это на шаге 4.6 «Полного пути», кладёт результат во **фрагмент**
   `launchUrl`.
4. `sql-module-web` использует `TokenProvider: handoff` — читает `access_token`
   из `location.hash`, кладёт в `sessionStorage`, чистит фрагмент через
   `history.replaceState`. Без auto-refresh.
5. `SqlModule` (профиль `platform`) валидирует JWT как раньше, но `Audience` —
   **своя** (`sql-module-api`). Сессию берёт из claim `session_id` — заголовок
   `X-Module-Session-Id` не нужен.

**Что даёт.** Токен из вкладки модуля не проходит против API Education (другой
`aud`) и привязан к одной сессии (claim). Компрометация вкладки не даёт доступа
ни к другому сервису, ни к другой сессии.

**Остаточный риск.** Длинная сессия модуля может пережить TTL токена. На MVP не
решаем (истёк — студент жмёт «Продолжить», получает свежий токен на ту же сессию).

---

## Безопасность

- `module_access_token` — во фрагменте URL, короткий TTL, привязан к `aud` и
  `session_id`; модуль чистит фрагмент; бесполезен против API Education.
- `session_key` — только сервер↔сервер, в каждом Kafka-сообщении и в `/complete`,
  никогда в браузер. Хранение у модуля — с redaction в логах/ProblemDetails/
  telemetry (шифрование в БД — tech-debt, не MVP).
- `serviceKey` — статический, в secret-конфиге Education и модуля; не в
  `PracticalModule.configuration`; admin-API его не возвращает.
- `return_url` строит Education из зарегистрированного origin; модуль на него не
  влияет; `/launch` не редиректит по недоверенному параметру.
- Kafka — producer-права на `scoodle.practice.*` только у сервис-аккаунта модуля;
  Education — только consumer.
- Оценку студент подделать не может: `grade` идёт от бэкенда модуля с `session_key`
  и `serviceKey`, ни один из которых не был в его браузере; Kafka из браузера
  недоступна.
- Сессия одноразовая: повторный `/complete` по завершённой — `200`/`409`, оценка
  не переписывается.

---

## Открытые вопросы (не блокируют, решить по ходу)

- Формат `configuration.catalogEndpoint`/`sessionsEndpoint` — прямой URL до модуля
  в docker-сети или через тот же nginx.
- Точное `timeLimitMinutes` по умолчанию в UI преподавателя (предложить ~120).
- `return_url` строится по `{origin}/student/practicals/{practicalId}` — а страница
  практики platform-web вложена в `/student/courses/:c/modules/:m/practicals/:p`.
  Нужен плоский redirect-маршрут в platform-web либо `courseId/moduleId` в шаблоне
  (join в `MOD-007`).

## Закрыто при реализации

- **Тратится ли попытка при неудачном пуше в модуль** — нет. `MOD-007` создаёт
  `PracticalModuleSession` **после** успешного пуша; `502 ModuleUnavailable` не
  жжёт попытку. Подтверждено тестом `Start_ModuleUnavailable_Returns502_AndDoesNotBurnTry`.

## Закрыто в MOD-003

- Kafka в dev: `kafka-init` пред-создаёт топики + `AUTO_CREATE_TOPICS=true`
  (на одном брокере иначе не создаётся `__consumer_offsets`, consumer-группа виснет
  с `COORDINATOR_NOT_AVAILABLE` молча — проверено на реальном контейнере).
- `Education/src/Education.Kafka` — только абстракции; контракты сообщений в
  `Education.Contracts/Kafka/`; конкретный consumer — в `Education.Application`
  (`MOD-008`). **Задействован один топик** — `scoodle.practice.events`; топик
  `scoodle.practice.completion` из первой редакции больше не нужен (оценка по HTTP).

---

## Отличия от первой редакции

| Было (редакция от 2026-09-04) | Стало |
|---|---|
| Модуль вызывает Education `attach`, получает секрет | Education **пушит** сессию модулю при старте |
| `launch_token` едет в браузере (фрагмент), гасится при attach | Нет `launch_token`: секрет (`session_key`) идёт пушем, в браузер не попадает |
| Отдельный `moduleToken` для Kafka | Один `session_key` на оба канала |
| Оценка через Kafka-топик `scoodle.practice.completion` | Оценка — HTTP `POST /module-sessions/{id}/complete` |
| Kafka: события + completion | Kafka: **только события** (лог) |
| `seq` — счётчик на сессию + транзакция ради него | `eventId` (uuid) на событие, дедуп по нему |
| claim `module_session_required` + заголовок `X-Module-Session-Id` | claim `session_id` в exchange-токене |
| `Idempotency-Key` на submit | Не нужен: `/complete` идемпотентен по состоянию сессии |
| Transactional outbox (как паттерн) | Таблица `pending_publish` + фоновый цикл (та же надёжность) |
| Поллинг статуса — основной путь возврата | Оценка записана до редиректа (HTTP); поллинг — редкий запасной путь |
| Время сессии ~2ч фиксировано | `timeLimitMinutes` задаёт преподаватель (или без лимита + потолок 24ч) |
| — | Кнопка «Прервать попытку» (`abandon` → `EXPIRED`) |
| — | Продолжение `ACTIVE`-сессии вместо `409 SessionActive` |

## План работ

Раздел `Phase 7` в `MIGRATION_KANBAN.md`, серия `MOD-`. Порядок: контракт
Education (спека) → IdentityService (Token Exchange + `session_id` claim) → Kafka в
dev → Education backend → platform-web → sql-module-web → SqlModule → сквозной smoke.
