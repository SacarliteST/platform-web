# TD-004 — Нет `GET /tasks/{taskId}`

Статус: `Backlog`. Приоритет: P2. Контур: Teacher/Student.

## Проблема

Текст и имя задания доступны только в списке `GET /practicals/{practicalId}/tasks`
(`TaskResponse` с `text`). Одиночного `GET /tasks/{taskId}` нет.

## Обход (текущий)

Грузить список заданий практики, брать нужный `TaskResponse` по `taskId`; кэш
TanStack Query по ключу практики. Экран задания получает `practicalId` из маршрута.

## Готово, когда

Появился `GET /api/v1/tasks/{taskId}` и экраны задания перешли на него без обхода.

## Зависимость

Backend `Education`.
