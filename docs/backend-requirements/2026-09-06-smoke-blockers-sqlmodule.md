# ТЗ соседям — воспроизводимый сквозной прогон MOD-016

Дата: 2026-09-06. Автор: платформенная команда (Education + platform-web + инфра).
Адресат: команда `Backend/SqlModule` + `Frontend/sql-module-web`.

## Контекст

2026-09-06 прогнали весь цифровой путь MOD-016 по API на чистых контейнерах
(`docker compose -f Backend/compose.yaml down -v && up -d`). Платформенная
сторона контракта — **зелёная end-to-end**, включая исходящие вызовы модуля
(publisher → Kafka, completion client → Education). Но чтобы прогон
**воспроизводился без ручных правок БД**, нужны доработки на вашей стороне.

Ниже — `SMK-2`, `SMK-3`, `SMK-4`, `SMK-6` из общей доски
([`MIGRATION_KANBAN.md`](../MIGRATION_KANBAN.md), раздел «MOD-016 — прогон smoke»).

### Что уже проверено вживую и работает (менять не нужно)

- `POST /api/v1/module-integration/sessions` (приём пуша C1) — при верном
  `X-Service-Key` создаёт `ModuleSession`, повторный пуш синхронизирует,
  терминальную → `409`.
- `GET /api/v1/module-integration/tasks-catalog` — отдаёт `Published`-задания
  под `X-Service-Key`.
- `SubmitAttemptCommand` — сверка владельца сессии `moduleSession.UserId ==`
  `sub` обменянного токена. **Education теперь шлёт в пуше именно identity-id**
  (было legacy-id → `403 ModuleSessionForbidden`; исправлено на нашей стороне,
  коммит `67f05cf`). Ваша проверка корректна, менять не надо.
- `PendingPublishWorker` — публикует `sql_submit` в `scoodle.practice.events`
  (Education-consumer их принимает и пишет в `PracticalTaskEvents`).
- `EducationCompletionClient` — на верном ответе вызывает
  `POST {education}/api/v1/module-sessions/{sid}/complete` c `X-Service-Key` +
  `sessionKey`; Education переводит сессию в `COMPLETED` и проставляет оценку.
  Проверено: `grade=100` по первой верной попытке.

---

## SMK-2 — интеграционные эндпоинты подняты только в platform-профиле

**Симптом.** `dotnet run` без аргументов берёт первый профиль `launchSettings`
= `Isolated` → `ASPNETCORE_ENVIRONMENT=Development`. `appsettings.Development.json`
у модуля **нет**, поэтому `ModuleIntegration:Enabled` остаётся `false` из
`appsettings.json`. При `Enabled=false`:

- `EndpointExtensions.AddEndpoints` **пропускает** все `IModuleIntegrationEndpoint`
  → `/api/v1/module-integration/{sessions,current,tasks-catalog}` не существуют
  (404 на любой из них, хотя код есть);
- `Auth:Audience = scoodle-api`, а обменянный токен идёт с `aud = sql-module-api`
  → `401`.

**Что сделать (на выбор):**

1. Явно поднимать модуль профилем `Platform`
   (`ASPNETCORE_ENVIRONMENT=Platform`) — и зафиксировать это в runbook / в
   compose для смоука. Это минимальный вариант.
2. Либо добавить `appsettings.Development.json` (или секцию в существующий
   dev-профиль), который тоже включает `ModuleIntegration:Enabled=true` и
   `Auth:Audience=sql-module-api`, чтобы «просто `dotnet run`» из коробки
   участвовал в интеграции. Тогда нужен отдельный флаг для standalone-разработки
   (`ModuleIntegration:Enabled=false`).

Рекомендуем (1) + строку в вашем README и в общий smoke-runbook.

## SMK-3 — `ServiceKey` не совпадает между репозиториями

**Симптом.** Education в dev-конфиге использует
`PracticalModules:sql:ServiceKey = dev-sql-module-service-key-change-me`
(им подписывается пуш C1 и по нему проверяются вызовы `/complete`).
SqlModule `appsettings.Platform.json`:
`ModuleIntegration:ServiceKey = sql-module-platform-dev-key`.

→ пуш C1 отвалится `401 InvalidServiceKey`; `/complete` от модуля Education
отвергнет `401`.

**Что сделать.** Согласовать **один** дев-ключ. Проще всего — привести
`appsettings.Platform.json` к значению Education:

```json
"ModuleIntegration": {
  "ServiceKey": "dev-sql-module-service-key-change-me"
}
```

(Прод-ключи — из секрет-хранилища, к дефолтам в репозитории отношения не имеют.)
В прогоне обошли это env-оверрайдом `ModuleIntegration__ServiceKey=...`.

## SMK-4 — `EducationBaseUrl` указывает не на тот порт

**Симптом.** `appsettings.Platform.json`:
`ModuleIntegration:EducationBaseUrl = http://localhost:5000`. Education в dev
слушает `http://localhost:5135` (см. его `launchSettings.json`). Колбэк
`/complete` от `EducationCompletionClient` уйдёт в `connection refused`.

**Что сделать.** Поправить дефолт:

```json
"ModuleIntegration": {
  "EducationBaseUrl": "http://localhost:5135"
}
```

За общим reverse-proxy (`MOD-015`) — `http://localhost:8090` (или адрес шлюза
в проде). В прогоне обошли env-оверрайдом.

## SMK-6 — в platform-профиле нет решаемого задания

**Симптом.** Даже с `SeedDemoData=true`:

- `DemoDataSeeder` создаёт `SqlTask` со статусом **`Draft`**
  (`SqlTask.Create(... PublicationStatus.Draft)`), а `tasks-catalog` отдаёт
  только `Published` → каталог пуст → преподавателю нечего привязать к практике.
- профиль `Platform` идёт с `UseFakeSandbox=false` → для проверки решения нужен
  реальный Docker-сэндбокс с поднятой целевой БД; у демо-`SqlQuery` целевой БД
  нет, решить задание нельзя.

В прогоне это обошли вручную: `UPDATE "SqlTasks" SET "PublicationStatus"='Published'`
+ подмена `SqlQueries.ExpectedResult` под вывод fake-sandbox. Для
воспроизводимого смоука так нельзя.

**Что сделать (на выбор):**

1. **Smoke-seed** (рекомендуем): отдельный сидер/флаг
   (`SeedSmokeData=true`), который создаёт **одно `Published` задание** с
   известным `ref`, целевой БД и эталоном, решаемое **с реальным сэндбоксом**.
   Тогда смоук: `catalog → bind → launch → submit(correct) → complete`.
2. Либо в demo-профиль: публиковать демо-`SqlTask` (`PublicationStatus.Published`)
   и укомплектовать его целевой БД + эталоном, чтобы `UseFakeSandbox=false`
   отрабатывал.
3. Минимально для CI-смоука — разрешить `UseFakeSandbox=true` в платформенном
   профиле под флагом и заложить эталон, совпадающий с выводом fake-sandbox
   (эмуляция «правильного ответа»). Наименее ценно — не проверяет реальный SQL.

Нужен хотя бы вариант, где студент может получить `isCorrect=true` без ручных
`UPDATE` в БД.

---

## Опорные значения для smoke (dev, без шлюза)

| Что | Значение |
|---|---|
| IdentityService | `http://localhost:5101` |
| Education | `http://localhost:5135` |
| SqlModule | `http://localhost:5202` |
| sql-module-web | `http://localhost:5174` (Education шлёт `launchUrl` сюда — опция `ModuleIntegration:ModuleWebOrigin`, коммит `00a2227`) |
| Kafka | `localhost:9092`, топик `scoodle.practice.events` |
| Общий `ServiceKey` (dev) | `dev-sql-module-service-key-change-me` |
| `identityAudience` модуля | `sql-module-api` |
| Identity client Education | `education-core` / `dev-education-core-secret-change-me`, `AllowedAudiences=[sql-module-api]` |
| Сид-пользователи Identity | `admin@scoodle.local` / `Admin1234`, `teacher@…` / `Teacher1234`, `student@…` / `Student1234` |

Профиль запуска SqlModule для смоука:

```
ASPNETCORE_ENVIRONMENT=Platform
ModuleIntegration__ServiceKey=dev-sql-module-service-key-change-me
ModuleIntegration__EducationBaseUrl=http://localhost:5135
# + решаемое Published-задание в БД модуля (SMK-6)
```

## Что после этого проверит платформенная команда

Полный браузерный путь: `launch` (`#access_token` → `sessionStorage`,
`history.replaceState`) → навигация по `taskRef` → решение → возврат по
`returnUrl` → оценка и протокол на странице практики platform-web
(`MOD-013` / `MOD-016` / шлюз `MOD-015`).
