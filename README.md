# platform-web

Веб-приложение платформы **Scoodle** (LMS: курсы, модули, теория, практики, тесты,
задания, оценки, администрирование пользователей и учебных профилей).

Заменяет legacy-веб (React 18 / Bootstrap / axios, старый монолит), заморожённый
после cutover в `Frontend/legacy/platform`.
Работает против бэкенда **Education API** (`/api/v1`, Bearer JWT от **IdentityService**).

## Стек

React 19 · TypeScript strict · Vite 7 · Mantine 8 · TanStack Query 5 · Zustand 5 ·
React Hook Form 7 + Zod 4 · React Router 7 · `@mantine/tiptap` · Orval (кодоген API).

Архитектура — Feature-Sliced-lite: `app/` · `pages/` · `features/` · `entities/` ·
`session/` · `shared/` · `api/` (сгенерировано). Подробности — `AGENTS.md`.

## Требования

- Node.js 20+
- Запущенные **IdentityService** и **Education API** (для входа и данных)
- Postgres для Education поднимается из `../../Backend/compose.yaml`
  (`docker compose up -d education-postgres`, хост-порт `5434`)

## Запуск (dev)

```bash
npm install
npm run dev
```

Дев-сервер: <http://localhost:5173>. На Windows/PowerShell при блокировке `npm.ps1` —
`npm.cmd run dev`.

Учётки для локального прогона (IdentityService dev-сиды):

| Роль | E-mail | Пароль |
|---|---|---|
| Admin | `admin@scoodle.local` | `Admin1234` |
| Teacher | `teacher@scoodle.local` | `Teacher1234` |
| Student | `student@scoodle.local` | `Student1234` |

Teacher/Student должны быть привязаны к пользователю Education (таблица
`IdentityUserLink`). Привязка — экран **Администратор → Учебные профили**
(`/admin/profiles`, `POST /api/v1/admin/profiles`). Назначение студентов на
курсы/практики пока делается только через API (`PUT /api/v1/courses/{id}/students`,
`PUT /api/v1/practicals/{id}/students`) — см. `ADM-011` / `TD-008`.

## Сборка и предпросмотр

```bash
npm run typecheck   # tsc -b --noEmit
npm run build        # tsc -b && vite build  ->  dist/
npm run preview      # раздать dist/ локально
```

## Runtime-конфигурация

Базовые URL сервисов **не хардкодятся** — читаются в рантайме из
`public/runtime-config.json` (в проде — `dist/runtime-config.json`, отдаётся
без кэша):

```json
{
  "educationApiUrl": "http://localhost:5135",
  "identityApiUrl": "http://localhost:5101",
  "basePath": "/"
}
```

Один и тот же билд разворачивается в любом окружении — достаточно подменить этот
файл. Fallback до чтения файла — переменные сборки `VITE_EDUCATION_API_URL`,
`VITE_IDENTITY_API_URL`, `VITE_BASE_PATH` (см. `src/app/config/read-standalone-config.ts`).

## Генерация API-клиентов

```bash
npm run api:generate   # orval: education.swagger.json + identity.swagger.json -> src/api/**
```

`src/api/education/**` и `src/api/identity/**` **вручную не редактировать**.
Поведение запросов — в `src/shared/http/{education,identity}-fetch.ts`,
`create-runtime-fetch.ts`, `orval.config.ts`.

При изменении контракта бэкенда: обновить swagger-файл → `npm run api:generate` →
`npm run typecheck` → `npm run build`.

## Docker (прод-раздача статики)

```bash
docker compose up -d --build        # nginx со SPA-fallback, порт 8080
# правка dist/runtime-config.json смонтированным файлом — без пересборки образа
```

Подробности — `Dockerfile`, `nginx.conf`, `compose.yaml`.

## Документация

- `docs/MIGRATION_KANBAN.md` — единая доска миграции (`PLT-` / `ADM-` / `TEA-` / `STU-` / `G-`)
- `docs/PLATFORM_MIGRATION_PLAN.md` — стратегия и фазы
- `docs/PHASE0_API_GAP.md` — гэп-анализ API legacy → Education
- `docs/REGRESSION.md` — регрессионный чек-лист по трём ролям
- `docs/TECH_DEBT.md` + `docs/tech-debt/records/TD-*` — технический долг
- `AGENTS.md` — конвенции разработки
