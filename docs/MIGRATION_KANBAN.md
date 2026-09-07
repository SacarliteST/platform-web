# Kanban миграции `platform-web`

Актуализировано: 2026-09-03.

Единая доска миграции веба платформы Scoodle со стека legacy `Frontend/platform` на
стек `Frontend/sql-module-web` (React 19 / TS / Mantine / TanStack Query / Zustand /
RHF+Zod / Orval) и новый бэкенд `Education` API. Поконтурные доски (`Teacher` / `Student` /
`Admin`) будут выделены из этой доски позже, когда дойдём до соответствующих фаз.

Родственные документы:
- [`./PLATFORM_MIGRATION_PLAN.md`](./PLATFORM_MIGRATION_PLAN.md) — стратегия и фазы.
- [`./PHASE0_API_GAP.md`](./PHASE0_API_GAP.md) — гэп-анализ API, блокеры G1–G6.
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
| PLT-001 | Каркас проекта: Vite 7 + React 19 + TS strict, `tsconfig.*` из `sql-module-web` | P0 | Done | — | `tsconfig.*` / `vite.config.ts` / `index.html`. ESLint не заводим — в `sql-module-web` его нет (нет ни конфига, ни `lint`-скрипта). |
| PLT-002 | Bootstrap: `mount()`, `AppProviders` (Mantine, QueryClient, Router, RuntimeConfig) | P0 | Done | — | `app/mount.tsx` + `app/App.tsx` + `providers/{AppProviders,runtime-config-store}`; `main.tsx` монтирует реально. `build` зелёный (2026-09-03) |
| PLT-003 | Runtime config: `app-config`, `read-standalone-config`, `runtime-config-registry`, `public/runtime-config.json` (`educationApiUrl` + `identityApiUrl`) | P0 | Done | — | Готово 2026-09-02 |
| PLT-004 | Session-слой: перенос `session/*` из `sql-module-web` (zustand+persist, `decodeSessionUser`, `RequireAuth`, `RequireRole`, `LoginPage`) под IdentityService | P0 | Done | — | `model` / `lib` (+`session-user-from-token-response`) / `store` / `guards` / `ui/LoginPage` (`useLogin` Identity) / `providers`; `session/index.ts` полный |
| PLT-005 | `shared/http`: `build-api-url`, `auth-header`, `create-runtime-fetch`, мутаторы `educationFetch` + `identityFetch` | P0 | Done | — | Готово 2026-09-02 |
| PLT-006 | Orval: конфиг на `education` + `identity`, генерация `src/api/*` | P0 | Done | — | `education.swagger.json` (56 путей, +G-1…G-6) и `identity.swagger.json`; `npm run api:generate` → `src/api/education` + `src/api/identity`; `tsc -b --noEmit` чист |
| PLT-007 | `shared/ui` перенос (`Page`/`PageHeader`/`PageBreadcrumbs`, `AppCard`, `EmptyState`, `ConfirmModal`, `FormActions`, `ContourHeader`) + `AppLayout` (тёмная навигация, пункты по ролям) | P0 | Done | — | Все компоненты + `AppLayout` (Scoodle / «Платформа обучения», пункты Админ/Препод/Студент по ролям) |
| PLT-008 | `AppRouter`: контуры `/admin` `/teacher` `/student`, `RequireAuth` + `RequireRole` | P0 | Done | — | `AppRouter` под `AppLayout`: `/`, `/login`, `/admin` `/teacher` `/student` (гварды) + `*`; заглушки контуров `*-home`. Lazy — отложено до появления тяжёлых страниц (Phase 4/5) |
| PLT-015 | `AGENTS.md` + `docs/TECH_DEBT.md` (`TD-NNN`) + `docs/tech-debt/records/` для `platform-web` | P1 | Done | — | Готово 2026-09-02; доска техдолга заведена с TD-001…007 |
| PLT-016 | Live smoke каркаса: логин Identity → разводка ролей | P0 | Done | — | Смоук 2026-09-03: логин через IdentityService (`POST /auth/login` 200, CORS ok), разводка admin/teacher/student по `getDefaultSessionRoute`, `RequireRole` (student→`/admin` = «Нет доступа»), logout → `/login`, 401 → `clearSession`. Education-часть (`/auth/me`) не проверялась — см. ниже |

### Общий слой (Phase 2)

| ID | Задача | Приоритет | Статус | Зависимость | Результат |
|---|---|---|---|---|---|
| PLT-009 | Единый UX ошибок: `ProblemDetails` / `HttpValidationProblemDetails`, helpers, `401 → clearSession` | P1 | Done | — | `shared/lib/education-problem-details` (title/message/field errors по статусу) + `shared/lib/index`; `401 → clearSession` в `create-runtime-fetch` |
| PLT-010 | Слой `entities` (`course/module/theory/practical/question/task/test-result/grade`): типы из DTO + RU-форматтеры + нормализаторы `number \| string` | P1 | Done | — | 8 сущностей; `toNumber`/`toNullableNumber`; `question` — 4 фикс. GUID + `QuestionKind` + RU-ярлыки; `formatGrade`, `formatCourseDate`, `normalizePracticalSetup` / `normalizeTestProtocol` / `normalizeTestStatus` / `normalizePracticalGrade` |
| PLT-011 | `features/questions`: 4 типа (editor / answer-input / answer-view) на TS + Mantine + Zod, payload по `QuestionScoringService`, 4 фикс. GUID типов | P0 | Done | — | `model/{payload,schema,transform}` — `body`/`answer` JSON точно по контракту бэкенда и legacy; `ui/{QuestionEditor, QuestionAnswerInput, QuestionAnswerView}` (все 4 вида) |
| PLT-012 | `features/rich-text`: `@mantine/tiptap` (замена `RichTextEditor` + `ReadOnlyRichText`), совместимость Quill-HTML | P1 | Done | — | `RichTextField` (tiptap StarterKit + Link, тулбар) + `RichTextViewer` (`TypographyStylesProvider`). Зависимости: `@mantine/tiptap` + `@tiptap/{react,pm,starter-kit,extension-link}`. Проверка Quill→tiptap HTML на реальных данных — `TD-006` |
| PLT-013 | Компоненты списков: `QueryBoundary` (loading/error/empty вместо `PaginatedData`); `MultiSelectSearch` / `AccordionMutiSelect` → Mantine `MultiSelect` напрямую | P1 | Done | — | `shared/ui/QueryBoundary`; серверная пагинация — `TD-003` |
| PLT-014 | Файлы: multipart-загрузка (Orval строит `FormData`, мутатор не ставит `Content-Type`), скачивание через fetch + Bearer → `blob` | P1 | Done | — | `shared/http/download-file` (`downloadEducationFile`, парсинг `content-disposition`, 401 → `clearSession`) |
| PLT-017 | Home-страницы по ролям + 404 + Help-контур | P2 | Done | — | Home / 404 / `*-home` заглушки (Phase 1); `pages/help/HelpPage` (аккордеон 7 разделов, сжатый текст) + `/help` + пункт навигации. Полный перенос legacy-прозы — по мере надобности |

### Контур администратора (Phase 3) — перенос из `sql-module-web`

> Выпил контура администратора из `sql-module-web` — **вне зоны ответственности этой миграции**
> (владелец `sql-module-web` делает отдельно). Здесь только перенос.

| ID | Задача | Приоритет | Статус | Зависимость | Результат |
|---|---|---|---|---|---|
| ADM-001 | Перенос `entities/user` + `entities/audit` из `sql-module-web` (типы, форматтеры, RU-ярлыки) | P0 | Done | — | `entities/user` (`AppUser*` + форматтеры) и `entities/audit` (`formatAuditEventType`, `auditEventTypeOptions`) перенесены вербатимом |
| ADM-002 | Перенос `features/admin-users` + `features/admin-contour` (списки, фильтры, формы создания / роли / блокировки) | P0 | Done | — | `features/admin-users` (api-команды + `AdminUsersApiError` + helpers) вербатимом; `features/admin-contour` — `AdminContourTabs` адаптирован (вкладки Обзор / Пользователи / Аудит / Учебные профили / Настройки; `dictionaries` убран); `getIdentityProblemFieldErrors` добавлен в `shared/lib` |
| ADM-003 | Перенос страниц `admin-home` / `admin-users` / `admin-user-details` + маршруты `/admin`, `/admin/users`, `/admin/users/:userId` | P0 | Done | — | `AdminUsersPage` + `AdminUserDetailsPage` перенесены; `AdminHomePage` — лёгкая версия платформы (не 401-строчный SQL-дашборд); маршруты в `AppRouter` под `RequireRole(['Admin'])` |
| ADM-004 | Перенос `admin-events` (журнал аудита) + маршрут `/admin/events` | P1 | Done | — | `AdminEventsPage` перенесён вербатимом (фильтры инициатор/объект/тип/даты, пагинация, ссылки на карточки пользователей); `/admin/events` |
| ADM-005 | `admin-settings` (адреса сервисов из runtime config + живой health-check) + `/admin/settings` | P1 | Done | — | `AdminSettingsPage` — своя реализация: `useRuntimeConfig` для адресов + кнопка «Проверить сервисы» (fetch `/health` Education и `/.well-known/openid-configuration` Identity с фактической задержкой) |
| ADM-006 | Адаптация навигации / layout / брендинга admin под `platform-web` | P1 | Done | — | `AdminContourTabs` (5 вкладок) + все admin-маршруты в `AppRouter` под `RequireRole(['Admin'])`: `/admin`, `/users`, `/users/:userId`, `/events`, `/profiles`, `/settings` |
| ADM-007 | `Education` `admin/profiles`: экран локальных учебных профилей + связка identity ↔ legacy | P0 | Done | — | `AdminProfilesPage` — список профилей (`useGetAdminProfiles`), модалка «Связать пользователя» (`useCreateAdminProfile`), «Отвязать» (`useDeactivateAdminProfile`). Правка данных профиля (`useUpdateAdminProfile`) — по мере надобности |
| ADM-008 | Перенос пользовательской документации администратора (`AdminGuide` из legacy help), если ведём справку | P3 | Backlog | PLT-017 | Справочный раздел администратора |
| ADM-009 | Live smoke admin: создание пользователя, смена роли, блок/разблок, связывание профиля, аудит | P0 | Done | — | **Смоук 2026-09-03 — весь контур PASS.** Через IdentityService: список/фильтры/пагинация, создание пользователя, смена ролей (204 + событие в аудите), блок с причиной → статус ЗАБЛОКИРОВАН, разблок, журнал аудита с RU-бейджами, настройки + живой health-check (Education `/health` 200, Identity discovery 200). Через Education API: `/auth/me` → 200, `AdminProfilesPage` — список, «Связать пользователя» (201), «Отвязать» (204). Побочно вскрыл и исправил **3 бага бэкенда Education** (JWT-конфиг, непереводимый LINQ в `GetProfilesAsync`, отсутствие бутстрапа схемы БД) — коммиты `2f63af0`, `1f5e443`. Фронт корректен |
| ADM-011 | ~~Назначение студентов на курсы и практики (админ)~~ | — | **Закрыто — не релевантно** (2026-09-07) | — | Владелец: назначение студентов на курс/практику — **функция преподавателя** (как в legacy `api/Teacher/UpdateCourseStudents` / `UpdatePracticalStudents`). Перенос в контур админа (Phase 3) был ошибочным. Реальная задача — `TEA-004` / `TEA-004a` (см. ниже). |

### Контур преподавателя (Phase 4)

| ID | Задача | Приоритет | Статус | Зависимость | Результат |
|---|---|---|---|---|---|
| TEA-001 | Каркас маршрутов и навигации Teacher (вложенные path-параметры, хлебные крошки) | P0 | Done | — | Маршруты `/teacher`, `/teacher/courses`, `/teacher/courses/:courseId`, `/teacher/courses/:courseId/modules/:moduleId` под `RequireRole(['Teacher'])`; навигация через `PageBreadcrumbs` (отдельный `TeacherContourTabs` не нужен) |
| TEA-002 | Список курсов + создание / удаление (`GET /courses/teacher`, `POST /courses`, `DELETE /courses/{courseId}`) | P0 | Done | — | `TeacherCoursesPage`: карточки курсов, модалка создания (RHF+Zod), подтверждение удаления |
| TEA-003 | Страница курса: список модулей + создание / удаление модуля (`GET /courses/{courseId}/modules`, `POST /modules`, `DELETE /modules/{moduleId}`) | P0 | Done | — | `TeacherCoursePage`: имя курса из списка, список модулей, создание/удаление модуля |
| TEA-004 | Назначение студентов на курс (преподаватель) | P0 | **Reopened** (2026-09-07) | Education: сменить политику | Возврат в контур преподавателя (перенос в `ADM-011` отменён владельцем). **Education:** `GET`/`PUT /courses/{courseId}/students` + `GET .../assignable-students` → `AdminOnly` → **`TeacherOnly` + проверка владельца курса** (`Course.UserId`); re-export OpenAPI + Orval. **platform-web:** вкладка «Студенты» на `TeacherCoursePage` — `assignable-students` (`{legacyUserId, fullName, isAssigned}`) → чекбоксы → `PUT` полным списком. |
| TEA-004a | Назначение студентов на практику (преподаватель) | P0 | **New** (2026-09-07) | TEA-004 | Аналогично: `GET`/`PUT /practicals/{practicalId}/students` + `assignable-students` → `TeacherOnly` + владелец практики (`IsPracticalOwnerAsync`). platform-web: вкладка «Студенты» на `TeacherPracticalPage` (для `kind=internal`; для `external` — тот же гейт по назначению нужен модульным сессиям). |
| TEA-005 | Страница модуля: вкладки теория / практика / вопросы | P0 | Done | — | `TeacherModulePage`: вкладки Теория / Вопросы / Практики |
| TEA-006 | Теория: список, создание, удаление (`GET /modules/{moduleId}/theories`, `POST /theories`, `DELETE /theories/{theoryId}`) | P0 | Done | — | Вкладка «Теория» (`ModuleSubList`): список, создание, удаление |
| TEA-007 | Редактор теории: заголовок + текст (rich-text) + ссылки CRUD + документы upload/delete (`PUT /theories/{id}/title`, `/text`; `POST/DELETE /theories/links`, `/theories/docs`) | P0 | Done | — | `TeacherTheoryPage`: заголовок + текст (`RichTextField`) + ссылки CRUD + документы (upload / `downloadEducationFile` / удалить) |
| TEA-008 | Банк вопросов модуля: список + создание / редактирование / удаление 4 типов (`GET /modules/{moduleId}/questions`, `POST /questions`, `PUT`/`DELETE /questions/{id}`) | P0 | Done | — | Список (`normalizeQuestion`), создание и **редактирование** через `QuestionEditor` (`questionToFormValues`: JSON `answer` → значения формы), удаление. Все 4 типа |
| TEA-009 | Практика: список в модуле + создание + удаление (`GET /modules/{moduleId}/practicals`, `POST /practicals`, `DELETE /practicals/{id}`) | P0 | Done | — | Вкладка «Практики» (`ModuleSubList`): список, создание, удаление (G-4) |
| TEA-010 | Настройка практики: выбор вопросов, попытки, пороги, публикация (`GET`/`PUT /practicals/{id}/questions`, `PUT /practicals/{id}/publish`). Назначение студентов — отдельная задача `TEA-004a` | P0 | Done | — | Вкладка «Настройка» в `TeacherPracticalPage`: выбор вопросов, попытки, пороги, публикация |
| TEA-011 | Задания практики: список + создание + удаление + правка текста (`GET`/`POST /practicals/{id}/tasks`; `DELETE /tasks/{id}`; `PUT /tasks/{id}/text`) | P0 | Done | — | Вкладка «Задания»: создание / правка текста / удаление (G-1…G-3) |
| TEA-012 | Проверка сдач: список файлов по практике и по заданию, просмотр файла, комментарии, приём с оценкой (`GET /practicals/{id}/task-files`, `GET /tasks/{taskId}/files`, `POST /task-files/{id}/comments`, `PUT /task-files/{id}/accept`) | P0 | Done | — | Вкладка «Сдачи»: скачивание файла, комментарий, приём с оценкой 2–5 |
| TEA-013 | Протоколы: список попыток студентов по практике + разбор результата (`GET /practicals/{id}/protocols/teacher`, `GET /test-results/{testResultId}/protocol`) | P0 | Done | — | Вкладка «Протоколы»: список попыток + разбор ответов |
| TEA-014 | Единый UX ошибок / пустых / загрузочных состояний Teacher | P1 | Done | — | Единые `QueryBoundary` / `ConfirmModal` / `EmptyState` / `FormActions` во всех страницах контура |
| TEA-015 | Адаптивность и доступность Teacher | P1 | Done | — | Mantine responsive-props + `aria-label` на иконочных кнопках |
| TEA-016 | Live smoke полного цикла авторинга | P0 | Done | TEA-001–TEA-015 | Живой прогон 2026-09-03 на Education :5135 + IdentityService :5101. Привязал `teacher@` / `student@` к Education `User` через `AdminProfilesPage`. Прошло: курс → модуль → теория (заголовок/текст tiptap/ссылка) → вопросы (создание всех 4 типов, правка через `questionToFormValues`, удаление) → практика → настройка (выбор вопросов + пороги + сохранение) → публикация → задания (создание / правка текста / удаление). Вкладки «Сдачи» / «Протоколы» — корректный пустой стейт. Баг найден и исправлен: `QuestionEditor` падал (`event.currentTarget` = null) из-за чтения события внутри updater-функций `setState` при двойном вызове в StrictMode — вынес 4 чтения наружу |
| TEA-017 | Route-level code splitting Teacher | P2 | Done | — | `React.lazy` для admin/teacher страниц + vite `manualChunks`; предупреждение >500 kB устранено |

### Контур студента (Phase 5)

| ID | Задача | Приоритет | Статус | Зависимость | Результат |
|---|---|---|---|---|---|
| STU-001 | Каркас маршрутов и навигации Student, вкладки, lazy | P0 | Done | PLT-008 | Вложенная схема (как у преподавателя, т.к. нет detail-эндпоинтов модуля/практики): `/student`, `/student/courses`, `/student/courses/:courseId`, `/.../modules/:moduleId`, `/.../theories/:theoryId`, `/.../practicals/:practicalId`. `StudentRoute` = `RequireAuth` + `RequireRole(['Student'])` + `<Lazy>`. Все URL самостоятельны, работают после reload |
| STU-002 | Список назначенных курсов (`GET /courses/student`) | P0 | Done | STU-001, PLT-010 | `StudentCoursesPage`: `useGetStudentCourses`, карточки, `QueryBoundary` (загрузка / ошибка / пусто) |
| STU-003 | Страница курса студента: список модулей (`GET /courses/{courseId}/modules`) | P0 | Done | STU-002 | `StudentCoursePage`: имя курса из списка `student`-курсов, модули таблицей |
| STU-004 | Страница модуля студента: теория, практики, итоговые оценки | P0 | Done | STU-003 | `StudentModulePage`: вкладки Теория / Практики; в строке практики бейдж итоговой оценки (`PracticalGradeBadge` → `useGetPracticalGrade`) |
| STU-005 | Просмотр теории: read-only rich-text + ссылки + документы | P0 | Done | STU-004, PLT-012, PLT-014 | `StudentTheoryPage`: `RichTextViewer` (без tiptap-рантайма), ссылки-якоря, защищённое скачивание документов через `downloadEducationFile` |
| STU-006 | Практика — тест: статус → старт → вопросы → отправка | P0 | Done | STU-004, PLT-011 | `StudentPracticalPage` вкладка «Тест»: `useGetTestStatus` → `useStartTest` → `useGetTestQuestions` → `useSubmitTest`; ввод ответов через `QuestionAnswerInput` (все 4 типа); `isCompleted` → экран «Тест завершён» |
| STU-007 | Практика — задание: загрузка файла решения, замена, состояние | P0 | Done | STU-004, PLT-014 | Вкладка «Задания»: на задачу — `StudentTaskCard` (`useGetStudentTaskFile` 200/404, статус/оценка/комментарии) + `FileButton` → `useUploadStudentTaskFile`; замена доступна пока `!isAccepted` |
| STU-008 | Вьюеры ответов на вопросы — 4 типа | P1 | Done | STU-006, PLT-011 | `QuestionAnswerInput` в тесте покрывает все 4 типа. Разбор протокола — плоская таблица (в `TestProtocolAnswerResponse` нет `body`/`type` вопроса, богатый вьюер не построить) |
| STU-009 | Протоколы студента: список своих попыток + разбор результата | P0 | Done | STU-006, STU-008 | Вкладка «Протоколы»: `useGetStudentPracticalProtocols` + `useGetTestProtocol` (вопрос / ответ студента / балл / верно-неверно) |
| STU-010 | Итоговая оценка за практику на экранах практики и модуля | P1 | Done | STU-004 | Бейдж в списке практик модуля + вкладка «Оценка» (`formatGrade` + список условий из `messages`) |
| STU-011 | Идемпотентная отправка теста и файла (защита от дублей) | P0 | Done | STU-006, STU-007 | Кнопка отправки теста `disabled` во время запроса и после завершения (`submitted` / `isCompleted`); файл — через мьютацию, замена закрыта после `isAccepted` |
| STU-012 | Единый UX ошибок и ограничений Student | P1 | Done | STU-002–STU-011 | `QueryBoundary` на всех запросах + inline `Alert` на мьютациях; та же планка, что у контура преподавателя |
| STU-013 | Адаптивность и доступность Student | P1 | Done | STU-002–STU-011 | Responsive-props Mantine (`SimpleGrid cols`, `wrap`), нативная семантика Mantine-компонентов |
| STU-014 | Lazy loading страниц студента | P2 | Done | STU-001 | `React.lazy` для всех student-страниц; отдельные chunks (`test-results`, `grades`), tiptap-рантайм в контур не входит |
| STU-015 | Live smoke студенческого сценария | P0 | Done | STU-001–STU-014 | Живой прогон 2026-09-03 на Education :5135 + IdentityService :5101, ноль JS-ошибок. Через API назначил `student@` на курс/практику (`PUT /courses/{id}/students`, `PUT /practicals/{id}/students`, оба 204 — админ-UI для этого нет, `ADM-011`). Прошло: курсы → курс → модуль → теория (текст/ссылка) → практика: тест старт→2 вопроса (`QuestionAnswerInput`: чекбоксы + радио)→отправка «Оценка 5 (2/2)»; повторный старт → «попытки исчерпаны»; задание — пустой стейт (404) → загружено (badge «На проверке» + системный коммент) → принято преподавателем (badge «Принято (оценка 5)», кнопка замены исчезла, коммент преподавателя); протоколы — список #1 + разбор (оба «Верно»); оценка — «Отлично»; бейдж оценки в списке практик модуля обновился. Косметика: в разборе протокола «Ваш ответ» показывает сырой id варианта — `TD-010` |

### Cutover (Phase 6)

| ID | Задача | Приоритет | Статус | Зависимость | Результат |
|---|---|---|---|---|---|
| PLT-018 | Полный ручной регресс по 3 ролям против Education + IdentityService | P0 | Done | все контуры | `docs/REGRESSION.md` — чек-лист по 3 ролям + сквозной кросс-ролевой сценарий, прогон 2026-09-03 PASS (свод smoke `ADM-009` / `TEA-016` / `STU-015` + перепроверка на закрытии фазы: все 4 экрана админа с данными, курсы/модуль/практика преподавателя, сдача студента видна преподавателю как «Принято»). Известные дефекты сведены в конце листа (`TD-009`, `TD-010`, `ADM-011`) |
| PLT-019 | Прод-раздача статики нового фронта | P1 | Done | PLT-018 | `Dockerfile` (multi-stage node build → nginx), `nginx.conf` (SPA-fallback, no-cache для `runtime-config.json` и `index.html`, иммутабельный кэш `/assets/`), `.dockerignore`, `compose.yaml` (`docker compose up -d --build` → :8080), `runtime-config.prod.json` (монтируется поверх образа — окружение без пересборки). `Backend/compose.yaml` не трогали (там только БД) |
| PLT-020 | Ретайр legacy `platform` → `Frontend/legacy/` (не удалять) | P2 | Done | PLT-019 | `Frontend/platform` → `Frontend/legacy/platform` (обычный `mv`, git-репо внутри нет, обратимо). `Frontend/legacy/README.md` — заморозка + инструкция отката. Ссылки в `AGENTS.md` / `README.md` обновлены |
| PLT-021 | `README.md` `platform-web` (запуск, build, runtime-config) | P2 | Done | PLT-016 | `README.md`: стек, dev-запуск, учётки, привязка Teacher/Student, сборка, runtime-config, кодоген Orval, Docker, ссылки на доки |

### Подключение практических модулей (Phase 7)

Дизайн — `docs/MODULE_INTEGRATION.md` (**концепт пересмотрен 2026-09-05**, коммит
`7cd72d1`). Решения владельца: UI модуля — тот же origin под путём
(`/modules/<slug>/`, единый nginx); переход — замена вкладки, возврат по
каноническому `returnUrl` от ядра; **две задачи доверия** — (1) модуль верит «это
студент X» через `module_access_token` (Token Exchange, `aud=sql-module-api`,
claim `session_id`, во фрагменте URL); (2) платформа верит «оценка/лог от сессии
S» через один `session_key` (в браузер не уходит). Education **пушит** сессию
бэкенду модуля при старте (обратного `attach` нет). **Оценка — HTTP** `POST
/module-sessions/{id}/complete`; **Kafka — только лог** действий (топик
`scoodle.practice.events`, дедуп по `eventId`; `completion`-топик не используется).
**Оценку ставит модуль** (`grade` 0..100, ядро не считает). **1 задание на внешнюю
практику** (MVP). **Повторные попытки — есть**: `triesCount` списывается на старте
(вкл. `EXPIRED`), время попытки задаёт преподаватель (`timeLimitMinutes`, или без
лимита + потолок 24 ч), «Прервать попытку» → `EXPIRED`, продолжение живой
`ACTIVE`-сессии вместо `409`; итог — `MAX(grade)` по `COMPLETED`. standalone
SqlModule — два deployment-профиля (`platform`/`standalone`), общий инстанс позже.
Пилот — SQL-модуль. Порядок: контракт Education → IdentityService (Token Exchange
+ claim `session_id`) → Kafka в dev → бэкенд Education → platform-web →
sql-module-web → SqlModule → сквозной smoke.

**✅ Контур Education готов (2026-09-06).** `MOD-002c` + `MOD-005…008a` реализованы
и покрыты тестами (см. строки ниже). Backend-команда SqlModule разблокирована
полностью — `SQLI-002…017` у них Done, остаётся `/launch`/возврат/тесты. Актуальное
ТЗ модуля (as-built контракты) —
[`2026-09-05-sql-module-integration.md`](./backend-requirements/2026-09-05-sql-module-integration.md).
Весь backend Education под интеграцию — включая `MOD-006b`/`MOD-012a` — закрыт.
OpenAPI экспортирован, Orval-клиент `platform-web` перегенерирован (коммит `359c517`,
`src/api/education/{module-sessions,practical-modules}`, typecheck+build зелёные).
Экраны `MOD-009…012` готовы (коммиты `540f579`/`76de53e`/`0f6e19b`/`aa918bb`).

OpenAPI ре-экспортирован, Orval перегенерирован (коммит `465af1d`): добавлены
`GET .../module-sessions` (`MOD-012b`) и `409` на `PUT .../module` (Education
`981a356` — `.Produces(409)`). Оба временных костыля убраны — `TeacherSessionProtocols`
на сгенерированном `useListPracticalModuleSessions`, `TeacherExternalPractical` без
каста `status`.

Дальше — только `MOD-015` (инфра, nginx).

| ID | Задача | Приоритет | Статус | Зависимость | Результат |
|---|---|---|---|---|---|
| MOD-001 | Дизайн механизма подключения (Host–Plugin, редирект, Kafka-лог, Token Exchange, ретраи) | P0 | Done | — | `docs/MODULE_INTEGRATION.md` — **концепт пересмотрен 2026-09-05** (коммит `7cd72d1`): две задачи доверия, словарь из 4 слов, полный путь, модель сбоев. Education **пушит** сессию модулю (не обратный attach); оценка по HTTP; Kafka — только лог; один `session_key`; `eventId` вместо `seq`; claim `session_id`; время задаёт преподаватель; «Прервать попытку»; продолжение `ACTIVE`-сессии |
| MOD-002 | Утвердить контракт Education (спека backend-requirements) | P0 | Done | MOD-001 | [`2026-09-04-practical-modules.md`](./backend-requirements/2026-09-04-practical-modules.md) — **переписан 2026-09-05** под новый концепт: E1–E11 (реестр/каталог/привязка/старт+продолжение/статус/пуш-в-модуль/приём-оценки-HTTP/Kafka-consumer-события/прервать/best-of-N/истечение), приёмка |
| MOD-002a | IdentityService: реестр клиентов | P0 | Done | MOD-002 | `Domain/Client` (`ClientId`, `ClientSecretHash`, `AllowedAudiences[]`, `CanRequestAudience`), EF-конфигурация + миграция `AddClients`, `Data/Seeding/ClientSeeder` (идемпотентно из `InitialClients`, dev-запись `education-core` → `["sql-module-api"]`). Хэш секрета — общий `Common/Crypto/TokenHasher` (вынесен туда же из `Web`, чтобы `Data` тоже мог хешировать при сидинге) |
| MOD-002b | IdentityService: эндпоинт Token Exchange | P0 | Done | MOD-002a | `POST /api/v1/auth/token/exchange` (`Web/Features/Auth/TokenExchange/*`): Basic-аутентификация клиента (`BasicAuthCredentials`), валидация `subjectToken` теми же правилами, что и входящий JWT-bearer (`SubjectTokenValidator`), проверка `allowedAudiences`, выпуск нового токена под целевую `aud` (`ITokenService.IssueForAudienceAsync`, без refresh-токена, TTL `Jwt:ExchangeAccessTokenMinutes`=30 мин). Аудит-событие `TokenExchanged`. 6 интеграционных тестов (happy path + 5 отказов), полный прогон **74/74**. Коммит `7d8d692` (первый коммит репозитория `IdentityService` — до этого сессии не было ни одного) |
| MOD-002c | IdentityService: `session_id` в module-токене | P0 | Done | MOD-002b | ✅ Коммит `952965e` в `IdentityService`. `POST /api/v1/auth/token/exchange` принимает необязательные `sessionId` + `sessionExpiresAt`: `sessionId` → claim `session_id` в токене; `sessionExpiresAt` → `exp` токена обрезается по нему, если раньше стандартного TTL обмена (30 мин); `expiresIn` в ответе = фактический TTL. `sub=<userId>`, `aud=sql-module-api`, роль `Student` — как и раньше. Запрос без `sessionId` валиден (standalone). `IssueForAudienceAsync` → `ExchangedAccessToken`. Аудит `TokenExchanged` упоминает сессию. Тесты +2 (`WithSessionId`, `SessionExpiresBeforeDefaultTtl`), полный прогон **76/76** |
| MOD-003 | Kafka в dev-инфраструктуре + `Education.Kafka` (абстракции) | P1 | Done | MOD-001 | Брокер `apache/kafka:3.8.0`, KRaft, двойные листенеры (host+внутренняя сеть) в `Backend/compose.yaml` + `kafka-init` (пред-создаёт оба топика, 3 партиции). Найдено и исправлено на реальном контейнере: без `KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1` (+ transaction-log аналоги) и включённого `AUTO_CREATE_TOPICS` внутренний `__consumer_offsets` не создаётся на одном брокере → `COORDINATOR_NOT_AVAILABLE`, консьюмер молча ничего не читает (продюсер при этом отчитывается об успехе). Новый проект `Education/src/Education.Kafka` — **только абстракции**, без ссылок на другие слои Education: `IKafkaProducer<T>`/`KafkaProducer<T>`, `KafkaConsumerBackgroundService<T>` (commit офсета только после успешной обработки — сообщение переигрывается при падении хендлера, обработчик обязан быть идемпотентным), `KafkaOptions`, `AddKafkaMessaging`. Контракты сообщений (`KafkaTopics`, `PracticeEventMessage`, `PracticeCompletionMessage`, схемы из `MODULE_INTEGRATION.md` §7) — в `Education.Contracts/Kafka/`, рядом с `ApiRoutes`, не в `Education.Kafka`. Конкретный консьюмер (бизнес-логика) — в `Education.Application`, это `MOD-008`, ещё не начато. Подключено в `Education.Web` (опции живые, консьюмера нет). Проверено вживую: produce → consume полный круг через саму библиотеку, дважды (до и после переноса контрактов). **Ревизия концепта 2026-09-05:** задействован только топик `scoodle.practice.events`; `PracticeCompletionMessage` и топик `completion` в `MOD-008` удаляются (оценка идёт по HTTP), `PracticeEventMessage` приводится к `eventId/kind/payload` |
| MOD-004 | Education: реестр модулей + admin-CRUD | P0 | Done | MOD-002 | `Domain/PracticalModules/PracticalModule` (`slug`/`identityAudience`/`configuration`), EF-конфигурация (уникальный `slug`, `configuration` jsonb), `EfPracticalModulesRepository`, `PracticalModulesService`, `GET/POST/PUT/DELETE /api/v1/admin/practical-modules` (`AdminOnly`, валидация slug/basePath, 409 на дубликат slug), `PracticalModulesApiTests` (8 тестов) |
| MOD-005 | Education: проксирование каталога заданий модуля | P0 | Done | MOD-004 | ✅ Коммит `7e79e46`. `GET /api/v1/practical-modules/{id}/tasks` (`TeacherOnly`) → `IModuleCatalogService` + `HttpModuleCatalogClient` (типизированный `HttpClient`, таймаут 3с, `X-Service-Key` из `PracticalModules:<slug>:ServiceKey`, парсинг `configuration.catalogEndpoint`); недоступность/ошибка/мусор → `502`. `ModuleCatalogApiTests` 5/5 |
| MOD-006 | Education: `Practical.kind=external`, привязка модуля к практике (1:1) + `triesCount` + `timeLimitMinutes` | P0 | Done | MOD-005 | ✅ Коммит `4bae06f`. `PUT /api/v1/practicals/{id}/module` (`TeacherOnly`). Domain: `PracticalMaterial.Kind`/`TimeLimitMinutes` + `BindExternalModule`; `Case.PracticalModuleId`/`ExternalTaskRef` + `LinkExternalTask`. Пересоздаёт единственный `Case`. `PracticalModuleNotFoundException` → 404. `PracticalModuleBindingApiTests` 5/5 |
| MOD-007 | Education: жизненный цикл сессии, гейт попыток, пуш в модуль, Token Exchange, приём оценки | P0 | Done | MOD-002c, MOD-006 | ✅ Коммит `094934f`. `PracticalModuleSession` (ACTIVE/COMPLETED/EXPIRED, `end_reason`, `session_key`, `return_url`, `expires_at`, потолок 24ч). `POST /practicals/{id}/module-sessions` — старт + продолжение живой ACTIVE (не 409) + гейт `attemptsCount>=triesCount`, **пуш ДО персиста** (502 не тратит попытку), Token Exchange с `sessionId`, `launchUrl` = `?session=` + `#access_token=`. `GET .../current`, `GET .../{sid}` (ленивое истечение), `POST .../{sid}/abandon`. `POST /module-sessions/{sid}/complete` (`X-Service-Key` + `session_key`, идемпотентно, 409 для не-ACTIVE). `ModuleSessionsApiTests` 12/12 |
| MOD-008 | Education: Kafka-consumer (только события «цифрового следа») | P0 | Done | MOD-003, MOD-007 | ✅ Коммиты `3522126` (контракт) + `a4fd185` (консьюмер). `Education.Contracts.Kafka.PracticeEventMessage` под `{SessionId, SessionKey, EventId, Kind, OccurredAt, Payload}`, `completion` удалён. `PracticeEventConsumer : KafkaConsumerBackgroundService` + `PracticeEventHandler` (сверка `session_key` + дедуп по `eventId`; статус сессии не проверяется — коммит `cdbde9b`). `PracticeEventHandlerTests` 6/6 |
| MOD-008a | Education: best-of-N в оценке практики | P1 | Done | MOD-008 | ✅ Коммит `094934f`. `EfGradesRepository` для `kind=external` → `MAX(grade)` по `COMPLETED`-сессиям студента; нет `COMPLETED` → `grade:null` + «Пройдите практику». Покрыто `ModuleSessionsApiTests.ExternalGrade_BestOfN_ViaGradeEndpoint` |
| MOD-006b | Education: чтение привязки практики для UI | P1 | Done | MOD-006 | ✅ Коммит `64c2d39`. `GET /api/v1/practicals/{practicalId}` (`AuthenticatedEducationUser`) → `PracticalDetailResponse { id, name, kind, isPublic, triesCount, timeLimitMinutes, moduleBinding? { practicalModuleId, practicalModuleSlug, practicalModuleName, taskId, externalTaskRef } }`. Тесты: external/internal/404 |
| MOD-012a | Education: read-эндпоинт ленты событий | P1 | Done | MOD-008 | ✅ Коммит `64c2d39`. `GET /api/v1/practicals/{practicalId}/module-sessions/{sessionId}/events` (`AuthenticatedEducationUser`) → `[{ eventId, kind, occurredAt, payload }]`. Доступ: владелец сессии ИЛИ преподаватель курса практики; чужая/несуществующая → `404`. Тест: owner+teacher видят, чужая сессия 404 |
| MOD-012b | Education: список попыток модуля по практике (преподаватель) | P1 | Done | MOD-012a | ✅ Коммит `3d7b688`. `GET /api/v1/practicals/{practicalId}/module-sessions` (`TeacherOnly`) → `[{ sessionId, userId, studentName, tryNumber, status, endReason, grade, startedAt, endedAt }]`, новые первыми. Доступ: преподаватель — владелец курса практики, иначе `404`. Нужно для ленты MOD-012 у преподавателя. `ModuleSessionsApiTests` +1 (14/14). OpenAPI/Orval — коммит `465af1d` |
| MOD-009 | platform-web: реестр модулей (экран администратора) | P1 | Done | MOD-004 | ✅ Коммит `540f579`. `AdminModulesPage` (`/admin/modules`, вкладка «Модули»): CRUD `PracticalModule`, slug read-only при редактировании, `isEnabled` Switch только в edit, клиентская валидация `configuration` JSON, БЕЗ поля serviceKey, 409/404/422 через `getEducationProblemMessage`, удаление через `ConfirmModal` |
| MOD-010 | platform-web: привязка модуля к практике (преподаватель) | P0 | Done | MOD-006, MOD-006b | ✅ Коммиты `0f6e19b` + `ad7c3aa`/(platform-web hook swap). `TeacherExternalPractical` (`features/module-practice`): показ текущей привязки / форма `BindModal` (`Select` модуль → `Select` задание из каталога, попытки, лимит времени + «Без лимита»). `useGetPracticalDetail` ветвит `TeacherPracticalPage`. `204` → refetch, `409` → «по практике есть работа студентов», `404` → «модуль не найден». **`SMK-13` (найдено прокликиванием формами, исправлено):** `BindModal` дёргал `GET /admin/practical-modules` (`AdminOnly`) → у препода `403` → пустой `Select` модулей. Новый эндпоинт `GET /api/v1/practical-modules` (`TeacherOnly`, только `isEnabled`); `BindModal` → `useGetEnabledPracticalModules`. **Проверено формами (прогон 5):** привязка через `BindModal` до `204`, каталог заданий подтянулся. |
| MOD-011 | platform-web: запуск внешней практики + гейт попыток + возврат (студент) | P0 | Done | MOD-007 | ✅ Коммит `76de53e`. `StudentExternalPractical`: гейт `GET .../current?taskId=` → «Начать»/«Продолжить»/«Прервать попытку» (`ConfirmModal`), `POST .../module-sessions` → `200` `window.location=launchUrl` / `409` / `502`. Возврат `?session=` → `ReturnStatus`: поллинг ~2с, `slow` после 40с + «Обновить», `COMPLETED` → оценка, `EXPIRED` → текст по `endReason` |
| MOD-012 | platform-web: просмотр протокола модульной сессии (события) | P1 | Done | MOD-008, MOD-012a, MOD-012b | ✅ Коммит `aa918bb`. `SessionEventsFeed` — общий таймлайн (`kind` + время + `payload` в `Spoiler`), 404 скрыт. Студент: под гейтом (последняя сессия) и под статусом возврата (завершённая/прерванная). Преподаватель: `TeacherSessionProtocols` — таблица попыток (студент/№/статус/оценка/начата, `useListPracticalModuleSessions`) → выбор строки открывает ленту. Костыли убраны в `465af1d` |
| MOD-013 | sql-module-web: маршрут `/launch` + `TokenProvider: handoff` | P0 | Backlog | MOD-007, MOD-014 | Спека [`2026-09-05-sql-module-integration.md`](./backend-requirements/2026-09-05-sql-module-integration.md) §F1–F4. Читает `?session=` из query и `#access_token` из фрагмента (→ `sessionStorage` через новый `handoff-token-provider`, `history.replaceState`); `GET /module-integration/sessions/current` → навигация по каноническому `taskId`; контекст запуска в `sessionStorage`; по верному submit в контексте запуска → `window.location.assign(returnUrl)`. Ни `launch_token`, ни attach |
| MOD-013a | SqlModule: ручка каталога заданий (`/api/v1/module-integration/tasks-catalog`) | P0 | Ready | — | Спека §S1. Список опубликованных заданий (`ref/name/description`) для проксирования ядром (MOD-005); аутентификация — `X-Service-Key`, секрет вне возвращаемого `configuration` JSON |
| MOD-014 | SqlModule: приём пуша сессии + publisher (события в Kafka + оценка по HTTP) | P0 | Backlog | MOD-003, MOD-007 | Спека §S2–S6. `POST /module-integration/sessions` (upsert `ModuleSession`, `X-Service-Key`); `GET /module-integration/sessions/current` (по claim `session_id`); привязка `SubmitAttempt` к сессии (owner/task/status); таблица `pending_publish` + фоновый publisher: события → `scoodle.practice.events` (`eventId`), оценка → `POST {education}/module-sessions/{id}/complete` (`grade=100` по первой верной попытке), retry после сбоя/рестарта. Обратного attach нет; standalone-flow не меняется |
| MOD-014a | SqlModule: собственная `Audience` без поломки standalone | P0 | Backlog | MOD-002b, MOD-014 | Спека §S7. Профиль `platform` принимает `aud=sql-module-api`; обязательный профиль `standalone` сохраняет прямой Identity-логин и контуры teacher/admin/student, не зависит от Education/Kafka. Переключение конфигом, один билд. Общий инстанс на оба audience — позже |
| MOD-015 | Инфраструктура: единый reverse-proxy | P1 | Конфиг готов | MOD-011, MOD-013 | `SQLTren/gateway/` (untracked, как `Backend/compose.yaml`): `default.conf.template` + `compose.yaml` + `gateway.env` + README. Один origin `:8090` — `/` → platform-web, `/modules/sql/` → sql-module-web, `/module-api/sql/` → SqlModule.Host (префикс срезается), `/api/v1/` → Education. Заголовки: `Referrer-Policy: no-referrer`, `CSP … frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`. IdentityService за шлюз не заводится (вход остаётся кросс-origin). `nginx -t` проходит. Маршруты `/` и `/api/v1/` проверяемы; `/modules/sql/` + `/module-api/sql/` — вживую не проверены (ждут `MOD-013`/`MOD-014a`), полная проверка в `MOD-016` |
| MOD-016 | Сквозной smoke: студент проходит SQL-задание через модуль | P0 | ✅ **Пройден** (API `18/18` + браузер) | MOD-011…MOD-015 | Прогон 3 (2026-09-07): API-путь `18/18` на чистых контейнерах без ручных правок (соседи закрыли `SMK-2/3/4/6`). Прогон 4 (2026-09-07): **браузерный путь** (`SMK-7`) — студент в platform-web жмёт «Начать» → редирект в `/launch` модуля → `#access_token` в `sessionStorage` + `history.replaceState` (URL чист) → решение в реальном SQL-sandbox → `assign(returnUrl)` назад в platform-web → «Попытка засчитана, ОЦЕНКА 100» + протокол события (`SessionEventsFeed`). Прогонялся безшлюзово (`ModuleWebOrigin` `SMK-5`); nginx-шлюз собран и `nginx -t` проходит, но live через `:8090` не гонялся (осталось как отдельная проверка). |

### MOD-016 — прогон smoke 2026-09-06 (API-уровень)

Контейнеры пересозданы (`docker compose -f Backend/compose.yaml down -v && up -d`,
чистые Postgres+Kafka). Подняты: IdentityService `:5101` (Development, сид
`InitialUsers`/`InitialClients`), Education `:5135` (Development, `EnsureCreated`
построил полную схему), SqlModule `:5202` (`ASPNETCORE_ENVIRONMENT=Platform`
+ env-оверрайды `ModuleIntegration__ServiceKey=dev-sql-module-service-key-change-me`,
`ModuleIntegration__EducationBaseUrl=http://localhost:5135`, `UseFakeSandbox=true`,
`SeedDemoData=true`). Сценарный скрипт — `SQLTren/gateway/smoke.sh`.

**✅ Проверено вживую (платформенная сторона контракта — полностью):**

| Шаг | Результат |
|---|---|
| Identity `login` admin/teacher/student | 200, пары токенов |
| Education `POST /admin/profiles` (провижн legacy-профиля + `IdentityUserLink`) для 3 пользователей | 201; **это обязательный ручной шаг** — `/auth/me` профиль НЕ создаёт (см. SMK-9) |
| admin `POST /admin/practical-modules` (реестр, `configuration` с `catalog/sessionsEndpoint`) | 201 |
| teacher `GET /practical-modules/{id}/tasks` (Education проксирует каталог модуля по `X-Service-Key`) | 200, `[{ref,name,description}]` |
| teacher course→module→practical, `PUT /practicals/{id}/module` (bind, `triesCount`, `timeLimitMinutes`) | 204 |
| admin `PUT /practicals/{id}/students` (по **legacy** id) | 204 |
| student `GET /practicals/{id}` (детали, `kind=external`, `moduleBinding`) | 200 |
| student `GET .../module-sessions/current` (гейт) | `{session:null, attemptsCount:0, triesCount:2}` |
| student `POST .../module-sessions` (старт) | 200: **push C1 в SqlModule прошёл** (строка в `ModuleSessions` модуля: тот же `sessionId`/`sessionKey`, `ReturnUrl` — полный вложенный, вариант B), **Token Exchange** отработал (`launchUrl` с `#access_token=`, `aud=sql-module-api`, claim `session_id`, роль Student) |
| Kafka: продюс `scoodle.practice.events` (`{sessionId,sessionKey,eventId,kind,occurredAt,payload}`, camelCase) | Education `PracticeEventConsumer`→`PracticeEventHandler` записал `PracticalTaskEvents` (id=eventId, матч по `sessionKey`, payload jsonb) |
| SqlModule→Education `POST /module-sessions/{sid}/complete` (`X-Service-Key` + `sessionKey`, grade=90) | 200; повтор → 200 (идемпотентно) |
| student `GET .../module-sessions/{sid}` | `COMPLETED`, `endReason=completed`, `grade=90` |
| student `GET /practicals/{id}/grade` (best-of-N) | попытка 2 с grade=60 → итог остаётся **90** |
| student 3-я попытка | `409 TriesExhausted` |
| student `POST .../{sid}/abandon` | 204; повтор → 409; статус `EXPIRED`/`abandoned`; попытка сожжена → следующий старт `409` |
| student `GET .../{sid}/events` (MOD-012a) | лента из 1 события |
| teacher `GET .../module-sessions` (MOD-012b) | `[{tryNumber:2,COMPLETED,60},{tryNumber:1,COMPLETED,90}]`, `studentName="Student Test"` |

**❌ Не заработало / не покрыто:**

| ID | Приоритет | Где | Что не так | Что делать |
|---|---|---|---|---|
| SMK-1 | P1 | Education (моя зона) | Дев-БД `EducationDb` не мигрируется: `EnsureCreatedAsync` на непустой БД молчит, Phase-7 таблиц/колонок нет → HTTP 500 `42P01`. | **Решение владельца (2026-09-07): переходим на EF Core миграции.** Заменить `EnsureCreatedAsync` на `Database.MigrateAsync()` при старте; `InitialCreate` со всей текущей схемой (Roles/QuestionTypes `HasData` — как есть); задокументировать `dotnet ef migrations add` в README. Прод: миграции применяются деплоем/энтрипойнтом. |
| SMK-8 | ~~P0~~ **исправлено** `67f05cf` | Education (моя зона) | Push C1 отдавал **legacy** id, модуль сверяет владельца с `sub` обменянного токена (**identity** id) → всегда `403 ModuleSessionForbidden`, студент не мог отправить попытку. Теперь `ModuleSessionsService` берёт `ICurrentUser.UserId` и кладёт identity-id в тело пуша; `PracticalModuleSession.UserId` остаётся legacy для внутренних джойнов. **Проверено вживую:** `POST /api/v1/attempts` в SqlModule обменянным токеном → `201` (было `403`); модуль сам опубликовал событие в Kafka и сам вызвал `/complete` → сессия Education `COMPLETED grade=100`. | — |
| SMK-5 | ~~P0~~ **исправлено** `67f05cf`/`00a2227` | Education (моя зона) | `BuildLaunchUrl` строил адрес модуля от `PlatformOrigin` (`:5173/modules/sql/launch`) → только за шлюзом. Новая опция `ModuleIntegration:ModuleWebOrigin` — при безшлюзовой разработке SPA модуля отдаётся с корня своего порта (`basePath` не добавляется); пусто → прежнее поведение за шлюзом. `appsettings.Development.json` → `http://localhost:5174`. **Проверено:** `launchUrl` origin стал `http://localhost:5174/launch`. | — |
| SMK-9 | — | **Закрыто — by design** (2026-09-07) | Владелец: пользователи заводятся **через админку** (`AdminProfilesPage` → `POST /admin/profiles` создаёт legacy-профиль + `IdentityUserLink`). JIT-провижн на `/auth/me` не делаем. Для smoke/dev — просто шаг «завести 3 профиля» в runbook (скрипт `smoke_full.sh` это уже делает). | — |
| SMK-10 | P2 | Education (моя зона) | **(a)** `PUT /courses/{id}/students` и `PUT /practicals/{id}/students` не валидируют `userIds`: проверяют только существование курса/практики, затем `AddRange` bind'ов. Неизвестный/чужой GUID → `DbUpdateException` (FK `…BindUsers_Users_user_id`), у эндпоинта нет catch → **сырой 500** (в dev — со стеком Npgsql в теле), клиент не отличает «плохой id» от «сервер лёг». Транзакция атомарна (весь `SaveChanges` откатывается), но контракт всё равно плохой. **(b)** `…/assignable-students` возвращает **любого** `User` с активным `IdentityUserLink` — без фильтра роли (в smoke в списке «студентов» были и admin, и teacher). **(c)** Глубже: у Education нет достоверной роли per-user — `User.CreateLegacyProfile` и `AdminProfilesPage` всегда ставят `RoleIds.Student`, роль из токена Identity в `User.RoleId` не синкается. Поэтому фильтр по `RoleId` сейчас бессмыслен. | **(a)** перед записью загрузить `Users.Where(u => ids.Contains(u.Id))`, сверить с запрошенными → типизированная ошибка → `400`/`422` со списком неизвестных id (или `404`). **(b+c)** `CreateAdminProfileRequest`/`AdminProfilesPage` получают поле роли, `CreateLinkedProfileAsync` ставит `User.RoleId` из неё; тогда `assignable-students` фильтрует `RoleId == Student`. Идёт вместе с `TEA-004` (переполитка тех же эндпоинтов). |
| SMK-11 | ~~P2~~ **исправлено** `67f05cf` | Education (моя зона) | `POST /courses` с `date` без таймзоны → 500 `Cannot write DateTimeOffset with Offset=03:00:00`. `Course.ctor` теперь нормализует `Date` к UTC. Проверено: курс с `"2026-09-06"` создаётся. | — |
| SMK-2/3/4/6 | ~~P0/P1~~ **закрыто соседями** (SqlModule `26040274`…`e8633f6`) | SqlModule | Штатный launch-профиль `Platform` (`SeedSmokeData=true`, `Enabled=true`, `aud=sql-module-api`, реальный sandbox); `appsettings.Platform.json` → `ServiceKey=dev-sql-module-service-key-change-me`, `EducationBaseUrl=http://localhost:5135`; `SmokeDataSeeder` создаёт `Published`-задание `80000000-…-002` + таблицу `users(id=1)` + эталон; `docs/PLATFORM_SMOKE_RUNBOOK.md`. **Проверено прогоном 3** — `dotnet run --launch-profile Platform` без правок. | — |
| SMK-12 | ~~P0~~ **исправлено** `cdbde9b` | Education (моя зона) | `PracticeEventHandler` отбрасывал события неактивной сессии (`session.Status != Active → return`). Kafka асинхронна: `GRADE` из outbox модуля приходит на `/complete` за ~130 мс до `EVENT` в Kafka → к моменту обработки события сессия уже `COMPLETED` → событие **победной** попытки терялось (в прогоне 3: сообщение в топике есть, `PracticalTaskEvents` пуст). Убрал проверку статуса — журнал append-only, границы = `sessionKey` + дедуп по `eventId`. Тесты: `TerminalSession_Ignored` → `CompletedSession_ValidKey_EventStored` + `ExpiredSession_…`; `PracticeEventHandlerTests` 6/6. **Проверено:** прогон 3 → `events=1`. | — |
| SMK-7 | ~~P1~~ **браузерный путь пройден** (2026-09-07) | инфра (моя зона) | Прогон 4: реальный клик в браузере, безшлюзово (platform-web `:5173`, sql-module-web `:5174`, `ModuleIntegration:ModuleWebOrigin` = `SMK-5`). «Начать» → `assign(launchUrl)` → `LaunchPage` модуля: `#access_token` из фрагмента → `sessionStorage` (`sql-module-handoff-token`) + `history.replaceState` (URL стал `/student/tasks/{taskId}` без токена) → `GET /module-integration/sessions/current` → решение `SELECT id FROM users ORDER BY id` в реальном sandbox → `assign(returnUrl)` назад в platform-web (`?session=`) → `ReturnStatus`: «Попытка засчитана, ОЦЕНКА 100» + `SessionEventsFeed` с `sql_submit`. Teacher `GET .../module-sessions` (MOD-012b) видит сессию `COMPLETED grade=100`. Заодно проверена вкладка «Студенты» (`TEA-004`) — назначение на курс из UI (204). | Остаётся один прогон через nginx-шлюз `:8090` (конфиг готов, `nginx -t` проходит) — чтобы проверить `/modules/sql/*` + `base=/modules/sql/`. Не блокирует. |

**Покрыто после фикса SMK-8 (прогон 2):** студент отправляет решение в SqlModule
обменянным токеном (`POST /api/v1/attempts`) → `201`; на верном ответе модуль
переводит свою `ModuleSession` в `COMPLETED`, **сам** публикует `sql_submit` в
Kafka (Education-consumer записал `PracticalTaskEvents`) и **сам** вызывает
`POST /module-sessions/{sid}/complete` → сессия Education `COMPLETED grade=100`.
Полный исходящий контур модуля (publisher + completion client) — живой.

**Не покрыто:** браузерный `/launch`-handoff (`#access_token` → `sessionStorage`,
`history.replaceState`), навигация по `taskRef`, возврат по `returnUrl` из UI
модуля — нужен запущенный `sql-module-web` (`MOD-013`) + `SMK-5` (готово) либо
шлюз `SMK-7`.

### MOD-016 — прогон 3, 2026-09-07 (соседи закрыли `SMK-2/3/4/6`)

Чистые контейнеры (`down -v && up -d`). IdentityService `:5101`, Education `:5135`
(с `ModuleWebOrigin=:5174` из `appsettings.Development.json`), SqlModule `:5202`
**`dotnet run --launch-profile Platform`** — без единого env-оверрайда и без ручных
`UPDATE` в БД. Реальный Docker-sandbox модуля. Скрипт — `SQLTren/gateway/smoke_full.sh`.

**Результат: 18/18.** Шаги: login → провижн профилей → реестр модуля →
Education проксирует каталог (`ref=80000000-…-002`) → course/module/practical +
bind → назначение студента → гейт → старт (**push C1 с identity-id долетел** в
`ModuleSessions` модуля + Token Exchange, `launchUrl` → `http://localhost:5174/launch`)
→ **студент решает `SELECT id FROM users ORDER BY id` в реальном sandbox модуля**
(`201`, `isCorrect=true`) → модуль **сам** перевёл свою сессию в `COMPLETED`,
**сам** опубликовал `sql_submit` в Kafka (Education-consumer записал в
`PracticalTaskEvents` — после фикса `SMK-12`) и **сам** вызвал `/complete` →
сессия Education `COMPLETED grade=100` → best-of-N `=100` → `GET .../module-sessions`
(MOD-012b) отдаёт `COMPLETED` со `studentName` → повторная отправка `409`, сессия
не меняется.

**Вывод.** Весь цифровой путь MOD-016 (Identity, Token Exchange + `session_id`,
провижн, реестр, проксирование каталога, привязка, жизненный цикл сессии,
пуш C1 с identity-id, **решение в реальном SQL-тренажёре**, событие в Kafka от
модуля → журнал Education, приём оценки C3 от модуля, best-of-N, гейт попыток,
`abandon`, ленты MOD-012a/b) — **замкнут и проверен на API, воспроизводимо, без
ручных правок**.

### MOD-016 — прогон 4, 2026-09-07 (браузерный путь, `SMK-7`)

Безшлюзово: platform-web `:5173`, sql-module-web `:5174` (`base=/`), Education
`:5135` (`ModuleWebOrigin=:5174`, `SMK-5`), SqlModule `:5202` (`--launch-profile
Platform`), Identity `:5101`. Реальный клик в браузере как студент:

1. Практика platform-web → «Начать» → `window.location.assign(launchUrl)`.
2. `http://localhost:5174/launch?session=…#access_token=…` → `LaunchPage` модуля:
   фрагмент прочитан, токен в `sessionStorage` (`sql-module-handoff-token`),
   `history.replaceState` → URL `= /student/tasks/{taskId}` **без токена и без
   фрагмента** (проверено `location.href`).
3. `GET /module-integration/sessions/current` (обменянным токеном) → страница
   задания. Решение `SELECT id FROM users ORDER BY id` в **реальном** Docker-
   sandbox → «Верно».
4. `window.location.assign(returnUrl)` → назад в platform-web на страницу
   практики с `?session=…`.
5. `ReturnStatus`: **«Попытка засчитана, ОЦЕНКА: 100»** + `SessionEventsFeed`
   показывает `sql_submit` (`{isCorrect:true, rowCount:1, submittedSql:…}`).
   Гейт: «Попытка 2 из 3 · ЛУЧШАЯ ОЦЕНКА 100».
6. Преподаватель: `GET /practicals/{id}/module-sessions` (MOD-012b) →
   `COMPLETED grade=100 studentName="Student Test"`.

Заодно (браузером) проверена вкладка **«Студенты»** (`TEA-004`) на странице
курса: чекбокс студента → «Сохранить» → 204 → «Список студентов сохранён»,
`isAssigned=true` персистится.

### MOD-016 — прогон 5, 2026-09-07 (весь teacher-flow формами, чистая БД)

`down -v && up -d`. **Ничего через API — все шаги кликами:**

1. **Админ** (`AdminProfilesPage`): «Связать пользователя» → teacher + student
   (Identity User ID вводится вручную — пикера нет, это отдельный UX-долг).
2. **Админ** (`AdminModulesPage`, `MOD-009`): «Зарегистрировать модуль» — slug
   `sql`, тип `SQL_SIMULATOR`, `basePath`, `identityAudience`, `configuration`
   JSON (`catalog`/`sessionsEndpoint`). Клиентская валидация «невалидный JSON»
   отработала на кривой вставке.
3. **Препод** (`TeacherCoursesPage`): «Создать курс».
4. **Препод** (`TeacherCoursePage`): «Создать модуль».
5. **Препод** (`TeacherModulePage` → вкладка «Практики»): «Создать практику».
6. **Препод** (`TeacherPracticalPage` → `BindModal`, `MOD-010`): «Привязать
   внешний модуль» → `Select` модуль (после `SMK-13` показывает «SQL тренажёр
   (sql)») → `Select` задание (каталог подтянулся: «Smoke: выбрать
   идентификаторы…») → попыток 3 → «Привязать» → `204`, карточка привязки
   отрисовалась.
7. **Препод**: вкладка/секция **«Студенты»** (`TEA-004`/`004a`) на курсе и на
   практике — чекбокс студента → «Сохранить» → `204`.
8. **Студент**: открыл практику → «Начать» → редирект в `/launch` модуля →
   `#access_token` в `sessionStorage`, URL чист → страница задания модуля.

Все экраны (`MOD-009/010`, `TEA-002/003/009/004/004a`) отработали формами
на чистой БД без обходных API-вызовов.

**Не покрыто:** один прогон через nginx-шлюз `:8090` (`SQLTren/gateway/`) —
`/` / `/api/v1/` / `/modules/sql/` / `/module-api/sql/` за общим origin,
`sql-module-web` собрана с `base=/modules/sql/`. Конфиг готов, `nginx -t`
проходит; не блокирует.

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
| G-5 | `PUT /api/v1/courses/{courseId}/students` — назначение студентов на курс | ~~`AdminOnly`~~ → `TeacherOnly` + владелец ¹ | Реализовано; **переполитить** (`TEA-004`) | TEA-004 |
| G-6 | `PUT /api/v1/practicals/{practicalId}/students` — назначение студентов на практику | ~~`AdminOnly`~~ → `TeacherOnly` + владелец ¹ | Реализовано; **переполитить** (`TEA-004a`) | TEA-004a |

¹ **2026-09-07: возврат под преподавателя** (владелец: назначение — функция препода,
как в legacy). Правка: в `AdminProfilesEndpointGroup` для 4 эндпоинтов
(`GET`/`PUT` course-students, `GET`/`PUT` practical-students) сменить
`AdminOnly` → `TeacherOnly` + проверка владельца (курс — `Course.UserId`;
практика — `IsPracticalOwnerAsync`). Методы можно перенести в срезы
`Courses`/`Practicals`, либо оставить на месте и только переполитить.

## Этапы поставки

| Phase | Состав | Результат |
|---|---|---|
| **1. Скелет** | `PLT-001 → 002 → 003 → 004 → 005 → 006 → 007 → 008 → 015 → 016` | Логин через IdentityService, генерируемые клиенты, разводка по ролям, пустые контуры |
| **2. Общий слой** | `PLT-009 → 010 → 011 → 012 → 013 → 014 → 017` | Сущности, вопросы, rich-text, списки, файлы, стартовые экраны |
| **3. Администратор** | `ADM-001 … 009` | Управление пользователями, аудит, настройки, учебные профили (назначение студентов — контур преподавателя, `TEA-004`/`004a`) |
| **4. Преподаватель** | `TEA-001 … 017` (блокеры `G-1…G-6`) | Полный цикл авторинга: курс → модуль → теория → вопросы → практика → задание → публикация → проверка → протокол |
| **5. Студент** | `STU-001 … 015` | Курсы → модуль → теория → тест → сдача задания → протокол → оценка |
| **6. Cutover** | `PLT-018 → 019 → 020 → 021` | Регресс, переключение деплоя, ретайр legacy, README |
| **7. Долг** | `TECH_DEBT.md` (`TD-NNN`) | Route-splitting, серверная пагинация, именованные enum в OpenAPI |

## Срез

- **Phase 0 закрыта полностью (2026-09-03).** Гэп-анализ, блокеры `G-1…G-6` (реализованы,
  77/77), решения зафиксированы, БД в Docker, codegen-каркас + клиенты `education` /
  `identity` (`tsc` чист), `AGENTS.md` + `TECH_DEBT.md`, репозитории заведены, планы
  сведены в `docs/`. Done по картам: `PLT-003` / `PLT-005` / `PLT-006` / `PLT-015` + все `G-*`.
- **Репозитории.** Бэк: `Education/` (github.com/SacarliteST/Education), ветка `master`,
  коммит `252c26f` — G-1…G-6. Фронт: `Frontend/platform-web/` (`git init`, ветка `master`),
  коммиты `06a596c` → `2069591` → `06ff67d`. Не запушено. Корень `SQLTren/` намеренно не git.
- **Phase 1 — каркас готов (2026-09-03).** `PLT-001` / `002` / `004` / `007` / `008` → Done.
  Осталось `PLT-016` — живой smoke на запущенных Education + IdentityService (запускает владелец).
- **Phase 2 — общий слой готов (2026-09-03).** `PLT-009…014` + `017` → Done.
- **Phase 3 — контур администратора готов (2026-09-03).** `ADM-001…007`, `ADM-009` → Done.
  Страницы `AdminHomePage` / `AdminUsersPage` / `AdminUserDetailsPage` / `AdminEventsPage` /
  `AdminProfilesPage` / `AdminSettingsPage` + маршруты `/admin/*` под `RequireRole(['Admin'])`.
  Live smoke на реальных IdentityService + Education — **весь контур PASS** (см. `ADM-009`).
  Побочно исправлены 3 бага бэкенда Education (JWT-конфиг, LINQ в `GetProfilesAsync`,
  бутстрап схемы БД) — коммиты `2f63af0`, `1f5e443`.
  `ADM-011` (назначение студентов) → **Blocked** (`TD-008`: нет эндпоинта списка
  курсов/практик для админа). `ADM-008` (справка админа) — P3, backlog.
- **Phase 4 — контур преподавателя готов (2026-09-03).** `TEA-001…015`, `017` → Done:
  курсы/модули CRUD, `TeacherModulePage` (Теория / Вопросы — CRUD всех 4 типов через
  `QuestionEditor` + `questionToFormValues` / Практики), `TeacherTheoryPage` (заголовок +
  rich-text + ссылки + документы), `TeacherPracticalPage` (Настройка / Задания / Сдачи /
  Протоколы), route-level code splitting (`React.lazy` + vite `manualChunks`, >500 kB
  предупреждение снято). `typecheck` + `build` зелёные. `TEA-016` (live smoke полного цикла
  авторинга) → **Done** (2026-09-03, весь цикл PASS): в ходе прогона найден и исправлен
  краш `QuestionEditor` (чтение синтетического события внутри updater-функций `setState`
  → `event.currentTarget` = null при двойном вызове updater в React StrictMode; 4 чтения
  вынесены наружу). `teacher@` / `student@` привязаны к Education `User` через
  `AdminProfilesPage`.
- **Phase 5 — контур студента готов (2026-09-03).** `STU-001…014` → Done: страницы
  `StudentCoursesPage` / `StudentCoursePage` / `StudentModulePage` / `StudentTheoryPage` /
  `StudentPracticalPage` (вкладки Тест / Задания / Протоколы / Оценка) + маршруты
  `/student/*` под `RequireRole(['Student'])`, `React.lazy`. Тест — полный цикл
  status→start→questions→submit через `QuestionAnswerInput`; сдача заданий файлом с
  заменой до принятия; протоколы + разбор; итоговая оценка с условиями. `typecheck` +
  `build` зелёные. Отклонение от плоской схемы URL из STU-001 — вложенная схема (как у
  преподавателя), т.к. в Education нет detail-эндпоинтов модуля/практики (`TD-005`).
  `STU-015` (live smoke полного сценария) → **Done** (2026-09-03, весь цикл PASS,
  ноль JS-ошибок): курсы → теория → тест (старт → 2 вопроса → отправка, оценка 5) →
  задание (пусто → загружено → принято) → протоколы → итоговая оценка «Отлично».
  Назначение студента на курс/практику сделано через API (админ-UI нет — `ADM-011`).
  Косметический долг `TD-010` (сырой ответ в разборе протокола студента).
- **Phase 6 — cutover готов (2026-09-03).** `PLT-018…021` → Done: `docs/REGRESSION.md`
  (регресс по 3 ролям + сквозной сценарий, PASS), прод-раздача статики
  (`Dockerfile` + `nginx.conf` + `compose.yaml`, nginx :8080, runtime-config
  монтированием), legacy заморожен в `Frontend/legacy/platform`, `README.md`.
  **Миграция завершена.** Открытый долг вне MVP: `ADM-011`/`TD-008` (нет UI назначения
  студентов), `TD-009` (агрессивный 401-logout), `TD-010` (сырой ответ в протоколе),
  `TD-001/003/004/005` (доработки Education), `ADM-008` (справка админа, P3).
- Критический путь Phase 1–2 не зависит ни от чего внешнего.
- Контур студента (Phase 5) полностью разблокирован — все эндпоинты есть.
- Контур администратора (Phase 3) — перенос из `sql-module-web`; риск только в
  расхождении версий Identity API (фиксируется свежим `identity.swagger.json`). Новая
  работа — `ADM-007` (учебные профили `Education`).
- Бэкенд-задачи `G-1…G-6` реализованы (2026-09-02) — контур преподавателя (Phase 4)
  разблокирован полностью. Назначение студентов вынесено в контур администратора
  (`ADM-011`, `AdminOnly`).
- Поконтурные доски выделяются из этой при старте Phase 3/4/5.
