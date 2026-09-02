# AGENTS.md

Инструкции для агентской разработки `platform-web`.

## Что это за проект

Веб платформы **Scoodle** (LMS: курсы, модули, теория, практика, тесты, задания,
оценки, админка). Мигрирует со стека legacy `Frontend/platform` (React 18 / JS /
Bootstrap / axios) на стек `Frontend/sql-module-web` и новый бэкенд `Education` API.

Legacy `Frontend/platform` **не трогаем** — держим как источник истины поведения.

Планы и доска: `docs/MIGRATION_KANBAN.md`. Стратегия и фазы: `../PLATFORM_MIGRATION_PLAN.md`.
Гэп-анализ API: `../PHASE0_API_GAP.md`. Техдолг: `docs/TECH_DEBT.md` (`TD-NNN`).

## Технологии

- React 19
- TypeScript (strict)
- Vite 7
- Mantine 8 UI (`@mantine/core`, `@mantine/hooks`)
- Rich text: `@mantine/tiptap` (замена legacy `react-quill`)
- React Router 7
- TanStack Query 5
- Zustand 5 (session)
- React Hook Form 7 + Zod 4
- Orval для генерации API-клиентов (`education` + `identity`)

Не подключать Bootstrap. Не вводить i18n-библиотеку — строки UI хардкодятся на русском.

## Архитектурный подход

Feature-Sliced-lite (как в `sql-module-web`), без фанатичного дробления:

```text
src/
  app/       config, layout, providers, router
  pages/     <name>/{<Name>Page.tsx, index.ts}
  features/  <name>/{ui, model, api, lib}
  entities/  course, module, theory, practical, question, task, test-result, grade, user
  session/   store, guards, lib, model, ui   (перенос из sql-module-web)
  shared/    http, ui, lib, utils
  api/       education/*, identity/*          (сгенерировано Orval)
```

## Важные правила

- **ID сущностей — через path-параметры маршрута**, не через `useLocation().state`
  (в legacy было наоборот, из-за этого ломались deep-link и reload).
- Роль-гварды `RequireAuth` + `RequireRole([...])` на ветках `/admin`, `/teacher`, `/student`.
- Роли: `Admin`, `Teacher`, `Student` (claim `role`, id — claim `sub`). После логина —
  редирект на маршрут по роли. Не ломать вход через IdentityService.
- Перед новым визуальным паттерном проверять `src/shared/ui`.
- Числа из `Education` API приходят как `number | string` (.NET 10 union) — нормализовать
  в `entities/*/lib`, не тащить union в UI.
- Payload вопросов/ответов (4 типа) не менять — завязан на `QuestionScoringService` бэкенда.
- Файлы: multipart — через мутатор; скачивание — fetch + Bearer → `blob`, не голая `<a href>`.

## API и генерация

Клиенты генерируются Orval из `education.swagger.json` и `identity.swagger.json`.

```bash
npm run api:generate
```

Не редактировать вручную `src/api/education/**` и `src/api/identity/**`.
Поведение запросов менять в:

- `src/shared/http/education-fetch.ts`
- `src/shared/http/identity-fetch.ts`
- `src/shared/http/create-runtime-fetch.ts`
- `orval.config.ts`

При изменении контракта бэкенда: обновить swagger-файл → `npm run api:generate` →
`npm run typecheck` → `npm run build`.

## Runtime config

`public/runtime-config.json`, ключи: `educationApiUrl`, `identityApiUrl`, `basePath`.
Не хардкодить base URL сервисов в компонентах.

## Команды проверки

После правок:

```bash
npm run typecheck
npm run build
```

## Dev-сервер

Не поднимать без необходимости; если агент поднял для проверки — обязательно остановить.
Ручное тестирование фронта пользователь запускает сам. На Windows/PowerShell при блокировке
`npm.ps1` использовать `npm.cmd run dev`.

## Стиль работы

- Маленькие итерации, проект держать в собираемом состоянии после каждого шага.
- Не трогать unrelated-файлы, не удалять пользовательские изменения.
- Не смешивать бизнес-функциональность с чистым рефакторингом.
- Новые зависимости — только по явной необходимости.

## Без отдельного согласования нельзя

- Подключать Bootstrap или i18n-библиотеку.
- Удалять runtime config / Orval config.
- Менять base URL сервисов.
- Редактировать сгенерированные API-клиенты вручную.
- Трогать legacy `Frontend/platform`.
- Глобальный редизайн за пределами задачи.
