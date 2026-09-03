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
| ADM-011 | Назначение студентов на курсы и практики (`PUT /courses/{id}/students`, `PUT /practicals/{id}/students` — `AdminOnly`) | P0 | Blocked | нет способа перечислить курсы/практики для админа | Бэкенд G-5/G-6 готов, но у админа нет эндпоинта списка курсов/практик (`/courses/teacher` — `TeacherOnly`). Нужен либо `GET /courses` (AdminOnly) на бэкенде, либо UI со вводом GUID вручную. Решение за владельцем |

### Контур преподавателя (Phase 4)

| ID | Задача | Приоритет | Статус | Зависимость | Результат |
|---|---|---|---|---|---|
| TEA-001 | Каркас маршрутов и навигации Teacher (вложенные path-параметры, хлебные крошки) | P0 | Done | — | Маршруты `/teacher`, `/teacher/courses`, `/teacher/courses/:courseId`, `/teacher/courses/:courseId/modules/:moduleId` под `RequireRole(['Teacher'])`; навигация через `PageBreadcrumbs` (отдельный `TeacherContourTabs` не нужен) |
| TEA-002 | Список курсов + создание / удаление (`GET /courses/teacher`, `POST /courses`, `DELETE /courses/{courseId}`) | P0 | Done | — | `TeacherCoursesPage`: карточки курсов, модалка создания (RHF+Zod), подтверждение удаления |
| TEA-003 | Страница курса: список модулей + создание / удаление модуля (`GET /courses/{courseId}/modules`, `POST /modules`, `DELETE /modules/{moduleId}`) | P0 | Done | — | `TeacherCoursePage`: имя курса из списка, список модулей, создание/удаление модуля |
| TEA-004 | ~~Назначение студентов на курс~~ → перенесено в контур администратора (`ADM-011`); write-эндпоинт `PUT /courses/{courseId}/students` сделан `AdminOnly` в срезе `AdminProfiles`, как и парный read | — | Done (перенос) | — | Снято с контура преподавателя |
| TEA-005 | Страница модуля: вкладки теория / практика / вопросы | P0 | Done | — | `TeacherModulePage`: вкладки Теория / Вопросы / Практики |
| TEA-006 | Теория: список, создание, удаление (`GET /modules/{moduleId}/theories`, `POST /theories`, `DELETE /theories/{theoryId}`) | P0 | Done | — | Вкладка «Теория» (`ModuleSubList`): список, создание, удаление |
| TEA-007 | Редактор теории: заголовок + текст (rich-text) + ссылки CRUD + документы upload/delete (`PUT /theories/{id}/title`, `/text`; `POST/DELETE /theories/links`, `/theories/docs`) | P0 | Done | — | `TeacherTheoryPage`: заголовок + текст (`RichTextField`) + ссылки CRUD + документы (upload / `downloadEducationFile` / удалить) |
| TEA-008 | Банк вопросов модуля: список + создание / редактирование / удаление 4 типов (`GET /modules/{moduleId}/questions`, `POST /questions`, `PUT`/`DELETE /questions/{id}`) | P0 | Done | — | Список (`normalizeQuestion`), создание и **редактирование** через `QuestionEditor` (`questionToFormValues`: JSON `answer` → значения формы), удаление. Все 4 типа |
| TEA-009 | Практика: список в модуле + создание + удаление (`GET /modules/{moduleId}/practicals`, `POST /practicals`, `DELETE /practicals/{id}`) | P0 | Done | — | Вкладка «Практики» (`ModuleSubList`): список, создание, удаление (G-4) |
| TEA-010 | Настройка практики: выбор вопросов, попытки, пороги, публикация (`GET`/`PUT /practicals/{id}/questions`, `PUT /practicals/{id}/publish`). Назначение студентов вынесено в `ADM-011` | P0 | Done | — | Вкладка «Настройка» в `TeacherPracticalPage`: выбор вопросов, попытки, пороги, публикация |
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
| **3. Администратор** | `ADM-001 … 009`, `ADM-011` | Управление пользователями, аудит, настройки, учебные профили, назначение студентов |
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
  **Весь контур студента готов. Дальше — Phase 6 (cutover, `PLT-018…021`).**
- Критический путь Phase 1–2 не зависит ни от чего внешнего.
- Контур студента (Phase 5) полностью разблокирован — все эндпоинты есть.
- Контур администратора (Phase 3) — перенос из `sql-module-web`; риск только в
  расхождении версий Identity API (фиксируется свежим `identity.swagger.json`). Новая
  работа — `ADM-007` (учебные профили `Education`).
- Бэкенд-задачи `G-1…G-6` реализованы (2026-09-02) — контур преподавателя (Phase 4)
  разблокирован полностью. Назначение студентов вынесено в контур администратора
  (`ADM-011`, `AdminOnly`).
- Поконтурные доски выделяются из этой при старте Phase 3/4/5.
