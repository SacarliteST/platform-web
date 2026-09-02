# TD-001 — Нормализация `number | string` из Education API

Статус: `Backlog`. Приоритет: P1. Контур: Platform.

## Проблема

.NET 10 OpenAPI отдаёт числовые поля как union-типы: `triesCount: [integer, string]`,
`percentForFive/Four/Three: [number, string]` (с `pattern`). Orval генерирует
`number | string`. Если тащить это в UI — арифметика и сравнения ломаются.

## Что сделать

- В `entities/practical/lib` (и где ещё всплывёт) — нормализаторы `toNumber(x)`,
  применять на границе `api → entity`.
- Не использовать сырые поля ответа в компонентах.

## Готово, когда

Ни один компонент не оперирует `number | string` из `api/education/model`; пороги и
попытки приходят в UI как `number`.

## Зависимость

Полное устранение — на стороне бэкенда: именованные типы / строковый enum вместо union.
До этого достаточно клиентской нормализации.
