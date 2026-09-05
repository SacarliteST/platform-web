# Backend handoff — Token Exchange (IdentityService)

Дата: 2026-09-04. **Статус: базовый Token Exchange реализован (`MOD-002a`/`MOD-002b`,
коммит `7d8d692` в `IdentityService`). Ниже — исходная спека + доработка от
2026-09-05 (claim `session_id`), которая ещё НЕ сделана.**
Проект бэкенда: `IdentityService` (`C:\Users\vladislav.bokovoi\SQLTren\Backend\IdentityService`).
Контекст: подключение внешних практических модулей к платформе
(`Frontend/platform-web`, `MOD-002a`/`MOD-002b` в `docs/MIGRATION_KANBAN.md`).
Полное обоснование — [`../MODULE_INTEGRATION.md`](../MODULE_INTEGRATION.md)
(редакция 2026-09-05), раздел «Аутентификация UI модуля».

> **Доработка 2026-09-05 (не реализована):** по пересмотренному концепту сессию
> модуля создаёт Education и передаёт её `sessionId` в вызов exchange;
> IdentityService кладёт его в claim `session_id` выпускаемого токена. Это
> позволяет `SqlModule` определять модульную сессию из самого токена, без
> отдельного заголовка. См. §«Требуемый эндпоинт» п. 4 и «Приёмка».

## Суть

Сейчас `IdentityService` выдаёт токен с единственным глобальным `Jwt:Audience`
из конфига (проверено — в `Features/` нет ни `Client`, ни multi-audience,
ни token-exchange; `appsettings*.json` → один `"Jwt": {"Audience": "scoodle-api"}`
на весь инстанс). Любой сервис, настроенный на тот же `Authority`/`Audience`,
принимает один и тот же токен — это не проблема, пока сервисов, которым доверяют
чужой контент/код (внешние практические модули), не появляется.

Как только внешний модуль (SQL-тренажёр и далее) начинает исполняться на своём
бэкенде и вызывать свой собственный API от лица студента, токену, который он
получает, не место в API `Education` — токен должен работать только там, куда
его выдали. Нужен способ выдать студенту **новый** токен, ограниченный конкретным
сервисом (`aud`), не трогая его текущую сессию в платформе.

## Модель данных (новое)

```
Clients
  client_id          text PK        -- "education-core"
  client_secret_hash text
  allowed_audiences  text[]         -- ["sql-module-api", …] — что клиенту можно
                                     --   запросить через exchange от чужого имени
  is_enabled         bool
```

На первую итерацию — одна запись: `client_id="education-core"`,
`allowed_audiences=["sql-module-api"]`. Секрет — генерируется один раз,
хранится в конфиге `Education` (не в БД `Education`).

## Требуемый эндпоинт

```
POST /api/v1/auth/token/exchange
  Authorization: Basic base64(client_id:client_secret)
  Content-Type: application/json
  {
    "grantType": "urn:ietf:params:oauth:grant-type:token-exchange",
    "subjectToken": "<jwt, valid, aud=scoodle-api>",
    "audience": "sql-module-api",
    "sessionId": "<guid, опционально>"      // доработка 2026-09-05
  }

 200 { "accessToken": "<новый jwt>", "expiresIn": 1800 }
 400 — тело невалидно
 401 — client_id/secret неверны, ИЛИ audience не в allowed_audiences клиента,
       ИЛИ subjectToken невалиден/истёк/не тот aud
```

### Валидация

1. Basic-аутентификация клиента: `client_id` существует, `is_enabled=true`,
   секрет совпадает (хеш).
2. `audience` ∈ `client.allowed_audiences` — иначе `401` (не «клиент не может
   запросить любую произвольную аудиторию»).
3. `subjectToken` валидируется **так же, как обычный входящий JWT** (подпись,
   `exp`, `nbf`, ожидаемый `aud=<текущий Audience инстанса>` — тот, из-под
   которого вызывающий клиент имеет право обменивать).
4. Новый токен: те же `sub` (= `userId` студента), `email`, `name`, роли, что в
   `subjectToken` (в практическом сценарии — роль `Student`); `aud = запрошенная
   audience` (`sql-module-api`); `iss` — тот же.
   **Доработка 2026-09-05 (нужна backend-команде SqlModule, `MOD-002c`):**
   - если в запросе есть `sessionId` — добавить в токен claim
     **`session_id = <sessionId>`**. `SqlModule` берёт модульную сессию из этого
     claim (заголовка `X-Module-Session-Id` в новом концепте нет), поэтому без
     `session_id` бэкенд модуля не может безопасно реализовать `sessions/current`
     и привязать SQL-попытку к платформенной сессии;
   - итоговые claim'ы module-токена: `session_id`, `sub=<userId>`,
     `aud=sql-module-api`, роль `Student`;
   - **TTL согласовать с временем жизни практической сессии.** По умолчанию
     `Jwt:ExchangeAccessTokenMinutes` (30 мин); Education в теле запроса может
     передать желаемый `expiresIn` / Identity ограничивает `exp` так, чтобы токен
     не пережил `expiresAt` сессии, если та короче. Продление — новый обмен со
     стороны Education при «Продолжить», не silent refresh;
   - токен **без** `sessionId` (обычный обмен без сессии) остаётся валидным.
5. **Refresh-токен не выдаётся.** Обменянный токен — одноразовый по смыслу,
   живёт ровно на длительность сессии в модуле; истёк — новый обмен со стороны
   `Education` при следующем запуске.
6. Событие в аудит (`AuditEvent`) — по аналогии с `Login`: кто обменял, для
   какой `audience`, `sub` предмета обмена.

## Безопасность

- Секрет клиента — конфигурация `IdentityService`, не в открытом виде в БД
  (хеш, как пароли пользователей).
- `allowed_audiences` — явный allow-list, не «любая строка, которую пришлют».
- Эндпоинт не выставлен для браузера напрямую — вызывается только сервис-сервис
  (`Education` → `IdentityService`), не документируется как публичный OAuth-флоу.
- Обменянный токен физически не проходит валидацию на сервисах с другим
  `Audience` (в частности — на самом `Education`) — это и есть цель механизма.

## Приёмка

- [x] `Clients` — таблица/конфигурация, одна запись для `education-core` (`MOD-002a`, `7d8d692`).
- [x] `POST /api/v1/auth/token/exchange` реализован, покрыт тестами (`MOD-002b`):
      happy path; неверный секрет клиента → 401; `audience` не в allow-list → 401;
      `subjectToken` истёк/невалиден → 401; выданный токен проходит
      JWT-bearer валидацию с `Audience=sql-module-api`, но НЕ проходит
      с `Audience=scoodle-api`.
- [x] `AuditEvent` на каждый обмен (`TokenExchanged`).
- [x] `Education` получил `client_id`/`client_secret` в свою конфигурацию (dev — `appsettings.Development.json`).
- [ ] **Доработка 2026-09-05:** запрос принимает `sessionId`; при его наличии
      токен несёт claim `session_id` с этим значением; токен без `sessionId`
      по-прежнему валиден — покрыто тестом.
