# Backend/Frontend handoff — SQL-модуль как внешний практический модуль

Дата: 2026-09-05. **Статус: спека, к реализации не приступали.**
Проекты: `Backend/SqlModule` (`C:\Users\vladislav.bokovoi\SQLTren\Backend\SqlModule`,
API на `.NET`, minimal API + `IEndpoint`/CQRS через `ISender`) и
`Frontend/sql-module-web` (`C:\Users\vladislav.bokovoi\SQLTren\Frontend\sql-module-web`,
standalone React SPA, пока без embed-режима).
Контекст: подключение внешних модулей отработки навыков к платформе
(`Frontend/platform-web`, `MOD-` в `docs/MIGRATION_KANBAN.md`, Phase 7),
пилотный модуль — SQL-тренажёр.

Полный дизайн, рациональное обоснование и сквозной сценарий —
[`../MODULE_INTEGRATION.md`](../MODULE_INTEGRATION.md). Требования к Education —
[`2026-09-04-practical-modules.md`](./2026-09-04-practical-modules.md). Требования
к IdentityService (Token Exchange) —
[`2026-09-04-identity-token-exchange.md`](./2026-09-04-identity-token-exchange.md).
Этот документ — только то, что нужно реализовать в `SqlModule` (бэкенд) и
`sql-module-web` (SPA), без повторения общего «почему».

Соответствующие задачи кanban: `MOD-013` (frontend: `/launch` + `TokenProvider: handoff`),
`MOD-013a` (backend: каталог заданий), `MOD-014` (backend: Kafka-producer, attach-релей),
`MOD-014a` (backend: собственная `Audience`).

## Зависимости

- **`MOD-002a`/`MOD-002b`** (IdentityService, Done) — Token Exchange уже работает;
  `education-core` уже сконфигурирован с allow-list `["sql-module-api"]` (dev-сид
  `Backend/IdentityService/Host/appsettings.Development.json`) — модулю остаётся
  завести у себя именно такой `Audience`.
- **`MOD-003`** (Kafka в dev-инфраструктуре, Done) — брокер поднят
  (`Backend/compose.yaml`, `localhost:9092` с хоста), топики `scoodle.practice.events`/
  `scoodle.practice.completion` уже созданы `kafka-init` (3 партиции каждый).
  Wire-формат сообщений уже зафиксирован в `Education.Contracts.Kafka` — SqlModule
  сериализует **ровно** под эти контракты (см. §3 ниже), т.к. это единственная
  сторона консюмера.
- **`MOD-004`** (Education: реестр модулей, Done) — для регистрации SQL-модуля
  в реестре понадобится: `slug=sql`, `basePath=/modules/sql`,
  `identityAudience=sql-module-api`, `configuration.catalogEndpoint` — URL,
  который реализует §1 ниже.
- **`MOD-005…008`** (Education: каталог/привязка/сессия/consumer) — ещё не
  реализованы. SqlModule можно и нужно готовить параллельно (контракты уже
  зафиксированы в `MODULE_INTEGRATION.md`), но end-to-end проверить получится
  только после них.

## Существующее состояние (важно для оценки объёма)

`SqlModule` — зрелый, полностью самодостаточный бэкенд с собственным контуром
Student: `Web/Features/Training/Student/StudentEndpoints.cs` уже отдаёт темы,
задания (пагинация + по id), **безопасную схему БД задания** (`.../schema`,
только структура, без данных — то, что нужно для SQL-редактора) и попытки.
Отправка решения — `POST` в `Web/Features/Training/Attempts/SubmitAttempt`
(`Contracts/Training/Attempt/SubmitAttemptRequest { TaskId, SubmittedSql }`) —
выполняется **синхронно**: попытка тут же проверяется, результат
(`ExecutionStatus`, `IsCorrect`, `CheckReason`, грид результата) возвращается в
ответе и одновременно сохраняется в `Attempt`. Отдельного «долгого» исполнения
или собственного WebSocket/polling для проверки нет — механизм для событий
Kafka придётся **добавить сверху** существующего синхронного flow, не
переделывая его.

Роли (`Web/Common/Auth/Policies.cs`): `Roles.Admin/Teacher/Student` — совпадают
с ролями, выдаваемыми IdentityService, никаких доработок не требуют.

Аутентификация сейчас: `Host/appsettings*.json` → `Auth.Authority=http://localhost:5101`,
`Auth.Audience=scoodle-api` — **тот же audience, что и у Education**. Это ровно
та случайная общая аудитория, которую Token Exchange должен устранить (см.
`MODULE_INTEGRATION.md` §«Аутентификация UI модуля»).

## S1 — каталог заданий модуля (`MOD-013a`, backend)

Реализует конечную точку, которую Education дёргает **сервер-сервер** при
проксировании своего `GET /api/v1/practical-modules/{id}/tasks` (§2
`MODULE_INTEGRATION.md`). Контракт с Education фиксированный:

```
GET {catalogEndpoint}
 200 [ { ref: string, name: string, description: string } ]
```

Реализация в `SqlModule`:

```
GET /api/v1/module-integration/tasks-catalog
```

- Источник данных — тот же, что у `GetStudentTasks`/`GetAllSqlTasks`, но:
  фильтр **только** `PublicationStatus.Published` (как у Student-контура — уже
  правильный источник для того, что можно предлагать студенту), без пагинации
  (Education должен получить список целиком одним вызовом — задач в MVP
  немного, добавить `offset/limit` можно потом без breaking change, т.к.
  ответ — массив, а не `PageResponse`).
- `ref = task.Id` (строкой, `Guid.ToString()`) — самый простой вариант, не
  требует нового суррогатного идентификатора; Education хранит его как
  `PracticalTask.ExternalTaskRef` непрозрачно и подставляет назад в `launchUrl`
  как `task=`.
- `name = task.TaskName`, `description` — короткий текст (по аналогии с
  `GetStudentTasks`, `TaskText` обрезанный до ~200 символов, т.к. полное
  условие показывать преподавателю на этапе выбора незачем).
- **Аутентификация — открытый вопрос, нужно решить перед реализацией**:
  вызывающий (Education) сейчас не имеет собственного токена для API
  SqlModule (Token Exchange даёт токен **пользователя** под конкретный
  audience, а это server-to-server вызов без пользователя). Варианты:
  1. Отдельный статический service-ключ (`X-Service-Key` заголовок,
     сверяется с конфигом), простое решение для MVP — **рекомендация**.
  2. Client Credentials Grant в IdentityService (отдельный от Token
     Exchange поток, новый клиент `education-core` с `client_credentials`) —
     правильнее «по учебнику» OAuth2, но лишняя работа для MVP с одним
     вызывающим.
  3. Сетевая изоляция (эндпоинт слушает только на internal-сети/localhost,
     без токена вовсе) — не подходит, если Education и SqlModule не всегда
     совместно задеплоены в одну закрытую сеть.

  На MVP — вариант 1: `Auth:ServiceKey` в конфиге SqlModule и Education,
  один и тот же секрет с обеих сторон (аналогично `InitialClients` — dev-сид
  без сложной инфраструктуры). Зафиксировать в реестре модулей
  (`PracticalModule.configuration.serviceKey`, тоже видно только бэкенду
  Education, никогда не уходит в браузер).
- Таймаут на стороне Education короткий (2–3 с per `MODULE_INTEGRATION.md`
  §2) — эндпоинт не должен делать тяжёлых join'ов; текущий `GetStudentTasks`
  и так лёгкий (один SELECT с фильтром).

## S2 — attach-релей (`MOD-014`, backend)

**Кто кого вызывает.** По контракту §6 `MODULE_INTEGRATION.md`
`POST /api/v1/module-sessions/{sessionId}/attach` реализует **Education**, а
вызывает его **бэкенд модуля** (SqlModule), не браузер — `moduleToken`
(секрет сессии, кладётся в каждое Kafka-сообщение) никогда не должен попасть
в SPA. Значит SqlModule должен реализовать зеркальную, новую для себя часть:
принять `launchToken` от **своего** фронтенда и сервер-сервер обменять его в
Education, а фронтенду вернуть только факт успеха (не сам `moduleToken`).

```
POST /api/v1/module-integration/sessions/{sessionId}/attach
  { launchToken }
 200 {}                          -- сессия принята, можно решать задание
 401 { reason: "InvalidToken" }  -- launchToken истёк/использован/не для этого session — транслируется 1:1 из Education 401
 502                             -- Education недоступен
```

Кто вызывает: **`sql-module-web`**, авторизованный обычным Bearer (тем же
обменянным токеном `sql-module-api`, который лежит в `sessionStorage` после
`handoff`, см. §5) — обязательный `RequireAuthorization(Policies.Student)`,
т.к. запрос идёт от имени вошедшего пользователя, не анонимно.

Логика хендлера:

1. Валидировать, что вызывающий — тот же пользователь, что в `sub` токена
   (естественно, т.к. authorization уже это гарантирует — просто не путать
   `userId` из токена с чем-то из тела запроса).
2. Вызвать `POST {EducationBaseUrl}/api/v1/module-sessions/{sessionId}/attach`
   с телом `{ launchToken }` (новый исходящий `HttpClient` — в кодовой базе
   пока нет прецедента исходящих вызовов к другим сервисам платформы, только
   входящая JWT-валидация через `Authority`; понадобится
   `IHttpClientFactory` + типизированный клиент, по аналогии с тем, как
   `Client/` в этом же репо сделан для **входящих** потребителей SqlModule —
   тут нужен симметричный, но для исходящих вызовов).
3. На `200 { moduleToken, userId, taskRef, kafka }` — сохранить сессию у
   себя: новая таблица/сущность `ModuleSession` (`sessionId` PK,
   `moduleToken`, `taskRef`, `userId`, `kafkaBootstrap`, `eventsTopic`,
   `completionTopic`, `attachedAt`) — это и есть контекст, из которого потом
   строятся Kafka-сообщения (§3). `moduleToken` — секрет, храним, наружу не
   отдаём никогда (ни в одном ответе SPA).
4. На `401` от Education — вернуть `401` фронту как есть (не 500).
5. Если Education недоступен/таймаут — `502`, фронт показывает ошибку и даёт
   повторить (сама попытка на стороне Education уже создана и `ACTIVE`,
   ретрай attach безопасен — `launchToken` ещё не считается использованным,
   пока Education не отдал `200`, см. remark ниже).

**Идемпотентность attach.** `launchToken` одноразовый по контракту Education
(гасится **после первого успешного** использования) — значит ретраи с той же
страницы `/launch` (например, обновление страницы до того как SPA сохранила
успех) должны быть безопасны и на стороне SqlModule: если `ModuleSession` с
данным `sessionId` уже существует (attach уже прошёл раньше), повторный вызов
`.../attach` от фронта должен возвращать `200 {}` сразу из локального
состояния SqlModule, не дёргая Education повторно (второй вызов с тем же уже
погашенным `launchToken` получит от Education `401`, хотя сессия по факту
рабочая) — проверка "уже приаттачено" **до** похода в Education, не после.

## S3 — Kafka-producer (`MOD-014`, backend)

Wire-формат — **фиксирован Education** (`Education.Contracts.Kafka`,
`JsonSerializerDefaults.Web`, camelCase), SqlModule под него подстраивается,
не наоборот. Ключ обоих сообщений — `sessionId` (гарантия порядка событий
одной сессии внутри партиции).

### Топик `scoodle.practice.events`

Отправляется на каждое значимое действие студента в рамках сессии — в MVP
это ровно **каждый `SubmitAttempt`** (существующий синхронный flow,
`Web/Features/Training/Attempts/SubmitAttempt`), без изменения самого
эндпоинта ответа — событие в Kafka шлётся *дополнительно*, после того как
попытка уже сохранена и ответ пользователю сформирован (fire-and-forget
относительно HTTP-ответа, но с логированием ошибки продюсера — сбой Kafka
не должен ронять сам `SubmitAttempt`).

```json
{
  "sessionId": "88e73f-...",
  "moduleToken": "...из ModuleSession.moduleToken...",
  "moduleSlug": "sql",
  "taskRef": "...из ModuleSession.taskRef (совпадает с ref из S1)...",
  "seq": 1,
  "eventType": "CODE_EXECUTION",
  "occurredAt": "2026-09-05T10:15:30Z",
  "payload": {
    "submittedSql": "...SubmitAttemptRequest.SubmittedSql...",
    "status": "...ExecutionStatus как строка...",
    "rowCount": 25,
    "durationMs": 120
  },
  "intermediateResult": { "isCorrect": false, "reason": "..." }
}
```

- `seq` — монотонный счётчик **на сессию** (не на попытку), начиная с 1;
  проще всего — `COUNT(*) существующих событий этой сессии + 1`, посчитанный
  атомарно в той же транзакции, что и запись `Attempt` (или локальный
  счётчик в `ModuleSession`, инкрементируемый при каждой отправке — надёжнее
  при параллельных вкладках/ретраях запроса не полагаться на `COUNT`, а
  держать `ModuleSession.NextSeq` с оптимистичной блокировкой).
- `payload`/`intermediateResult` — производные от уже посчитанного
  `SubmitAttemptResponse`, лишнего вычисления не требуют.

### Топик `scoodle.practice.completion`

**Открытый вопрос, требующий решения владельца перед реализацией**: когда
считать сессию завершённой? У SQL-модуля попытки решения задания уже сейчас
**не ограничены** внутри себя (студент может отправлять `SubmitAttempt`
сколько угодно раз, пока не решит правильно, — это внутренняя механика
модуля, отдельная от внешнего `PracticalModuleSession.tryNumber`, который
считает **количество launch'ей**, а не количество SQL-попыток внутри одного
launch). Варианты (нужно выбрать один до `MOD-014`):

1. **Completion = первая `IsCorrect=true` попытка** — сессия завершается
   автоматически сразу как только студент решил задание верно; `grade=100`
   (или дискретная шкала — см. ниже), `finalScore/maxScore` — опционально.
   Плюс: не требует новых действий от студента. Минус: неверные попытки до
   решения не «оцениваются» — либо это ОК (единственное, что важно —
   попал/не попал в срок сессии), либо нужен штраф за число попыток
   (`completionData.totalAttempts`) — по аналогии с внутренним тестом, где
   штрафа за число попыток внутри одной сессии тоже нет.
2. **Явная кнопка «Завершить»** у студента, доступная в любой момент —
   завершает текущим состоянием (`grade` = 100, если была хоть одна
   `IsCorrect=true` попытка, иначе 0). Даёт студенту контроль, но требует
   нового UI-элемента и эндпоинта.
3. **TTL по бездействию** (уже есть на стороне Education как fallback →
   `EXPIRED`, но это "не решил вовремя", а не "решил и ушёл").

**Рекомендация** — вариант 1 (авто-завершение по первой верной попытке):
он не требует нового UI, согласуется с моделью «одна external-практика = одно
задание» (MVP) и с тем, что `PracticalModuleSession.tryNumber` уже даёт
студенту право начать заново (новый launch = новая сессия), если он не
решил с первого захода — конкретно так, как и `triesCount` задуман в §
«Повторные попытки» `MODULE_INTEGRATION.md`. Явную кнопку «Сдать» можно
добавить позже без слома контракта (просто новый триггер того же
completion-эндпоинта).

```json
{
  "sessionId": "88e73f-...",
  "moduleToken": "...",
  "status": "COMPLETED",
  "grade": 100,
  "finalScore": 100.0,
  "maxScore": 100.0,
  "completionData": {
    "totalAttempts": 3,
    "correctAttemptId": "...Attempt.Id..."
  },
  "completedAt": "2026-09-05T10:40:00Z"
}
```

- `grade` — по контракту Education обязателен и **не пересчитывается** ядром
  (см. `MODULE_INTEGRATION.md` §7). Раз внутренняя проверка SQL-модуля даёт
  только бинарный `IsCorrect`, естественная шкала — `grade ∈ {0, 100}`
  (можно ужесточить до 5-балльной позже, это внутреннее решение модуля,
  Education его не валидирует, просто хранит и берёт `MAX` по сессиям).
- Отправляется **один раз** на сессию (после отправки — `ModuleSession`
  помечается `CompletedAt` локально, чтобы не продублировать сообщение при
  повторном верном submit в редком race, если фронт всё ещё открыт).

### Конфигурация

Новая секция `Kafka` в `Host/appsettings*.json`, симметрично
`Education.Web/appsettings.Development.json`:

```json
"Kafka": {
  "BootstrapServers": "localhost:9092",
  "EventsTopic": "scoodle.practice.events",
  "CompletionTopic": "scoodle.practice.completion"
}
```

(Значения `EventsTopic`/`CompletionTopic` дублируют то, что уже приходит в
ответе `attach` (`kafka.eventsTopic`/`kafka.completionTopic`) — можно взять
оттуда динамически вместо конфига, это надёжнее при смене топиков без
редеплоя SqlModule; конфиг — только для `BootstrapServers`, если по каким-то
причинам SqlModule и Education смотрят на брокер по разным адресам сети.)

Пакет — `Confluent.Kafka` (та же версия, что зафиксирована в Education,
`2.15.0`, — не обязательно совпадать версии между репозиториями, но нет
причин ставить другую). Producer — простой JSON-producer, ключ
`sessionId.ToString()`, `Formatting.Web`/camelCase — **не переиспользовать**
`Education.Kafka` как NuGet-пакет (в `MODULE_INTEGRATION.md` уже
зафиксировано: между репозиториями нет общей фиды пакетов, каждый модуль
держит свою копию сериализации под тот же wire-контракт).

## S4 — собственная `Audience` (`MOD-014a`, backend)

Минимальное изменение, но обязательное условие всей схемы Token Exchange:

```diff
- "Audience": "scoodle-api"
+ "Audience": "sql-module-api"
```

в `Host/appsettings.json` и `Host/appsettings.Development.json`
(`Auth:Audience`, читается в `AuthOptions`/JWT-bearer setup — сам код
валидации трогать не нужно, только конфиг). Значение **должно** совпадать с
`identityAudience`, который заведут в реестре Education при регистрации
модуля (`MOD-004`, поле `PracticalModule.IdentityAudience`), и с
`allowedAudiences` клиента `education-core` в IdentityService
(`Backend/IdentityService`, `InitialClients`, уже настроено на
`["sql-module-api"]`, см. §«Зависимости»).

**Важное следствие**: после этого изменения обычный токен платформы
(`aud=scoodle-api`, выданный студенту при логине в Education) **перестанет
проходить** валидацию SqlModule напрямую — это ожидаемо и есть суть механизма
(единственный легитимный путь получить `sql-module-api`-токен — через launch
из Education, который сначала делает Token Exchange). Значит:

- Прямой (не через `/launch`) логин студента в standalone-режиме
  `sql-module-web` (текущий `LoginPage` + `session-store`, который ходит в
  IdentityService напрямую) **тоже сломается** для ролей, если IdentityService
  не выдаёт `sql-module-api`-токен при обычном логине (а он и не должен —
  Token Exchange для того и нужен, чтобы обычный логин выдавал только
  `aud=scoodle-api` или что там сейчас настроено дефолтным). Нужно решить
  явно: standalone-режим `sql-module-web` (прямой логин в отрыве от
  Education) — либо остаётся на **старом** общем audience через отдельный
  дев-конфиг (`Auth:Audience` через переменную окружения/два инстанса —
  один для standalone-тестирования, один прод под платформой), либо
  standalone-логин выводится из эксплуатации совсем, как только запуск идёт
  только через платформу. Зафиксировать явно перед `MOD-014a` — это ломающее
  изменение для текущего способа тестировать модуль в одиночку.

## Frontend (`sql-module-web`, `MOD-013`)

### F1 — новый маршрут `/launch`

Добавить в `src/app/router/AppRouter.tsx` **до** `RequireAuth`-обёрнутых
маршрутов (сам этот маршрут и есть механизм входа, `RequireAuth` его не
должен блокировать):

```
GET /launch?session={sessionId}&task={ref}&return_url={enc}&token={launchToken}
    #access_token={exchangedToken}
```

Компонент `LaunchPage` (новая фича, `src/features/launch/` или `src/session/`
— ближе ко второму, т.к. это источник токена, симметрично `LoginPage`):

1. На маунте — прочитать `location.hash` (`#access_token=...`), **до**
   любого рендера, что могло бы триггернуть чтение `location.search` третьими
   библиотеками (React Router сам не трогает hash, но лишний рендер с "грязным"
   URL нежелателен).
2. Декодировать токен через уже существующий `decodeSessionUser`
   (`src/session/lib/decode-session-user.ts`) — **переиспользовать**, не
   писать новый декодер.
3. Записать сессию: **важно** — текущий `session-store.ts` жёстко
   использует `persist(..., { storage: createJSONStorage(() => localStorage) })`.
   По контракту (`MODULE_INTEGRATION.md`, «Аутентификация») токен из
   handoff-потока обязан лежать в **`sessionStorage`**, не `localStorage`
   (переживает только вкладку — стандартное требование к обменянному
   узкоаудиторному токену с TTL 30 минут, не должен «жить» между визитами).
   Значит нужен один из двух путей:
   - **(a)** Параметризовать `createSessionStore`/фабрику стораджа так, чтобы
     handoff-режим создавал отдельный экземпляр стора с
     `createJSONStorage(() => sessionStorage)` — чище, но требует немного
     переписать `session-store.ts` (сейчас это синглтон-модуль, а не фабрика).
   - **(b)** Не трогать zustand-persist вообще: в `LaunchPage` писать токен
     напрямую в `sessionStorage` под своим ключом и завести отдельный,
     непёрсистентный `TokenProvider` (`handoff-token-provider.ts`, по образцу
     `memory-token-provider.ts`, но читающий из `sessionStorage` при
     инициализации) — минимальные изменения существующего кода,
     **рекомендация**.
4. Сразу вычистить фрагмент: `history.replaceState(null, '', location.pathname + location.search)`
   — токен не должен пережить в истории браузера/при копировании ссылки.
5. Вызвать `POST /api/v1/module-integration/sessions/{sessionId}/attach`
   (S2, уже авторизованный только что установленным токеном) — до готовности
   и полученного `200` показывать лоадер, не пускать на страницу задания.
6. На успехе — редирект (`navigate`, не полная перезагрузка — SPA уже
   поднята) на `/student/tasks/{task}` (`task` = `ref` из query, который по
   §S1 равен `SqlTask.Id` — маршрут `student/tasks/:taskId` **уже
   существует**, доп. работы на этой странице не требуется, если ref = Id).
   `sessionId`/`return_url` нужно пронести дальше (в `sessionStorage` или
   query второй страницы) — они понадобятся на завершении (F2).
7. На `401` от attach (S2) — токен/сессия истекли ещё до открытия модуля;
   показать ошибку и **не** пытаться сделать что-то ещё (нет пути назад в
   Education без `return_url`, который в этом случае недоступен — самый
   краевой случай, вероятно просто текст «ссылка недействительна, вернитесь
   на платформу и начните заново»).

### F2 — возврат в платформу по завершении

Момент завершения = момент отправки `completion` в Kafka (S3, backend) — на
фронте это тот же самый успешный `SubmitAttempt`, который решает задачу по
выбранному критерию (§S3, «первая верная попытка»). После получения
`IsCorrect=true` в ответе `SubmitAttempt` **в контексте активной
launch-сессии** (т.е. `sessionId` есть в `sessionStorage`/URL из F1) —
`window.location.assign(return_url)`, ровно как описано в §9
`MODULE_INTEGRATION.md`; **не** `navigate()` — это уход на другое
приложение (platform-web), а не внутренний переход.

Если студент открыл `/student/tasks/:taskId` **не** через `/launch` (обычный
standalone-режим, есть `sessionId`?) — этот редирект не должен срабатывать;
условие простое: делать его только если в контексте присутствует активный
`launchSessionId`.

### F3 — `TokenProvider: handoff`

Новый файл `src/session/providers/handoff-token-provider.ts`:

```ts
export function createHandoffTokenProvider(): TokenProvider {
  const STORAGE_KEY = 'sql-module-handoff-token';
  return {
    getAccessToken: () => sessionStorage.getItem(STORAGE_KEY),
    setTokens: ({ accessToken }) => sessionStorage.setItem(STORAGE_KEY, accessToken),
    clear: () => sessionStorage.removeItem(STORAGE_KEY),
    // без getRefreshToken/refresh — обменянный токен одноразовый по смыслу,
    // истечёт — предполагается новый launch из Education, не silent refresh
  };
}
```

Никакого auto-refresh (в отличие от `host-token`/standalone из `CONCEPT.md`
§5) — соответствует «Остаточному риску» из `MODULE_INTEGRATION.md`
(долгая сессия модуля может пережить TTL — на MVP осознанно не решаем).

## Приёмка

- [ ] S1: `GET /api/v1/module-integration/tasks-catalog` — `ref/name/description`
      по опубликованным заданиям, защищён service-key (или согласованной
      альтернативой), покрыт тестом.
- [ ] S2: `POST /api/v1/module-integration/sessions/{sessionId}/attach` —
      релей в Education, `ModuleSession` создаётся локально, идемпотентен
      при повторном вызове с уже приаттаченной сессией, тесты на 200/401/502.
- [ ] S3: Kafka-producer — событие на каждый `SubmitAttempt` (`seq`
      монотонный на сессию), completion на достижение критерия завершения
      (решение зафиксировано владельцем — см. открытый вопрос выше), формат
      сообщений 1:1 с `Education.Contracts.Kafka`, отправка не блокирует и
      не роняет основной ответ `SubmitAttempt`.
- [ ] S4: `Auth:Audience=sql-module-api` в обоих `appsettings*.json`; решение
      по судьбе standalone-логина зафиксировано и реализовано.
- [ ] F1: маршрут `/launch`, чтение `access_token` из фрагмента +
      немедленная очистка URL, `sessionStorage` (не `localStorage`), вызов
      attach, редирект на страницу задания.
- [ ] F2: `window.location.assign(return_url)` по завершении launch-сессии,
      не срабатывает вне контекста launch.
- [ ] F3: `handoff-token-provider.ts`, без auto-refresh.
- [ ] OpenAPI SqlModule обновлён (`S1`/`S2` — новые публичные контракты),
      Education подтягивает описание `catalogEndpoint` вручную (это внешний
      URL в конфиге реестра, не Orval-клиент).

## Не входит в эту итерацию

- Явная кнопка «Сдать» как альтернативный триггер completion — заложена как
  будущее расширение, не блокирует MVP (см. §S3, вариант 2).
- Промежуточный `intermediateResult`, отличный от простого
  `{ isCorrect, reason }` (например, частичная проверка по шагам) — не
  требуется, пока Education использует событие только как «цифровой след»
  для просмотра, не для логики.
- Разделение standalone/платформенного окружений на два физических деплоя —
  фиксируется как решение (§S4), но сама инфраструктура (два конфига, два
  URL) — вне рамок этой доработки, только код должен это допускать.
