# Backend handoff — Token Exchange (IdentityService)

Дата: 2026-09-04. **Статус: спека, к реализации не приступали.**
Проект бэкенда: `IdentityService` (`C:\Users\vladislav.bokovoi\SQLTren\Backend\IdentityService`).
Контекст: подключение внешних практических модулей к платформе
(`Frontend/platform-web`, `MOD-002a`/`MOD-002b` в `docs/MIGRATION_KANBAN.md`).
Полное обоснование — [`../MODULE_INTEGRATION.md`](../MODULE_INTEGRATION.md),
раздел «Аутентификация UI модуля».

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
    "audience": "sql-module-api"
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
4. Новый токен: те же `sub`, `email`, `name`, роли, что в `subjectToken`;
   `aud = запрошенная audience`; `iss` — тот же; `exp` — короче обычного
   (по умолчанию 30 мин, конфигурируемо; короче не обязательно — аудитория и
   так узкая, поэтому TTL можно оставить длиннее 15-минутного обычного access-токена).
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

- [ ] `Clients` — таблица/конфигурация, одна запись для `education-core`.
- [ ] `POST /api/v1/auth/token/exchange` реализован, покрыт тестами:
      happy path; неверный секрет клиента → 401; `audience` не в allow-list → 401;
      `subjectToken` истёк/невалиден → 401; выданный токен проходит
      JWT-bearer валидацию с `Audience=sql-module-api`, но НЕ проходит
      с `Audience=scoodle-api`.
- [ ] `AuditEvent` на каждый обмен.
- [ ] `Education` получил `client_id`/`client_secret` в свою конфигурацию (dev — `appsettings.Development.json`, как остальные секреты сервиса).
