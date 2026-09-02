# TD-005 — Нет `GET /modules/{moduleId}`

Статус: `Backlog`. Приоритет: P3. Контур: Teacher/Student.

## Проблема

Имя модуля отдельно получить нельзя — только через `GET /courses/{courseId}/modules`.
Для заголовка страницы модуля приходится знать `courseId` и грузить список.

## Обход (текущий)

Брать `ModuleResponse` из списка модулей курса. Маршрут страницы модуля несёт
`courseId` и `moduleId`, либо список кэшируется Query.

## Готово, когда

Появился `GET /api/v1/modules/{moduleId}` и страница модуля перешла на него.

## Зависимость

Backend `Education`.
