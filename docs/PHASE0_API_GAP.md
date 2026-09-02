# Phase 0 — Гэп-анализ API (legacy `platform` → новый `Education` API)

Дата: 2026-09-02.
Источник истины: `Frontend/platform/platform_swagger.json` (Education.Web v1, OpenAPI 3.1.1, 51 путь),
`Education/src/Education.Application/*` (проверка на уровне сервисов), legacy `src/services/*.service.js`.

---

## 1. Вердикт

Новый `Education` API покрывает **~85%** экранов legacy напрямую. Найдено **6 блокирующих
разрывов** — операции, которых нет ни на уровне эндпоинтов, ни на уровне Application-сервисов
`Education`. Все они в контуре преподавателя (управление заданиями, удаление практики,
назначение студентов). Без них Phase 4 не закрывается.

Админка пользователей целиком уходит в **IdentityService** (переносим контур из
`sql-module-web`), в `Education` её и не должно быть — это не разрыв.

---

## 2. Полная карта: legacy-вызов → новый эндпоинт

### auth.service.js
| Legacy | Новый | Статус |
|---|---|---|
| `POST api/Auth/Login` | IdentityService `POST /auth/login` | ✅ (Identity) |
| `GET api/Auth/IsSignedIn` | клиентская проверка JWT + `GET /api/v1/auth/me` | ✅ замена |
| `GET api/Auth/Logout` | `POST /api/v1/auth/logout` + Identity refresh revoke | ✅ |

### shared.service.js
| Legacy | Новый | Статус |
|---|---|---|
| `GET api/Shared/GetModules?courseId` | `GET /api/v1/courses/{courseId}/modules` | ✅ |
| `GET api/Shared/GetTheoryText?theoryId` | `GET /api/v1/theories/{theoryId}` → `TheoryTextResponse {text,name}` | ✅ |
| `GET api/Shared/GetTheoryLinks?theoryId` | `GET /api/v1/theories/{theoryId}/links` | ✅ |
| `GET api/Shared/GetTheoryDocs?theoryId` | `GET /api/v1/theories/{theoryId}/docs` | ✅ |
| `GET api/Shared/GetTaskText?taskId` | ⚠️ только через `GET /api/v1/practicals/{practicalId}/tasks` (список `TaskResponse` содержит `text`) | 🟡 workaround |

### teacher.service.js
| Legacy | Новый | Статус |
|---|---|---|
| `GET api/Teacher/GetCourses` | `GET /api/v1/courses/teacher` | ✅ |
| `POST CreateCourse` | `POST /api/v1/courses` | ✅ |
| `DELETE DeleteCourse?courseId` | `DELETE /api/v1/courses/{courseId}` | ✅ |
| `POST CreateModule` | `POST /api/v1/modules` | ✅ |
| `DELETE DeleteModule?moduleId` | `DELETE /api/v1/modules/{moduleId}` | ✅ |
| `GET GetTheories?moduleId` | `GET /api/v1/modules/{moduleId}/theories` → `TheoryListItemResponse[]` | ✅ |
| `POST CreateTheory` | `POST /api/v1/theories` | ✅ |
| `PUT UpdateTheoryText` | `PUT /api/v1/theories/{theoryId}/text` | ✅ |
| `PUT UpdateTheoryTitle` | `PUT /api/v1/theories/{theoryId}/title` | ✅ |
| `DELETE DeleteTheoryMaterial?theoryId` | `DELETE /api/v1/theories/{theoryId}` | ✅ |
| `POST CreateTheoryLink` | `POST /api/v1/theories/links` | ✅ |
| `DELETE DeleteTheoryLink?linkId` | `DELETE /api/v1/theories/links/{linkId}` | ✅ |
| `POST CreateTheoryDocument` (FormData) | `POST /api/v1/theories/docs` (multipart) | ✅ |
| `DELETE DeleteTheoryDoc?docId` | `DELETE /api/v1/theories/docs/{docId}` | ✅ |
| `GET GetQuestions?moduleId` | `GET /api/v1/modules/{moduleId}/questions` | ✅ |
| `POST CreateQuestion` | `POST /api/v1/questions` | ✅ |
| `PUT UpdateQuestion` | `PUT /api/v1/questions/{questionId}` | ✅ |
| `DELETE DeleteQuestion?questionId` | `DELETE /api/v1/questions/{questionId}` | ✅ |
| `GET GetPracticals?moduleId` | `GET /api/v1/modules/{moduleId}/practicals` | ✅ |
| `POST CreatePractical` | `POST /api/v1/practicals` | ✅ |
| `PUT MakePracticalPublic?practicalId` | `PUT /api/v1/practicals/{practicalId}/publish` | ✅ |
| `GET GetMakePracticalQuestions?moduleId&practId` | `GET /api/v1/practicals/{practicalId}/questions` → `PracticalQuestionsSetupResponse` | ✅ |
| `PUT UpdatePracticalMaterialQuestions` | `PUT /api/v1/practicals/{practicalId}/questions` (`ConfigurePracticalQuestionsRequest`) | ✅ |
| `GET GetTasks?practicalId` | `GET /api/v1/practicals/{practicalId}/tasks` | ✅ |
| `GET GetTaskFiles?taskId` | `GET /api/v1/tasks/{taskId}/files` | ✅ |
| `GET GetPracticalTaskFiles?practicalId` | `GET /api/v1/practicals/{practicalId}/task-files` | ✅ |
| `POST AddTaskFileComment` | `POST /api/v1/task-files/{taskFileId}/comments` | ✅ |
| `PUT AcceptTaskFile?taskFileId&grade` | `PUT /api/v1/task-files/{taskFileId}/accept` (`AcceptTaskFileRequest`) | ✅ |
| `GET GetTestProtocol?testResultId` | `GET /api/v1/test-results/{testResultId}/protocol` | ✅ |
| `GET GetUserProtocols?practicalId` | `GET /api/v1/practicals/{practicalId}/protocols/teacher` | ✅ |
| `GET GetStudents?courseId` | `GET /api/v1/courses/{courseId}/assignable-students` → `AssignableStudentResponse {legacyUserId,fullName,isAssigned}` | 🟡 чтение есть |
| `GET GetPracticalStudents?practicalId` | `GET /api/v1/practicals/{practicalId}/assignable-students` | 🟡 чтение есть |
| **`PUT UpdateCourseStudents` {courseId,userIds}** | — **нет** | ❌ БЛОКЕР |
| **`PUT UpdatePracticalStudents` {practicalId,userIds}** | — **нет** | ❌ БЛОКЕР |
| **`DELETE DeletePractical?practicalId`** | — **нет** | ❌ БЛОКЕР |
| **`POST CreateTask` {practicalId,name}** | — **нет** | ❌ БЛОКЕР |
| **`DELETE DeleteTask?taskId`** | — **нет** | ❌ БЛОКЕР |
| **`PUT UpdateTaskText` {taskId,text}** | — **нет** | ❌ БЛОКЕР |

### student.service.js
| Legacy | Новый | Статус |
|---|---|---|
| `GET api/Student/GetCourses` | `GET /api/v1/courses/student` | ✅ |
| `GET GetTheories?moduleId` | `GET /api/v1/modules/{moduleId}/theories` | ✅ |
| `GET GetPracticals?moduleId` | `GET /api/v1/modules/{moduleId}/practicals` | ✅ |
| `GET GetTasks?practicalId` | `GET /api/v1/practicals/{practicalId}/tasks` | ✅ |
| `GET GetTestStatus?practicalId` | `GET /api/v1/practicals/{practicalId}/test-status` → `TestStatusResponse` | ✅ |
| `PUT StartTest?practicalId` | `PUT /api/v1/practicals/{practicalId}/test/start` → `StartTestResponse` | ✅ |
| `GET GetPracticalQuestions?practId` | `GET /api/v1/practicals/{practicalId}/test/questions` → `TestQuestionsResponse` | ✅ |
| `POST UploadTest` {answers,practicalId} | `POST /api/v1/practicals/{practicalId}/test/submit` (`SubmitTestRequest`) | ✅ |
| `GET GetTaskFile?taskId` | `GET /api/v1/tasks/{taskId}/file` | ✅ |
| `PUT UploadTaskFile` (FormData) | `PUT /api/v1/tasks/{taskId}/file` (multipart) | ✅ |
| `GET GetProtocols?practicalId` | `GET /api/v1/practicals/{practicalId}/protocols` | ✅ |
| `GET GetProtocol?testResultId` | `GET /api/v1/test-results/{testResultId}/protocol` | ✅ |
| `GET GetPracticalGrade?practicalId` | `GET /api/v1/practicals/{practicalId}/grade` → `PracticalGradeResponse` | ✅ |

### users.service.js — весь контур в IdentityService
| Legacy | Новый | Статус |
|---|---|---|
| `GET api/User/GetAllUsers` | IdentityService `GET /admin/users` | ✅ (Identity, из `sql-module-web`) |
| `POST api/User/CreateUser` | IdentityService admin create | ✅ |
| `DELETE api/User/DeleteUser?id` | IdentityService | ✅ |
| `GET api/User/GetRoles` | статический enum `Admin/Teacher/Student` (`RoleNames`) | ✅ |
| `GET api/User/CanDeleteUser?id` | IdentityService (или проверка на клиенте) | 🟡 уточнить |

---

## 3. Блокирующие разрывы (нужна доработка бэкенда `Education`)

> **РЕШЕНО 2026-09-02.** Все шесть эндпоинтов реализованы в `Education` (Contracts →
> Application → Infrastructure → Web), 15 интеграционных тестов, полный прогон 77/77.
> Детали — [`./backend-requirements/2026-09-02-teacher-write-endpoints.md`](./backend-requirements/2026-09-02-teacher-write-endpoints.md).
> `G-5` / `G-6` (назначение студентов) размещены под `AdminOnly` в срезе `AdminProfiles`
> (парные reads там же), т.е. это контур администратора, а не преподавателя.
> Владельцу осталось экспортировать обновлённый OpenAPI и перегенерировать Orval.

Проверено: методов не было и в `Education.Application` (не только «не замаплен эндпоинт»).

| # | Операция | Где всплывает в UI | Что нужно на бэкенде |
|---|---|---|---|
| G1 | **Создание задания** практики | `MakeTaskPage`, `MakePracticalPage` | `POST /api/v1/practicals/{practicalId}/tasks` + сервис/доменный метод (в домене нет `Case`-фабрики через агрегат практики) |
| G2 | **Удаление задания** | `MakePracticalPage` | `DELETE /api/v1/tasks/{taskId}` |
| G3 | **Правка текста задания** | `MakeTaskPage` | `PUT /api/v1/tasks/{taskId}/text` (в домене `Case.UpdateText` уже есть) |
| G4 | **Удаление практики** | `ModulePage` | `DELETE /api/v1/practicals/{practicalId}` |
| G5 | **Назначение студентов на курс** | `CoursePage` вкладка «Студенты» | `PUT /api/v1/courses/{courseId}/students` {userIds} — писать `CourseBindUser` (сейчас есть только `GET assignable-students`) |
| G6 | **Назначение студентов на практику** | `MakePracticalPage` вкладка «Студенты» | `PUT /api/v1/practicals/{practicalId}/students` {userIds} — писать `PracticalBindUser` |

Примечание: домен это поддерживает (`Case.UpdateText`, `CourseBindUser`, `PracticalBindUser`
конструкторы) — не хватает Application-сервисов и эндпоинтов. По объёму — небольшая
бэкенд-задача, но **обязательная до Phase 4**.

---

## 4. Неблокирующие разрывы и обходные пути

| Тема | Ситуация | Обход |
|---|---|---|
| `GetTaskText` / нет `GET /tasks/{taskId}` | текст задания только в списке `GET /practicals/{id}/tasks` | грузить список практики, брать нужный `TaskResponse` по `taskId`; кэш Query по ключу практики |
| Нет `GET /modules/{moduleId}` | имя модуля отдельно не получить | брать из `GET /courses/{courseId}/modules` |
| Нет пагинации | все списки — плоские массивы (`IEnumerable<T>`), не `PagedResponse` | клиентская пагинация/фильтр (Mantine); в `entities` не завязываться на `items`-конверт как в `sql-module-web` |
| `CanDeleteUser` | связность профиля (курсы/практики) | проверять на бэкенде Identity либо ловить `409` при удалении |

---

## 5. Контрактные заметки для генерации и слоёв

1. **Роли.** JWT-claim `role`, значения `Admin|Teacher|Student` (Identity `RoleNames`).
   Политики бэкенда: `RoleClaimType = "role"`, `UserIdClaimType = "sub"`
   (`Education/src/Education.Web/appsettings.Development.json`). `decodeSessionUser` из
   `sql-module-web` уже это умеет.
2. **Типы вопросов — фиксированные GUID** (`Education.Domain.Tests.QuestionTypeIds`),
   эндпоинта-справочника нет — захардкодить в `features/questions`:
   - SingleChoice `20000000-0000-0000-0000-000000000001`
   - MultipleChoice `…0002`
   - Match `…0003`
   - ShortAnswer `…0004`
   `SelectableQuestionResponse.type` и `CreateQuestionRequest` оперируют этим GUID.
3. **Payload вопросов/ответов** — не менять, должен совпадать с `QuestionScoringService`
   (см. §5.4 основного плана). `QuestionResponse.body` / `SelectableQuestionResponse.body`
   = JSON-строка вариантов; `answer` = JSON-строка эталона.
4. **Числа как `number | string`.** .NET 10 OpenAPI отдаёт union-типы с `pattern`
   (`triesCount: [integer,string]`, `percentForFive: [number,string]`). Orval сгенерирует
   `number | string`. В `entities/*/lib` сделать нормализаторы (`Number(x)`), не тащить
   union в UI. Это их `TD-012`.
5. **Multipart.** `POST /theories/docs`, `PUT /tasks/{taskId}/file` — `multipart/form-data`
   со схемой `{ File: IFormFile, ... }`. В `orval.config.ts` проверить, что fetch-мутатор
   не ставит `Content-Type` и не сериализует `FormData` (в `sqlmodule-fetch.ts` уже ок,
   но генерируемый билд тела для multipart проверить).
6. **Скачивание файлов** — `GET /api/v1/files/{**storageKey}` под Bearer; в UI не давать
   голую `<a href>`, тянуть через fetch-мутатор с токеном → `blob`.
7. **`assignable-students`** возвращает `legacyUserId` (не identity `sub`) и `isAssigned`.
   Для формы назначения этого достаточно; для отображения ФИО — `fullName`.
8. **Ошибки** — `ProblemDetails` / `HttpValidationProblemDetails` (как в `sql-module-web`,
   переиспземяем `identity-problem-details.ts` / `getProblemMessage`).
9. **Identity OpenAPI** для Orval — берём `identity.swagger.json` из `sql-module-web`
   (контур администратора переносится оттуда же).

---

## 6. Статус чек-листа Phase 0 — **закрыт 2026-09-02**

| Пункт | Статус |
|---|---|
| Целевой бэкенд = `Education` API, запускается (`localhost:5135`, Scalar `/scalar/v1`) | ✅ |
| OpenAPI выгружен (`Frontend/platform/platform_swagger.json`, 56 путей) | ✅ |
| Гэп-анализ по всем экранам | ✅ (этот документ) |
| Админка — перенос из `sql-module-web`, потом выпил оттуда | ✅ решено |
| Rich-text = `@mantine/tiptap` | ✅ принято |
| БД: `education-postgres` в Docker, порт **5434**, `appsettings.Development` обновлён | ✅ |
| Legacy `platform` не трогаем — держим как источник истины | ✅ зафиксировано |
| **Блокеры G-1…G-6 — доработка `Education` бэкенда** | ✅ реализованы + 15 тестов (77/77); `G-5`/`G-6` → `AdminOnly` |
| Расположение нового фронта: `Frontend/platform-web` (новая папка) | ✅ создана, codegen-каркас поднят |
| Конвенции `AGENTS.md` + `docs/TECH_DEBT.md` (`TD-NNN`) в новом проекте | ✅ заведены (`AGENTS.md`, `docs/TECH_DEBT.md`, `docs/tech-debt/records/TD-001…007`) |
| Локализация: RU-only хардкодом (без i18n-библиотеки) | ✅ зафиксировано в `AGENTS.md` |
| Всегда standalone; паттерн `mount()` + runtime-config сохраняем | ✅ зафиксировано |
| Orval-клиенты `education` + `identity` сгенерированы, `tsc` чист | ✅ (PLT-003/005/006) |

---

## 7. Что дальше

Phase 0 завершена. Открыто на стороне владельца: переэкспорт OpenAPI при будущих
изменениях контракта + `npm run api:generate`.

Следующее — **Phase 1** (скелет: `eslint`, `AppProviders`, `AppLayout`, `AppRouter`,
гварды/`LoginPage`) по команде.
