# Технический долг `platform-web`

Актуализировано: 2026-09-02.

Единственная канбан-доска техдолга проекта. Задачи миграции ведутся отдельно в
[`MIGRATION_KANBAN.md`](./MIGRATION_KANBAN.md); сюда попадает только долг, который
переживёт миграцию. Подробности — в [`tech-debt/records`](./tech-debt/records).

## Правила ведения

- Каждая работа получает постоянный ID `TD-NNN` и отдельную запись в `tech-debt/records/`.
- В таблице меняются статус, приоритет и запись; завершённые строки не удаляются.
- Статусы: `Backlog`, `Ready`, `In progress`, `Blocked`, `Done`.
- В `Blocked` обязательно указывается конкретная внешняя зависимость.
- Новые планы, handoff-файлы и отчёты вне этой структуры и `MIGRATION_KANBAN.md` не создаются.

## Канбан

| ID | Работа | Контур | Приоритет | Статус | Зависимость | Запись |
|---|---|---|---|---|---|---|
| TD-001 | Нормализация `number \| string` из Education API | Platform | P1 | Backlog | Backend: именованные типы вместо union | [Открыть](./tech-debt/records/TD-001-number-string-union.md) |
| TD-002 | Route-level code splitting (`/teacher`, `/admin`) | Platform | P2 | Backlog | Нет | [Открыть](./tech-debt/records/TD-002-route-code-splitting.md) |
| TD-003 | Серверная пагинация и поиск списков | Platform | P2 | Backlog | Backend: `PagedResponse` + query-параметры | [Открыть](./tech-debt/records/TD-003-server-pagination.md) |
| TD-004 | Нет `GET /tasks/{taskId}` — текст задания только из списка практики | Teacher/Student | P2 | Backlog | Backend: одиночный эндпоинт задания | [Открыть](./tech-debt/records/TD-004-task-by-id-endpoint.md) |
| TD-005 | Нет `GET /modules/{moduleId}` — имя модуля берётся из списка модулей курса | Teacher/Student | P3 | Backlog | Backend: одиночный эндпоинт модуля | [Открыть](./tech-debt/records/TD-005-module-by-id-endpoint.md) |
| TD-006 | Совместимость HTML: Quill (legacy) → TipTap | Platform | P2 | Backlog | Нет | [Открыть](./tech-debt/records/TD-006-richtext-html-compat.md) |
| TD-007 | Минимальная регрессионная защита фронта | Platform | P2 | Backlog | Стабилизация контуров | [Открыть](./tech-debt/records/TD-007-frontend-regression.md) |

## Срез

Долг заведён на старте миграции из наблюдений гэп-анализа (`../PHASE0_API_GAP.md` §4–5).
`TD-001`, `TD-003`, `TD-004`, `TD-005` зависят от доработок бэкенда `Education` и не
блокируют MVP: обходятся клиентскими нормализаторами и агрегацией из списков.
`TD-002`, `TD-006`, `TD-007` — на стороне фронта, выполняются после паритета контуров.

## Рекомендуемый порядок

`TD-006 → TD-001 → TD-004 → TD-005 → TD-002 → TD-003 → TD-007`.
