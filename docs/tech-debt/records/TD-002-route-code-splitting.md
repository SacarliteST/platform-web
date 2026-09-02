# TD-002 — Route-level code splitting (`/teacher`, `/admin`)

Статус: `Backlog`. Приоритет: P2. Контур: Platform.

## Проблема

В `sql-module-web` эта задача (их `TD-002`) осталась открытой: студенческие маршруты
и тяжёлые редакторы ленивые, а `teacher`/`admin` страницы — в основном bundle.
Не наследовать этот долг в `platform-web`.

## Что сделать

- `React.lazy` для страниц `/teacher/*` и `/admin/*`, отдельные chunks.
- Тяжёлый rich-text редактор (`@mantine/tiptap`) — вынести в ленивый chunk.
- Зафиксировать бюджеты initial и editor chunks.

## Готово, когда

Начальный JS-бандл не содержит страниц teacher/admin и rich-text редактора; бюджеты
задокументированы и проверяются в `npm run build`.
