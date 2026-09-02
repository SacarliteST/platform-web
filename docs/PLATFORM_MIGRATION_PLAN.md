# План миграции фронтенда платформы (`Frontend/platform` → стек `sql-module-web`)

Статус: **черновик на ревью.** Ничего не мигрируем до утверждения Phase 0.
Дата: 2026-09-02.

---

## 1. Что мигрируем и зачем

`Frontend/platform` — веб платформы Scoodle (LMS: курсы, модули, теория, практика,
тесты, оценки, админка пользователей). Сейчас он нацелен на **старый legacy-монолит**
(`Education/Education`, API вида `api/Teacher/GetCourses`, cookie-сессия, порт 8000).

Задача: перевести его на тот же стек и архитектуру, что у `Frontend/sql-module-web`,
и переключить на **новый бэкенд `Education`** (`api/v1/...`, Bearer JWT от IdentityService,
OpenAPI/Scalar).

Это не только замена стека фронта — это одновременно смена бэкенда и модели аутентификации.

---

## 2. Точка «откуда» — legacy `platform`

| Аспект | Текущее состояние |
|---|---|
| Язык | JavaScript, без типов |
| Сборка | Vite 6, React 18 |
| UI | Bootstrap 5 + `react-bootstrap` + `react-bootstrap-icons` |
| Rich text | `react-quill` (Quill 1, не поддерживается, peer React 18) |
| HTTP | `axios`, ручные обёртки в `src/services/*.service.js` (6 файлов) |
| Данные/кэш | нет (ручной `useState`+`useEffect` в каждой странице) |
| Стор | нет; роль/имя в `localStorage` |
| Формы | ручные, без валидации-библиотеки |
| Кодоген API | нет |
| Auth | cookie-сессия: `api/Auth/Login` → кладёт `userRole`/`username` в localStorage; `api/Auth/IsSignedIn` на каждом маунте `AuthGuard`; роль — **русская строка** (`'Преподаватель'`) |
| API | RPC-стиль: `api/{Teacher,Student,Shared,User,Auth}/{Action}`, query-string параметры, `FormData` для загрузок, скачивание через прокси `/Files` |
| Роутинг | плоские маршруты; **ID передаются через `useLocation().state`** (не query, не path) → рефреш и deep-link ломаются |
| Хлебные крошки | `services/crumbsHelper.js` + `setCourseCrumbs(state)` |
| Структура | `pages/{teacherPages,studentPages,sections}`, `components/` (плоско + `cards/`, `questions/`, `questionEditors/`, `questionViewers/`, `questionAnswers/`, `sidebars/`), `services/` |
| Объём | ~20 страниц, ~40 компонентов, 6 сервисов |
| Тесты | нет |

Покрытые доменные области: курсы, модули, теория (Quill-текст + ссылки + документы),
практики, задания (загрузка файла + комментарии + приём с оценкой), вопросы
(4 типа: single / multiple / match / short — редакторы, вьюеры, вьюеры ответов,
`questionTransform.js`), тесты (старт → прохождение → отправка → протоколы), оценки,
админка пользователей (CRUD + роли).

---

## 3. Точка «куда» — стек `sql-module-web`

| Аспект | Целевое состояние |
|---|---|
| Язык | TypeScript, `strict`, `noUnusedLocals/Parameters` |
| Сборка | Vite 7, React 19, `tsc -b && vite build` |
| UI | **Mantine 8** (`@mantine/core`, `@mantine/hooks`), локальные CSS-модули. Bootstrap не подключать |
| Rich text | нужно выбрать (см. §5.3). Рекомендация — `@mantine/tiptap` |
| HTTP | fetch-мутатор `src/shared/http/*-fetch.ts`: base URL из runtime-config, `Authorization` из session-стора, обработка 401/204 в `executeRuntimeFetch` |
| Данные/кэш | **TanStack Query 5** (хуки генерируются Orval) |
| Стор | **Zustand 5** + `persist` (session: `accessToken` + декодированный `user`) |
| Формы | **React Hook Form 7 + Zod 4** (`@hookform/resolvers`) |
| Кодоген API | **Orval 8**: OpenAPI → `react-query` хуки + модели; клиент коммитится в `src/api/<service>/` |
| Auth | Bearer JWT от IdentityService. `src/session/`: zustand-стор, `decodeSessionUser` (jwt-decode, нормализация ролей, проверка `exp`), гварды `RequireAuth` / `RequireRole`, `LoginPage`. 401 → `clearSession`. Роли — **английский enum** `Admin \| Teacher \| Student` из claim `role` |
| API | новый `Education` (`api/v1/...`), REST-ресурсы, path-параметры, `PagedResponse`, `ProblemDetails`, CORS на `localhost:5173` |
| Роутинг | центральный `AppRouter.tsx`, обёртка `<AppLayout>`, контуры `/admin/*` `/teacher/*` `/student/*` каждый в `RequireAuth > RequireRole`, ленивые страницы студента и тяжёлые редакторы, **path-параметры** (`:courseId`) |
| Runtime config | `public/runtime-config.json` + фоллбэк `VITE_*`, `mode: 'standalone' \| 'embedded'`, вход через `mount(element, config)` |
| Структура | Feature-Sliced-lite: `app/{config,layout,providers,router}`, `pages/<name>/{Page.tsx,index.ts}`, `features/<name>/{ui,model,api,lib}`, `entities/<name>/{model,lib}`, `shared/{http,ui,lib,utils}` |
| Общие UI | `Page` / `PageHeader` / `PageBreadcrumbs`, `AppCard`, `EmptyState`, `ConfirmModal`, `FormActions` |
| UI-правила | тёмная верхняя навигация, светлая рабочая область, крошки на вложенных, компактные формы, карточки с тонкой рамкой, плотные таблицы с hover, primary синий / secondary серый-outline / destructive красный, create/edit/delete через модалки, пустые состояния простым текстом |
| Тесты фронта | вне этапа; гейт — `typecheck` + `build` + живой smoke |
| Конвенции процесса | `AGENTS.md`, единая канбан-доска `docs/TECH_DEBT.md` с ID `TD-NNN`, отдельные записи в `docs/tech-debt/records/` |

---

## 4. Соответствие API: legacy → новый `Education`

Новый бэкенд (`Education/src/Education.Contracts/ApiRoutes.cs`, `Education.Web/Endpoints/*`)
уже покрывает большинство экранов:

| Область legacy | Новый маршрут (`api/v1`) |
|---|---|
| `api/Teacher/GetCourses` / `api/Student/GetCourses` | `GET /courses/teacher`, `GET /courses/student` |
| `CreateCourse` / `DeleteCourse` | `POST /courses`, `DELETE /courses/{courseId}` |
| `api/Shared/GetModules` | `GET /courses/{courseId}/modules`, `GET /modules/{moduleId}` |
| теория | `GET/POST /modules/{moduleId}/theories`, `.../theories/{theoryId}` + `/docs` `/links` `/title` `/text` |
| практики | `GET/POST /modules/{moduleId}/practicals`, `.../practicals/{practicalId}` + `/publish` `/questions` `/tasks` |
| вопросы | `GET/POST /modules/{moduleId}/questions`, `PUT/DELETE /questions/{questionId}` |
| тест студента | `.../practicals/{id}/test-status` `/test/start` `/test/questions` `/test/submit` |
| протоколы | `.../practicals/{id}/protocols` (+`/teacher`), `GET /test-results/{id}/protocol` |
| оценка | `GET /practicals/{id}/grade` |
| файлы заданий | `.../tasks/{taskId}/file` `/files`, `.../practicals/{id}/task-files`, `/task-files/{id}` + `/comments` `/accept` |
| скачивание файла | `GET /files/{**storageKey}` (Bearer) |
| назначение студентов | `.../{courseId}/assignable-students`, `.../{practicalId}/assignable-students`, `admin/profiles/*` |
| `GET /auth/me`, `POST /auth/logout` | есть (Bearer) |

**Разрывы, которые надо закрыть в Phase 0:**

1. **Админка пользователей** (`api/User/GetAllUsers`, `CreateUser`, `DeleteUser`, `GetRoles`,
   `CanDeleteUser`) — в новом мире это **IdentityService** (`admin/users`), не `Education`.
   Ровно так уже сделано в `sql-module-web` (контур администратора). Переиспользуем.
2. **Логин** `api/Auth/Login` → IdentityService `POST /auth/login` (+ refresh).
   `Education` токены не выдаёт.
3. Нет выгруженного **OpenAPI-файла** для `Education`. `sql-module-web` коммитит
   `sqlModule.swagger.json` + `identity.swagger.json`. Нужен `education.swagger.json`
   (из `/openapi/v1.json` запущенного API в Development).
4. **Проверка на полноту**: пройти по всем 20 legacy-страницам и подтвердить, что
   каждый вызов имеет аналог в `Education`/`Identity`. Особое внимание: агрегаты для
   списков (кол-во студентов на курсе, кол-во попыток), пагинация.

---

## 5. Ключевые риски и решения

### 5.1 Смена модели передачи ID
Legacy: `useLocation().state`. Target: path-параметры + типизированные билдеры маршрутов.
Переписывается **каждая** навигация и загрузка данных на каждой странице; `crumbsHelper`
заменяется на `PageBreadcrumbs` с данными из роутера. Побочный плюс — чинится
deep-link/рефреш.

### 5.2 Роли
Legacy: русские строки из legacy-БД (`'Преподаватель'`). Target: `Admin|Teacher|Student`
из JWT-claim `role` (`RoleNames` IdentityService). Все `isTeacher()`-проверки переписать
на session-стор. Ярлыки на русском — в `entities/*/lib` (как `formatUserRole` в
`sql-module-web`).

### 5.3 Rich text
`react-quill` несовместим с React 19 и не поддерживается. Текст теории хранится как HTML
в `TheoreticalMaterial.Text`. Варианты: `react-quill-new` (минимальная миграция контента),
**`@mantine/tiptap`** (в экосистеме Mantine, рекомендуется), Lexical (тяжелее).
HTML Quill ↔ TipTap совместим в основном объёме (заголовки, списки, ссылки, форматирование).
Заменяет `RichTextEditor.jsx` + `ReadOnlyRichText.jsx` → `features/rich-text`.

### 5.4 Вопросы (4 типа) — самая логикоёмкая зона
Компоненты `questionEditors/*`, `questionViewers/*`, `questions/*`, `questionAnswers/*`
и `questionTransform.js` кодируют JSON-payload'ы, которые обязаны совпадать с
`Education.Domain.Tests.QuestionScoringService`:

| Тип | Эталон (`answer`) | Ответ пользователя |
|---|---|---|
| SingleChoice | `{ Answers:[{Id,Text}], CorrectAnswerId }` | `"<optionId>"` |
| MultipleChoice | `{ Answers:[{Id,Text,Correct,Weight}] }` | `["<id>", ...]` |
| Match | `{ Matches:[{Left:{Id,Text},Right:{Id,Text},Weight}] }` | `[{Left,Right}, ...]` |
| ShortAnswer | `{ Answer:"a;b;c" }` | `"<text>"` |

Портируется в `features/questions` на TS + Mantine + RHF/Zod, **контракт payload'а
не меняется**. Делать в Phase 2, чтобы переиспользовали оба контура.

### 5.5 Загрузка/скачивание файлов
Legacy: `FormData` PUT `api/Teacher/CreateTheoryDocument`, `api/Student/UploadTaskFile`;
скачивание через прокси `/Files`. Новый API: `multipart/form-data` эндпоинты +
`GET /files/{**storageKey}` с Bearer. Fetch-мутатор Orval не должен `JSON.stringify`-ить
`FormData` и выставлять `Content-Type` (проверить `override` в `orval.config.ts` для
multipart-операций).

### 5.6 Масштаб delta не позволяет in-place рефактор
JS→TS + Bootstrap→Mantine + axios→Orval/Query + cookie→JWT + state→path одновременно —
это переписывание. Подход: **новый каркас-скелет по образцу `sql-module-web`, затем
портирование по контурам**, удаляя legacy-страницы по мере готовности. Legacy работает
против `:8000` до достижения паритета.

### 5.7 Standalone / embedded
`sql-module-web` умеет `mode: 'standalone' | 'embedded'` + `mount(element, config)`.
Платформа — это хост, всегда standalone, но паттерн `mount`/runtime-config оставить
для единообразия (дёшево).

---

## 6. Фазы

### Phase 0 — Решения и предпосылки — **ЗАВЕРШЕНА 2026-09-02**
- [x] Целевой бэкенд = новый `Education` API (`localhost:5135`, Scalar `/scalar/v1`), запускается.
- [x] Гэп-анализ API по всем legacy-страницам — `PHASE0_API_GAP.md`. 6 блокеров `G-1…G-6`
      **реализованы** в `Education` (Contracts→Application→Infrastructure→Web, 15 тестов, 77/77).
      `G-5`/`G-6` (назначение студентов) размещены под `AdminOnly` в срезе `AdminProfiles`.
- [x] OpenAPI выгружает владелец; по нему сгенерированы Orval-клиенты `education` + `identity`
      (`platform-web/src/api/*`, `tsc -b --noEmit` чист).
- [x] Админку переносим из `sql-module-web` (Phase 3). Выпил из `sql-module-web` — вне зоны этой миграции.
- [x] Rich-text редактор = `@mantine/tiptap`.
- [x] Расположение: новая папка `Frontend/platform-web`; legacy `Frontend/platform` не трогаем,
      убираем на cutover (`PLT-020`).
- [x] Конвенции `AGENTS.md` + `docs/TECH_DEBT.md` (`TD-NNN`) заведены в `platform-web`.
- [x] UI: тёмная навигация / светлая область / Mantine.
- [x] Локализация: RU-only, строки хардкодятся в компонентах (i18n-библиотека не вводится).
- [x] Приложение всегда standalone; паттерн `mount()` + `runtime-config.json` сохраняем.
- [x] БД: `education-postgres` в Docker (`Backend/compose.yaml`, порт **5434**), `appsettings.Development` обновлён.

### Phase 1 — Скелет
- Каркас Vite 7 + React 19 + TS strict; скопировать `tsconfig.*`, eslint, `vite.config.ts`.
- Зависимости: `@mantine/core`, `@mantine/hooks`, rich-text (tiptap), `@tanstack/react-query`,
  `zustand`, `react-hook-form`, `zod`, `@hookform/resolvers`, `react-router-dom@7`,
  `jwt-decode`, `orval` (dev).
- Портировать `src/app/{config,providers,layout,router}` из `sql-module-web`
  (переименовать «SQL Module» → «Education», пункты навигации под контуры платформы).
- Портировать `src/session/*` почти вербатимом (интеграция с IdentityService идентична).
- Портировать `src/shared/http/*` + `src/shared/ui/*` вербатимом; добавить мутатор `educationFetch`.
- `orval.config.ts` с таргетами `education` + `identity`; сгенерировать `src/api/*`; закоммитить.
- `public/runtime-config.json`: `educationApiUrl` + `identityApiUrl`.
- **Гейт:** `build` + `typecheck` зелёные; логин через IdentityService; `GET /auth/me` на `Education` возвращает пользователя.

### Phase 2 — Shared / entities (крупная фаза)
- `entities/user` (переиспользовать из `sql-module-web`: роли, форматтеры).
- `entities/{course,module,theory,practical,question,task,test-result,grade}` — тонкие:
  ре-экспорт сгенерированных DTO + форматтеры + русские ярлыки enum.
- `features/questions` — 4 типа (редактор / вьютер / вьютер ответа) на TS + Mantine + RHF/Zod,
  payload по §5.4.
- `features/rich-text` — обёртка TipTap вместо `RichTextEditor.jsx` / `ReadOnlyRichText.jsx`.
- `shared/ui` — то, что реально нужно из legacy: `PaginatedData` → Query + Mantine `Pagination`;
  `MultiSelectSearch` / `AccordionMutiSelect` → Mantine `MultiSelect`; `FileWithComments`,
  `MessageBubble`, `UserTable`.
- **Гейт:** `typecheck` + `build`; демо-страница с каждым типом вопроса и rich-text.

### Phase 3 — Контур администратора
- **Перенести контур администратора целиком из `sql-module-web`** (страницы `admin-*`,
  `features/admin-*`, `entities/user`, `entities/audit`) — он уже работает против
  **IdentityService** `admin/users` + аудита. (Выпил контура из `sql-module-web` — не в этой миграции.)
- Адаптировать навигацию/маршруты под платформу, оставить контракт Identity API как есть.
- `/admin/profiles` (`Education` `admin/profiles` + assignable-students), если это админ-экран.
- **Гейт:** `typecheck` + `build` + живой smoke create / block / смена роли.

### Phase 4 — Контур преподавателя (крупная фаза)
Портировать в порядке зависимостей, каждая страница = слайс, удаляет свою legacy-страницу:
- `teacher/courses` (список + модалка create/delete) → `courses` + `courses/teacher`.
- `teacher/courses/:courseId` (список модулей, назначение студентов) →
  `courses/{id}` `/modules` `/assignable-students`.
- `teacher/modules/:moduleId` (вкладки теория / практика / вопросы).
- `teacher/theories/:theoryId` (заголовок / текст / ссылки / документы).
- `teacher/practicals/:practicalId` (сбор вопросов, попытки, пороги, публикация) →
  `practicals/{id}/questions` `/publish`.
- `teacher/practicals/:practicalId/tasks/:taskId` (текст задания, сдачи, приём + оценка,
  комментарии) → `tasks/*`, `task-files/*`.
- `teacher/practicals/:practicalId/protocols` + протокол по результату.
- **Гейт** на страницу: `typecheck` + `build`; в конце фазы — живой smoke полного цикла
  авторинга.

### Phase 5 — Контур студента
- `student/courses` → `courses/student`.
- `student/courses/:courseId` → модули.
- `student/modules/:moduleId` (список теории, список практик, оценки).
- `student/theories/:theoryId` (read-only rich text + ссылки + документы).
- `student/practicals/:practicalId` (тест: status → start → questions → submit;
  задание: загрузка файла, комментарии, оценка).
- `student/practicals/:practicalId/protocols` + просмотр протокола.
- Ленивая загрузка страниц студента и редакторов (как в `sql-module-web`).
- **Гейт:** живой smoke — пройти тест + сдать задание + увидеть оценку.

### Phase 6 — Cutover
- Навигация, домашние страницы по ролям, 404.
- Полный ручной регресс по трём ролям против запущенных `Education` + `IdentityService`.
- Обновить `compose.yaml` / деплой — раздавать новое приложение, указать на `Education` API.
- Удалить `Frontend/platform` (legacy) или перенести в `legacy/`.
- README (запуск / build / runtime-config); при необходимости перенести историю `promts/`.

### Phase 7 — Долг
- Route-level code splitting для teacher/admin (в `sql-module-web` TD-002 ещё открыт — не наследовать).
- Серверная пагинация больших списков.
- Именованные enum в OpenAPI (их TD-012), чтобы не привязываться к порядку числовых значений.

---

## 7. Оценка объёма (грубо, без календаря)

| Фаза | Объём | Комментарий |
|---|---|---|
| 1 Скелет | S | в основном копирование из `sql-module-web` |
| 2 Shared/entities | **L** | `features/questions` + rich text + модели сущностей |
| 3 Админка | S–M | вероятно переиспользуется из `sql-module-web` |
| 4 Преподаватель | **L** | ~7 страниц, самая насыщенная логика |
| 5 Студент | M–L | ~6 страниц |
| 6 Cutover | M | регресс + переключение |
| 7 Долг | S | опционально, после паритета |

---

## 8. Открытые вопросы

1. Целевой бэкенд — новый `Education` API (не legacy `:8000`)? Запускается сейчас?
2. `Education` API полнофункционален относительно legacy-экранов? Известные пробелы?
3. Админка пользователей — через IdentityService (как в `sql-module-web`)? Верно?
4. Новая папка `Frontend/platform-web`, старую убрать на cutover — ок?
5. Rich-text: `@mantine/tiptap` подходит?
6. Принимаем конвенции `AGENTS.md` + `docs/TECH_DEBT.md` (`TD-NNN`) здесь?
7. Приложение когда-нибудь встраивается в другой хост или всегда standalone?
8. Локализация — оставляем RU-only хардкодом?
