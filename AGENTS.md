# AGENTS.md

Инструкции для агентской разработки `platform-web`.

## Репозиторные skills

Перед работой загружать минимальный подходящий набор инструкций:

- [`focused-feature-flow`](.agents/skills/focused-feature-flow/SKILL.md) — экономный цикл реализации, таргетные проверки и единый финальный прогон;
- [`platform-web-development`](.agents/skills/platform-web-development/SKILL.md) — структура platform-web, роли, runtime config и API-клиенты;
- [`human-readable-code`](.agents/skills/human-readable-code/SKILL.md) — общий стандарт простого и понятного кода;
- [`react-typescript-readable-implementation`](.agents/skills/react-typescript-readable-implementation/SKILL.md) — правила React, TypeScript, состояния, hooks и компонентов;
- [`unsandboxed-codegen`](.agents/skills/unsandboxed-codegen/SKILL.md) — обязательный процесс для Orval и другой генерации кода вне песочницы.

При реализации frontend-фичи обычно применяются первые четыре skill. `unsandboxed-codegen` добавляется только при обновлении генерируемых артефактов. Явные правила этого файла имеют приоритет над общими рекомендациями skills.

## Что это за проект

Веб платформы **Scoodle** (LMS: курсы, модули, теория, практика, тесты, задания,
оценки, админка). Мигрирован со стека legacy (React 18 / JS / Bootstrap / axios)
на стек `Frontend/sql-module-web` и новый бэкенд `Education` API.

Миграция завершена (Phase 6, `PLT-020`). Legacy заморожен в
`Frontend/legacy/platform` — **не трогаем**, держим как источник истины поведения.

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
npm run test
```

Тесты — Vitest 3 + React Testing Library (`src/**/*.test.{ts,tsx}`, `test:watch` для
разработки). Инфраструктура: `vite.config.ts` (`test`), `src/test/*`.

`npm run build` включает бюджет-гейт бандла (`bundleBudget` в `vite.config.ts`):
превышение лимитов gzip (`initial graph`, `tiptap chunk` — `BUNDLE_BUDGETS`) роняет
сборку. Разбор состава: `ANALYZE=1 npm run build` → `dist/bundle-report.json` +
печать начального графа. Лимиты правятся осознанно вместе с записью `TD-002`.

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
- Трогать legacy `Frontend/legacy/platform`.
- Глобальный редизайн за пределами задачи.
