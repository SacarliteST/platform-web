# Kanban миграции `platform-web`

Актуализировано: 2026-09-03.

Единая доска миграции веба платформы Scoodle со стека legacy `Frontend/platform` на
стек `Frontend/sql-module-web` (React 19 / TS / Mantine / TanStack Query / Zustand /
RHF+Zod / Orval) и новый бэкенд `Education` API. Поконтурные доски (`Teacher` / `Student` /
`Admin`) будут выделены из этой доски позже, когда дойдём до соответствующих фаз.

Родственные документы:
- [`../../PLATFORM_MIGRATION_PLAN.md`](../../PLATFORM_MIGRATION_PLAN.md) — стратегия и фазы.
- [`../../PHASE0_API_GAP.md`](../../PHASE0_API_GAP.md) — гэп-анализ API, блокеры G1–G6.
- [`backend-requirements/2026-09-02-teacher-write-endpoints.md`](./backend-requirements/2026-09-02-teacher-write-endpoints.md) — handoff по блокерам.
- `TECH_DEBT.md` — заводится в PLT-015, ведёт только техдолг (`TD-NNN`), не задачи миграции.

## Цель

Полный перенос функционала платформы (курсы, модули, теория, практика, тесты, задания,
оценки, админка) на новый стек и новый бэкенд, с переходом на Bearer JWT от
IdentityService и path-параметры вместо `useLocation().state`. Legacy `Frontend/platform`
остаётся как источник истины и не удаляется.

## Правила ведения

- Постоянные ID: `PLT-NNN` (каркас/инфраструктура/cutover), `TEA-NNN` (преподаватель),
  `STU-NNN` (студент), `ADM-NNN` (администратор), `G-N` (бэкенд-блокеры `Education`).
- Статусы: `Backlog`, `Ready`, `In progress`, `Blocked`, `Done`.
- Одновременно в разработке одна пользовательская итерация.
- Фазы стартуют только по команде владельца.
- ID сущностей передаются через path-параметры маршрута, не через navigation state.
- Сгенерированный Orval-клиент вручную не редактируется.
- После изменения контракта backend: обновить Swagger, перегенерировать Orval, обновить доску.
- Гейт завершённой итерации: `npm run typecheck` + `npm run build`; для контуров — live smoke.
- UI на русском, строки хардкодятся в компонентах (i18n-библиотека не вводится — как в
  legacy и `sql-module-web`).
- Роль-гварды: `RequireAuth` + `RequireRole([...])` на ветках `/admin`, `/teacher`, `/student`.

## Доска

### Каркас и инфраструктура (Phase 1)

| ID | Задача | Приоритет | Статус | Зависимость | Результат |
|---|---|---|---|---|---|
| PLT-001 | Каркас проекта: Vite 7 + React 19 + TS strict, `tsconfig.*` из `sql-module-web` | P0 | In progress | Нет | Есть `tsconfig.*` / `vite.config.ts` / `index.html`; осталось `eslint.config.js` |
| PLT-002 | Bootstrap: `mount()`, `AppProviders` (Mantine, QueryClient, Router, RuntimeConfig) | P0 | Backlog | PLT-001 | `src/main.tsx` — заглушка; провайдеры не подключены |
| PLT-003 | Runtime config: `app-config`, `read-standalone-config`, `runtime-config-registry`, `public/runtime-config.json` (`educationApiUrl` + `identityApiUrl`) | P0 | Done | — | Готово 2026-09-02 |
| PLT-004 | Session-слой: перенос `session/*` из `sql-module-web` (zustand+persist, `decodeSessionUser`, `RequireAuth`, `RequireRole`, `LoginPage`) под IdentityService | P0 | In progress | PLT-002 | Готовы `model` / `decode-session-user` / `session-store` / `getDefaultSessionRoute`; осталось `RequireAuth` / `RequireRole` / `LoginPage` (нужны провайдеры и роутер) |
| PLT-005 | `shared/http`: `build-api-url`, `auth-header`, `create-runtime-fetch`, мутаторы `educationFetch` + `identityFetch` | P0 | Done | — | Готово 2026-09-02 |
| PLT-006 | Orval: конфиг на `education` + `identity`, генерация `src/api/*` | P0 | Done | — | `education.swagger.json` (56 путей, +G-1…G-6) и `identity.swagger.json`; `npm run api:generate` → `src/api/education` + `src/api/identity`; `tsc -b --noEmit` чист |
| PLT-007 | `shared/ui` перенос (`Page`/`PageHeader`/`PageBreadcrumbs`, `AppCard`, `EmptyState`, `ConfirmModal`, `FormActions`) + `AppLayout` (тёмная навигация, пункты по ролям) | P0 | Backlog | PLT-002 | Общий визуальный каркас платформы |
| PLT-008 | `AppRouter`: контуры `/admin` `/teacher` `/student`, `RequireAuth` + `RequireRole`, lazy | P0 | Backlog | PLT-004, PLT-007 | Разводка по ролям, deep-link работает после reload |
| PLT-015 | `AGENTS.md` + `docs/TECH_DEBT.md` (`TD-NNN`) + `docs/tech-debt/records/` для `platform-web` | P1 | Done | — | Готово 2026-09-02; доска техдолга заведена с TD-001…007 |
| PLT-016 | Live smoke каркаса: логин Identity → `/auth/me` Education → разводка ролей; `typecheck` + `build` | P0 | Backlog | PLT-008, PLT-006 | Каркас подтверждён на реальных сервисах |

### Общий слой (Phase 2)

| ID | Задача | Приоритет | Статус | Зависимость | Результат |
|---|---|---|---|---|---|
| PLT-009 | Единый UX ошибок: `ProblemDetails` / `HttpValidationProblemDetails`, helpers, `401 → clearSession` | P1 | Backlog | PLT-006 | Единый формат сообщений об ошибках |
| PLT-010 | Слой `entities` (`course/module/theory/practical/question/task/test-result/grade`): типы из DTO + RU-форматтеры + нормализаторы `number \| string` | P1 | Backlog | PLT-006 | Тонкие сущности без union-типов в UI |
| PLT-011 | `features/questions`: 4 типа (editor / viewer / answer-viewer) на TS + Mantine + RHF/Zod, payload по `QuestionScoringService`, 4 фикс. GUID типов | P0 | Backlog | PLT-006, PLT-010 | Переиспользуемый набор вопросов для обоих контуров |
| PLT-012 | `features/rich-text`: `@mantine/tiptap` (замена `RichTextEditor` + `ReadOnlyRichText`), совместимость Quill-HTML | P1 | Backlog | PLT-007 | Rich-text редактор и read-only просмотр |
| PLT-013 | Компоненты списков: замена `PaginatedData` (Query + Mantine `Pagination`), `MultiSelectSearch` / `AccordionMutiSelect` → Mantine `MultiSelect` | P1 | Backlog | PLT-007 | Списки и мультиселекты на Mantine |
| PLT-014 | Файлы: multipart-загрузка через мутатор, скачивание через fetch + Bearer → `blob` | P1 | Backlog | PLT-005 | Загрузка документов/сдач и защищённое скачивание |
| PLT-017 | Home-страницы по ролям + 404 + Help-контур (перенос статических разделов legacy) | P2 | Backlog | PLT-008 | Стартовые экраны и справка |

### Контур администратора (Phase 3) — перенос из `sql-module-web`, затем выпил оттуда

| ID | Задача | Приоритет | Статус | Зависимость | Результат |
|---|---|---|---|---|---|
| ADM-001 | Перенос `entities/user` + `entities/audit` из `sql-module-web` (типы, форматтеры, RU-ярлыки) | P0 | Backlog | PLT-006 | Общие сущности пользователя и аудита |
| ADM-002 | Перенос `features/admin-users` + `features/admin-contour` (списки, фильтры, формы создания / роли / блокировки) | P0 | Backlog | ADM-001 | Функциональные фичи управления пользователями |
| ADM-003 | Перенос страниц `admin-home` / `admin-users` / `admin-user-details` + маршруты `/admin`, `/admin/users`, `/admin/users/:userId` | P0 | Backlog | ADM-002, PLT-008 | Основные экраны администрирования пользователей |
| ADM-004 | Перенос `admin-events` (журнал аудита) + маршрут `/admin/events` | P1 | Backlog | ADM-001, ADM-003 | Журнал событий безопасности с фильтрами |
| ADM-005 | Перенос `admin-settings` (состояние сервисов; метрика = фактическая длительность запроса) + `/admin/settings` | P1 | Backlog | ADM-003 | Экран состояния платформы |
| ADM-006 | Адаптация навигации / layout / брендинга admin под `platform-web` | P1 | Backlog | ADM-003 | Контур визуально встроен в платформу |
| ADM-007 | `Education` `admin/profiles`: экран локальных учебных профилей + связка identity ↔ legacy (`GET/POST /admin/profiles`, `PUT /admin/profiles/{legacyUserId}`, `/deactivate`) | P0 | Backlog | ADM-003, PLT-006 | Управление учебными профилями платформы |
| ADM-008 | Перенос пользовательской документации администратора (`AdminGuide` из legacy help), если ведём справку | P3 | Backlog | PLT-017 | Справочный раздел администратора |
| ADM-009 | Live smoke admin: создание пользователя, смена роли, блок/разблок, связывание профиля, аудит | P0 | Backlog | ADM-001–ADM-007 | Контур подтверждён на реальных IdentityService + Education |
| ADM-010 | Выпил контура администратора из `sql-module-web` | P2 | Backlog | ADM-009 | Единственная реализация admin — в `platform-web` |
| ADM-011 | Назначение студентов на курсы и практики (`GET /courses/{id}/assignable-students`, `PUT /courses/{id}/students`; `GET /practicals/{id}/assignable-students`, `PUT /practicals/{id}/students`) — все `AdminOnly` | P0 | Backlog | ADM-003, PLT-006 | Экраны назначения студентов; бэкенд G-5/G-6 готов |

### Контур преподавателя (Phase 4)

| ID | Задача | Приоритет | Статус | Зависимость | Результат |
|---|---|---|---|---|---|
| TEA-001 | Каркас маршрутов и навигации Teacher (`/teacher`, `/teacher/courses`, `/teacher/courses/:courseId`, `/teacher/modules/:moduleId`, `/teacher/theories/:theoryId`, `/teacher/practicals/:practicalId`, `/teacher/practicals/:practicalId/tasks/:taskId`, `/teacher/practicals/:practicalId/protocols`), `TeacherContourTabs`, breadcrumbs | P0 | Backlog | PLT-008 | Все URL самостоятельны, работают после reload |
| TEA-002 | Список курсов + создание / удаление (`GET /courses/teacher`, `POST /courses`, `DELETE /courses/{courseId}`) | P0 | Backlog | TEA-001, PLT-010 | Список курсов, модалки создания и подтверждения удаления |
| TEA-003 | Страница курса: список модулей + создание / удаление модуля (`GET /courses/{courseId}/modules`, `POST /modules`, `DELETE /modules/{moduleId}`) | P0 | Backlog | TEA-002 | Модули курса с CRUD-минимумом |
| TEA-004 | ~~Назначение студентов на курс~~ → перенесено в контур администратора (`ADM-011`); write-эндпоинт `PUT /courses/{courseId}/students` сделан `AdminOnly` в срезе `AdminProfiles`, как и парный read | — | Done (перенос) | — | Снято с контура преподавателя |
| TEA-005 | Страница модуля: вкладки теория / практика / вопросы | P0 | Backlog | TEA-003 | Единая точка входа в наполнение модуля |
| TEA-006 | Теория: список, создание, удаление (`GET /modules/{moduleId}/theories`, `POST /theories`, `DELETE /theories/{theoryId}`) | P0 | Backlog | TEA-005 | Список теории модуля с созданием и удалением |
| TEA-007 | Редактор теории: заголовок + текст (rich-text) + ссылки CRUD + документы upload/delete (`PUT /theories/{id}/title`, `/text`; `POST/DELETE /theories/links`, `/theories/docs`) | P0 | Backlog | TEA-006, PLT-012, PLT-014 | Полное редактирование одного материала |
| TEA-008 | Банк вопросов модуля: список + создание / редактирование / удаление 4 типов (`GET /modules/{moduleId}/questions`, `POST /questions`, `PUT`/`DELETE /questions/{id}`) | P0 | Backlog | TEA-005, PLT-011 | CRUD вопросов всех типов с корректным payload |
| TEA-009 | Практика: список в модуле + создание + удаление (`GET /modules/{moduleId}/practicals`, `POST /practicals`, `DELETE /practicals/{id}`) | P0 | Backlog | TEA-005 | Список практик модуля; удаление доступно (G-4 готов) |
| TEA-010 | Настройка практики: выбор вопросов, попытки, пороги, публикация (`GET`/`PUT /practicals/{id}/questions`, `PUT /practicals/{id}/publish`). Назначение студентов вынесено в `ADM-011` | P0 | Backlog | TEA-009, PLT-011 | Практика настраивается и публикуется |
| TEA-011 | Задания практики: список + создание + удаление + правка текста (`GET`/`POST /practicals/{id}/tasks`; `DELETE /tasks/{id}`; `PUT /tasks/{id}/text`) | P0 | Backlog | TEA-009 | Полный CRUD заданий практики (G-1…G-3 готовы) |
| TEA-012 | Проверка сдач: список файлов по практике и по заданию, просмотр файла, комментарии, приём с оценкой (`GET /practicals/{id}/task-files`, `GET /tasks/{taskId}/files`, `POST /task-files/{id}/comments`, `PUT /task-files/{id}/accept`) | P0 | Backlog | TEA-011, PLT-014 | Экран проверки с комментариями и оценкой 2–5 |
| TEA-013 | Протоколы: список попыток студентов по практике + разбор результата (`GET /practicals/{id}/protocols/teacher`, `GET /test-results/{testResultId}/protocol`) | P0 | Backlog | TEA-010, PLT-011 | Журнал попыток и детальный протокол с ответами |
| TEA-014 | Единый UX ошибок / пустых / загрузочных состояний Teacher | P1 | Backlog | TEA-002–TEA-013 | Единообразные состояния во всём контуре |
| TEA-015 | Адаптивность и доступность Teacher | P1 | Backlog | TEA-002–TEA-013 | Клавиатура и ноутбучные разрешения |
| TEA-016 | Live smoke полного цикла авторинга | P0 | Backlog | TEA-001–TEA-015, G-1…G-6 | Happy path курс→…→протокол на реальном backend |
| TEA-017 | Route-level code splitting Teacher | P2 | Backlog | TEA-016 | Зафиксированные бюджеты chunks |

### Контур студента (Phase 5)

| ID | Задача | Приоритет | Статус | Зависимость | Результат |
|---|---|---|---|---|---|
| STU-001 | Каркас маршрутов и навигации Student (`/student`, `/student/courses`, `/student/courses/:courseId`, `/student/modules/:moduleId`, `/student/theories/:theoryId`, `/student/practicals/:practicalId`, `/student/practicals/:practicalId/protocols`), вкладки, lazy | P0 | Backlog | PLT-008 | Все URL самостоятельны, работают после reload |
| STU-002 | Список назначенных курсов (`GET /courses/student`) | P0 | Backlog | STU-001, PLT-010 | Список курсов с состояниями загрузки / ошибки / пустого |
| STU-003 | Страница курса студента: список модулей (`GET /courses/{courseId}/modules`) | P0 | Backlog | STU-002 | Модули выбранного курса |
| STU-004 | Страница модуля студента: теория, практики, итоговые оценки (`GET /modules/{moduleId}/theories`, `/practicals`; `GET /practicals/{id}/grade`) | P0 | Backlog | STU-003 | Обзор модуля с точками входа и оценками |
| STU-005 | Просмотр теории: read-only rich-text + ссылки + документы (`GET /theories/{theoryId}`, `/links`, `/docs`) | P0 | Backlog | STU-004, PLT-012, PLT-014 | Читаемый материал, защищённое скачивание документов |
| STU-006 | Практика — тест: статус → старт → вопросы → отправка (`GET /practicals/{id}/test-status`, `PUT /practicals/{id}/test/start`, `GET /practicals/{id}/test/questions`, `POST /practicals/{id}/test/submit`) | P0 | Backlog | STU-004, PLT-011 | Полный цикл прохождения теста с учётом попыток |
| STU-007 | Практика — задание: загрузка файла решения, замена файла, состояние (`GET /tasks/{taskId}/file`, `PUT /tasks/{taskId}/file`) | P0 | Backlog | STU-004, PLT-014 | Сдача задания файлом с заменой до принятия |
| STU-008 | Вьюеры ответов на вопросы (в протоколе и тесте) — 4 типа | P1 | Backlog | STU-006, PLT-011 | Единый показ вопроса и ответа студента |
| STU-009 | Протоколы студента: список своих попыток + разбор результата (`GET /practicals/{id}/protocols`, `GET /test-results/{testResultId}/protocol`) | P0 | Backlog | STU-006, STU-008 | История попыток текущего студента и детальный протокол |
| STU-010 | Итоговая оценка за практику (`GET /practicals/{id}/grade`) на экранах практики и модуля | P1 | Backlog | STU-004 | Понятное отображение теста + заданий + итога |
| STU-011 | Идемпотентная отправка теста и файла (защита от дублей) | P0 | Backlog | STU-006, STU-007 | Повтор одного запроса не создаёт дубли |
| STU-012 | Единый UX ошибок и ограничений Student (401/403/404/409/422/timeout, retry) | P1 | Backlog | STU-002–STU-011 | Безопасные единообразные сообщения |
| STU-013 | Адаптивность и доступность Student | P1 | Backlog | STU-002–STU-011 | Клавиатура, ноутбучные и мобильные разрешения |
| STU-014 | Lazy loading страниц студента и тяжёлых редакторов | P2 | Backlog | STU-001 | Контролируемые бюджеты стартового chunk |
| STU-015 | Live smoke студенческого сценария | P0 | Backlog | STU-001–STU-014 | Пройти тест + сдать задание + увидеть протокол и оценку |

### Cutover (Phase 6)

| ID | Задача | Приоритет | Статус | Зависимость | Результат |
|---|---|---|---|---|---|
| PLT-018 | Полный ручной регресс по 3 ролям против Education + IdentityService | P0 | Backlog | все контуры | Регресс-лист пройден |
| PLT-019 | Обновление `compose` / deploy на новый фронт | P1 | Backlog | PLT-018 | Новый фронт раздаётся вместо legacy |
| PLT-020 | Ретайр legacy `platform` → `Frontend/legacy/` (не удалять) | P2 | Backlog | PLT-019 | Legacy сохранён как источник истины, выведен из сборки |
| PLT-021 | `README.md` `platform-web` (запуск, build, runtime-config) | P2 | Backlog | PLT-016 | Входная документация проекта |

### Бэкенд-блокеры `Education` (владелец: backend) — **готово**

Реализованы в `Education` 2026-09-02 по эталону legacy `TeacherController`, срезами
Contracts → Application → Infrastructure → Web; покрыто 15 интеграционными тестами
(`tests/Education.Tests/Practicals/TeacherWriteEndpointsApiTests.cs`), полный прогон
77/77. Детали — в [handoff](./backend-requirements/2026-09-02-teacher-write-endpoints.md).

| ID | Работа | Политика | Статус | Разблокирует |
|---|---|---|---|---|
| G-1 | `POST /api/v1/practicals/{practicalId}/tasks` — создание задания | `TeacherOnly` | Done | TEA-011 |
| G-2 | `DELETE /api/v1/tasks/{taskId}` — удаление задания | `TeacherOnly` | Done | TEA-011 |
| G-3 | `PUT /api/v1/tasks/{taskId}/text` — правка текста задания | `TeacherOnly` | Done | TEA-011 |
| G-4 | `DELETE /api/v1/practicals/{practicalId}` — удаление практики | `TeacherOnly` | Done | TEA-009 |
| G-5 | `PUT /api/v1/courses/{courseId}/students` — назначение студентов на курс | `AdminOnly` ¹ | Done | ADM-011 |
| G-6 | `PUT /api/v1/practicals/{practicalId}/students` — назначение студентов на практику | `AdminOnly` ¹ | Done | ADM-011 |

¹ В legacy назначение студентов было под преподавателем. В новом бэкенде парные
read-эндпоинты `…/assignable-students` уже `AdminOnly` в срезе `AdminProfiles` —
write-эндпоинты сделаны там же и с той же политикой, чтобы read и write не разъезжались.
Если нужно вернуть под преподавателя — правка политики в `AdminProfilesEndpointGroup`
и переноса метода в `Practicals`/`Courses` срез.

## Этапы поставки

| Phase | Состав | Результат |
|---|---|---|
| **1. Скелет** | `PLT-001 → 002 → 003 → 004 → 005 → 006 → 007 → 008 → 015 → 016` | Логин через IdentityService, генерируемые клиенты, разводка по ролям, пустые контуры |
| **2. Общий слой** | `PLT-009 → 010 → 011 → 012 → 013 → 014 → 017` | Сущности, вопросы, rich-text, списки, файлы, стартовые экраны |
| **3. Администратор** | `ADM-001 … 009` | Управление пользователями, аудит, настройки, учебные профили |
| **4. Преподаватель** | `TEA-001 … 017` (блокеры `G-1…G-6`) | Полный цикл авторинга: курс → модуль → теория → вопросы → практика → задание → публикация → проверка → протокол |
| **5. Студент** | `STU-001 … 015` | Курсы → модуль → теория → тест → сдача задания → протокол → оценка |
| **6. Cutover** | `PLT-018 → 019 → 020 → 021` | Регресс, переключение деплоя, ретайр legacy, README |
| **7. Долг** | `TECH_DEBT.md` (`TD-NNN`) | Route-splitting, серверная пагинация, именованные enum в OpenAPI |

## Срез

- **Phase 0 завершена (2026-09-02).** Бэкенд-блокеры `G-1…G-6` реализованы; codegen-каркас
  `platform-web` поднят: `PLT-003` / `PLT-005` / `PLT-006` / `PLT-015` → Done, клиенты
  `education` + `identity` сгенерированы, `tsc` чист. Остаток Phase 1: `eslint.config.js`
  (`PLT-001`), `AppProviders` (`PLT-002`), `shared/ui` + `AppLayout` (`PLT-007`),
  `AppRouter` + гварды + `LoginPage` (`PLT-008` / `PLT-004`).
- **Репозитории (2026-09-03).** Бэк: `Education/` (github.com/SacarliteST/Education),
  ветка `master`, коммит `252c26f` — G-1…G-6. Фронт: `Frontend/platform-web/`
  (`git init`, ветка `master`), коммит `06a596c` — каркас. Не запушено. Корень `SQLTren/`
  намеренно не git.
- Критический путь Phase 1–2 не зависит ни от чего внешнего.
- Контур студента (Phase 5) полностью разблокирован — все эндпоинты есть.
- Контур администратора (Phase 3) — перенос из `sql-module-web`; риск только в
  расхождении версий Identity API (фиксируется свежим `identity.swagger.json`). Новая
  работа — `ADM-007` (учебные профили `Education`).
- Бэкенд-задачи `G-1…G-6` реализованы (2026-09-02) — контур преподавателя (Phase 4)
  разблокирован полностью. Назначение студентов вынесено в контур администратора
  (`ADM-011`, `AdminOnly`).
- Поконтурные доски выделяются из этой при старте Phase 3/4/5.
