# Backend handoff — недостающие write-эндпоинты контура преподавателя

Дата: 2026-09-02. **Статус: реализовано и покрыто тестами.**
Проект бэкенда: `Education` (`C:\Users\vladislav.bokovoi\SQLTren\Education`).
Контекст: миграция веба платформы (`Frontend/platform-web`). Гэп-анализ —
[`../../../PHASE0_API_GAP.md`](../../../PHASE0_API_GAP.md).

## Итог реализации

Все шесть эндпоинтов добавлены срезами Contracts → Application → Infrastructure → Web
по эталону legacy `Education/Education/Controllers/TeacherController.cs`:

- **G-1** `POST /api/v1/practicals/{practicalId}/tasks` → `TaskResponse`, `TeacherOnly`,
  проверка владения практикой, дефолтный текст `"Текст задания"` (как в legacy `CreateTask`).
- **G-2** `DELETE /api/v1/tasks/{taskId}` → `204`, `TeacherOnly`, проверка владения заданием,
  `ExecuteDeleteAsync` + каскад БД на `CaseFile`/`CaseFileComment`.
- **G-3** `PUT /api/v1/tasks/{taskId}/text` (`{ "text": string }`) → `204`, `TeacherOnly`,
  доменный метод `Case.UpdateText`.
- **G-4** `DELETE /api/v1/practicals/{practicalId}` → `204`, `TeacherOnly`,
  `ExecuteDeleteAsync` + каскад БД на `Case`/`TestResult`/`PracticalMaterialBindQuestion`/
  `PracticalBindUser`.
- **G-5** `PUT /api/v1/courses/{courseId}/students` (`{ "userIds": [uuid] }`) → `204` / `404`,
  **`AdminOnly`**, срез `AdminProfiles`, полная замена набора `CourseBindUser` (reconcile).
- **G-6** `PUT /api/v1/practicals/{practicalId}/students` (`{ "userIds": [uuid] }`) → `204` / `404`,
  **`AdminOnly`**, срез `AdminProfiles`, полная замена набора `PracticalBindUser` (reconcile).

Отклонение от legacy: G-5/G-6 под `AdminOnly` (не `TeacherOnly`) — парные reads
`…/assignable-students` в новом бэкенде уже `AdminOnly`; write разместили там же.

Тесты: `tests/Education.Tests/Practicals/TeacherWriteEndpointsApiTests.cs` (15 кейсов:
happy path, чужой преподаватель → 403, валидация → 400, неизвестный курс/практика → 404,
не-админ → 403). Полный прогон Education.Tests: **77/77**.

Изменённые файлы:
- `src/Education.Contracts`: `Practicals/{CreateTaskRequest,UpdateTaskTextRequest,UpdatePracticalStudentsRequest}.cs`,
  `Courses/UpdateCourseStudentsRequest.cs`, `ApiRoutes.cs` (класс `Tasks`, `Courses.CourseStudents`, `Practicals.Students`).
- `src/Education.Application`: `Practicals/{CreateTaskCommand,UpdateTaskTextCommand}.cs`,
  `AdminProfiles/{SetCourseStudentsCommand,SetPracticalStudentsCommand}.cs`, интерфейсы и сервисы срезов.
- `src/Education.Infrastructure`: `EfPracticalsRepository`, `EfAdminProfilesRepository`.
- `src/Education.Web`: `Endpoints/Practicals/*`, `Endpoints/AdminProfiles/*`, `Program.cs` (регистрация валидаторов).

## Суть

В legacy-вебе преподаватель управляет заданиями практики, удаляет практики и назначает
студентов на курс/практику. В новом `Education` API этих операций нет **ни на уровне
эндпоинтов, ни на уровне `Education.Application`** (проверено по сигнатурам сервисов).
Доменные примитивы при этом есть: `Case.UpdateText`, конструкторы `Case`,
`CourseBindUser`, `PracticalBindUser`.

Frontend-задачи `TEA-004`, `TEA-009` (удаление), `TEA-010` (назначение), `TEA-011`
заблокированы до реализации.

## Требуемые эндпоинты

Все — под `RequireAuthorization(AuthorizationPolicies.TeacherOnly)`, с проверкой владения
(преподаватель — владелец курса/практики), стиль ответов и валидации — как у соседних
эндпоинтов (`ProblemDetails` / `HttpValidationProblemDetails`, `204 No Content` на
мутациях без тела, `404` при отсутствии/не-владении).

### G1 — создание задания практики
`POST /api/v1/practicals/{practicalId}/tasks`
Тело: `{ "name": string, "text": string }` (`text` может быть пустым — как в legacy `CreateTask`).
Ответ: `201` + `TaskResponse { id, name, text }`.
Домен: добавить `Case` в агрегат `PracticalMaterial` (сейчас фабрики через агрегат нет).

### G2 — удаление задания
`DELETE /api/v1/tasks/{taskId}`
Ответ: `204`. Каскад: удалить `CaseFile` и `CaseFileComment` задания (или запретить
удаление при наличии принятых сдач — на усмотрение бэкенда, зафиксировать в контракте).

### G3 — правка текста задания
`PUT /api/v1/tasks/{taskId}/text`
Тело: `{ "text": string }`. Ответ: `204`. Домен: `Case.UpdateText` уже есть.

### G4 — удаление практики
`DELETE /api/v1/practicals/{practicalId}`
Ответ: `204`. Каскад/запрет: определить поведение при наличии `TestResult` и `CaseFile`
(удалять каскадно либо `409`, если есть сданные попытки) — зафиксировать в контракте.

### G5 — назначение студентов на курс
`PUT /api/v1/courses/{courseId}/students`
Тело: `{ "userIds": [uuid, ...] }` — полный желаемый набор (legacy семантика
`UpdateCourseStudents`: пришедший список замещает текущий).
Ответ: `204`. Пишет `CourseBindUser` (добавляет недостающие, удаляет отсутствующие).
`userIds` — это `legacyUserId` из `GET /courses/{courseId}/assignable-students`.

### G6 — назначение студентов на практику
`PUT /api/v1/practicals/{practicalId}/students`
Тело: `{ "userIds": [uuid, ...] }` — полный желаемый набор.
Ответ: `204`. Пишет `PracticalBindUser`. `userIds` — `legacyUserId` из
`GET /practicals/{practicalId}/assignable-students`.

## Приёмка

- [x] Эндпоинты добавлены в `ApiRoutes` + группы эндпоинтов, покрыты политикой и проверкой владения.
- [x] `Education.Application` получил сервисные методы; домен не обходится напрямую из Web.
- [x] Каскады `G-2` / `G-4` — через FK `ON DELETE CASCADE` (конвенция EF для обязательных связей),
      как у существующих `DeleteCourseAsync` / `DeleteTheoryAsync`.
- [x] Интеграционные тесты (15) зелёные; полный прогон 77/77.
- [ ] Владелец экспортирует обновлённый OpenAPI (`platform_swagger.json`) — **на стороне владельца**.
- [ ] Перегенерировать Orval-клиент `platform-web` после экспорта swagger.

## Сделано на мастер-доске

`G-1…G-6` → `Done`. `TEA-009` / `TEA-010` / `TEA-011` разблокированы. Назначение студентов
(`G-5` / `G-6`) вынесено из `TEA-004` в новую карту `ADM-011` (контур администратора,
`AdminOnly`).
