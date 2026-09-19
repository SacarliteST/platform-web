import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Group,
  Pagination,
  SegmentedControl,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { keepPreviousData, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getCourseStudentAssignments,
  getGetCourseStudentAssignmentsQueryKey,
  getGetPracticalStudentAssignmentsQueryKey,
  getPracticalStudentAssignments,
  useChangeCourseStudents,
  useChangePracticalStudents,
  useGetCourseStudentAssignments,
  useGetPracticalStudentAssignments,
} from '../../../api/education/admin-profiles/admin-profiles';
import type {
  GetCourseStudentAssignmentsParams,
  StudentAssignmentEntryResponse,
} from '../../../api/education/model';
import { getEducationProblemMessage } from '../../../shared/lib';
import { AppCard, ConfirmModal, EmptyState } from '../../../shared/ui';
import {
  buildChangeBatches,
  countPending,
  isEffectivelyAssigned,
  setStudentAssigned,
  setStudentsAssigned,
  type PendingChanges,
  type StudentRef,
} from '../model/pending-changes';

type Props = {
  kind: 'course' | 'practical';
  id: string;
};

type AssignmentFilter = 'assigned' | 'all' | 'unassigned';

const PAGE_SIZE = 20;
/** Максимальный размер страницы на сервере — для сбора всех найденных при массовом выборе. */
const BULK_PAGE_SIZE = 200;
const SEARCH_DEBOUNCE_MS = 300;

const filterOptions = [
  { value: 'assigned', label: 'Назначены' },
  { value: 'all', label: 'Все' },
  { value: 'unassigned', label: 'Не назначены' },
];

function toAssignedParam(filter: AssignmentFilter): boolean | undefined {
  if (filter === 'assigned') return true;
  if (filter === 'unassigned') return false;
  return undefined;
}

function toRef(student: StudentAssignmentEntryResponse): StudentRef {
  return {
    id: student.legacyUserId,
    name: student.fullName.trim() || student.login,
    isAssigned: student.isAssigned,
  };
}

function studentsWord(count: number): string {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return 'студентов';
  if (last === 1) return 'студент';
  if (last >= 2 && last <= 4) return 'студента';
  return 'студентов';
}

/**
 * Преподаватель: назначение студентов на курс / практику. Список постраничный, с поиском и фильтром;
 * правки копятся локально и уходят одним запросом «добавить / убрать», не затрагивая остальных.
 */
export function StudentAssignmentCard({ kind, id }: Props) {
  const isCourse = kind === 'course';
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const [filter, setFilter] = useState<AssignmentFilter>('assigned');
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<PendingChanges>(new Map());
  const [notice, setNotice] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [bulk, setBulk] = useState<{ assigned: boolean; students: StudentRef[] } | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const initialised = useRef(false);

  const params: GetCourseStudentAssignmentsParams = {
    search: debouncedSearch || undefined,
    assigned: toAssignedParam(filter),
    page,
    pageSize: PAGE_SIZE,
  };

  const courseQuery = useGetCourseStudentAssignments(id, params, {
    query: { enabled: isCourse && Boolean(id), retry: false, placeholderData: keepPreviousData },
  });
  const practicalQuery = useGetPracticalStudentAssignments(id, params, {
    query: { enabled: !isCourse && Boolean(id), retry: false, placeholderData: keepPreviousData },
  });
  const listQuery = isCourse ? courseQuery : practicalQuery;
  const data = listQuery.data?.status === 200 ? listQuery.data.data : undefined;

  const changeCourse = useChangeCourseStudents();
  const changePractical = useChangePracticalStudents();
  const saving = isCourse ? changeCourse.isPending : changePractical.isPending;

  // Первый показ: если на курс ещё никого не назначили, сразу открываем «Все», а не пустой список.
  useEffect(() => {
    if (!data || initialised.current) return;
    initialised.current = true;
    if (data.assignedCount === 0) setFilter('all');
  }, [data]);

  const items = data?.items ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.totalCount / PAGE_SIZE)) : 1;
  const counts = useMemo(() => countPending(pending), [pending]);
  const assignedTotal = data ? data.assignedCount + counts.add - counts.remove : 0;
  const pageRefs = useMemo(() => items.map(toRef), [items]);
  const allOnPageAssigned =
    pageRefs.length > 0 && pageRefs.every((student) => isEffectivelyAssigned(pending, student));
  const someOnPageAssigned = pageRefs.some((student) => isEffectivelyAssigned(pending, student));

  const changeSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const changeFilter = (value: string) => {
    setFilter(value as AssignmentFilter);
    setPage(1);
  };

  const fetchPage = (pageNumber: number) => {
    const bulkParams: GetCourseStudentAssignmentsParams = {
      search: debouncedSearch || undefined,
      assigned: toAssignedParam(filter),
      page: pageNumber,
      pageSize: BULK_PAGE_SIZE,
    };
    return isCourse
      ? getCourseStudentAssignments(id, bulkParams)
      : getPracticalStudentAssignments(id, bulkParams);
  };

  /** Собирает всех найденных по текущему поиску и фильтру: страницами по 200 и с подтверждением. */
  const startBulk = async (assigned: boolean) => {
    setNotice(null);
    setBulkLoading(true);
    try {
      const students: StudentRef[] = [];
      for (let pageNumber = 1; ; pageNumber += 1) {
        const response = await fetchPage(pageNumber);
        if (response.status !== 200) throw new Error(String(response.status));
        students.push(...response.data.items.map(toRef));
        if (response.data.items.length === 0 || students.length >= response.data.totalCount) break;
      }
      const affected = students.filter((student) => isEffectivelyAssigned(pending, student) !== assigned);
      if (affected.length === 0) {
        setNotice({
          tone: 'ok',
          text: assigned ? 'Все найденные уже назначены.' : 'Среди найденных нет назначенных.',
        });
        return;
      }
      setBulk({ assigned, students });
    } catch {
      setNotice({ tone: 'err', text: 'Не удалось получить список найденных студентов.' });
    } finally {
      setBulkLoading(false);
    }
  };

  const confirmBulk = () => {
    if (bulk) setPending((current) => setStudentsAssigned(current, bulk.students, bulk.assigned));
    setBulk(null);
  };

  const save = async () => {
    setNotice(null);
    const batches = buildChangeBatches(pending);
    try {
      for (const batch of batches) {
        const response = await (isCourse
          ? changeCourse.mutateAsync({ courseId: id, data: batch })
          : changePractical.mutateAsync({ practicalId: id, data: batch }));
        if (response.status === 204) continue;
        if (response.status === 403) {
          setNotice({ tone: 'err', text: 'Нет доступа — курс или практика принадлежат другому преподавателю.' });
        } else {
          setNotice({
            tone: 'err',
            text:
              response.data && typeof response.data === 'object'
                ? getEducationProblemMessage(response.data, response.status)
                : 'Не удалось сохранить список студентов.',
          });
        }
        await refresh();
        return;
      }
    } catch {
      setNotice({ tone: 'err', text: 'Education API недоступен.' });
      return;
    }

    setPending(new Map());
    setNotice({ tone: 'ok', text: 'Список студентов сохранён.' });
    await refresh();
  };

  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: isCourse
        ? getGetCourseStudentAssignmentsQueryKey(id)
        : getGetPracticalStudentAssignmentsQueryKey(id),
    });

  const listFailed = listQuery.isError || (listQuery.data !== undefined && listQuery.data.status !== 200);
  const noAssignedYet = filter === 'assigned' && !debouncedSearch && data?.assignedCount === 0;

  return (
    <AppCard p="md">
      <Stack gap="sm">
        <Group justify="space-between" wrap="wrap" gap="xs">
          <Text fw={600}>Студенты</Text>
          {data ? (
            <Badge color="indigo" radius="sm" variant="light">
              Назначено: {assignedTotal}
            </Badge>
          ) : null}
        </Group>

        {notice ? (
          <Alert
            color={notice.tone === 'ok' ? 'green' : 'red'}
            variant="light"
            withCloseButton
            onClose={() => setNotice(null)}
          >
            {notice.text}
          </Alert>
        ) : null}

        <Group gap="sm" align="flex-end" wrap="wrap">
          <TextInput
            aria-label="Поиск студента"
            placeholder="Поиск по ФИО или логину"
            value={search}
            onChange={(event) => changeSearch(event.currentTarget.value)}
            style={{ flex: '1 1 220px' }}
          />
          <SegmentedControl
            aria-label="Фильтр по назначению"
            data={filterOptions}
            value={filter}
            onChange={changeFilter}
          />
        </Group>

        {listFailed ? (
          <Alert color="red" variant="light" title="Education API недоступен">
            Не удалось загрузить список студентов.
          </Alert>
        ) : listQuery.isPending ? (
          <Text c="dimmed" size="sm">
            Загрузка…
          </Text>
        ) : data && items.length === 0 ? (
          noAssignedYet ? (
            <EmptyState
              title="Назначенных студентов пока нет"
              description="Откройте «Все», найдите студентов и отметьте нужных."
            />
          ) : (
            <EmptyState title="Никого не найдено" description="Измените поиск или фильтр." />
          )
        ) : data ? (
          <>
            <Group gap="xs" wrap="wrap">
              <Button
                size="xs"
                variant="light"
                loading={bulkLoading}
                disabled={filter === 'assigned' || data.totalCount === 0}
                onClick={() => void startBulk(true)}
              >
                Назначить всех найденных ({data.totalCount})
              </Button>
              <Button
                size="xs"
                variant="light"
                color="gray"
                loading={bulkLoading}
                disabled={filter === 'unassigned' || data.totalCount === 0}
                onClick={() => void startBulk(false)}
              >
                Снять всех найденных
              </Button>
              <Text size="xs" c="dimmed">
                Найдено: {data.totalCount}
              </Text>
            </Group>

            <Table.ScrollContainer minWidth={420}>
              <Table verticalSpacing="xs" highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th w={40}>
                      <Checkbox
                        aria-label="Выбрать всех на странице"
                        checked={allOnPageAssigned}
                        indeterminate={someOnPageAssigned && !allOnPageAssigned}
                        onChange={(event) =>
                          setPending((current) =>
                            setStudentsAssigned(current, pageRefs, event.currentTarget.checked),
                          )
                        }
                      />
                    </Table.Th>
                    <Table.Th>Студент</Table.Th>
                    <Table.Th>Логин</Table.Th>
                    <Table.Th w={130}>Статус</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {items.map((student) => {
                    const ref = toRef(student);
                    const checked = isEffectivelyAssigned(pending, ref);
                    const change = pending.get(ref.id);
                    return (
                      <Table.Tr key={student.legacyUserId}>
                        <Table.Td>
                          <Checkbox
                            aria-label={`Назначить: ${ref.name}`}
                            checked={checked}
                            onChange={(event) =>
                              setPending((current) =>
                                setStudentAssigned(current, ref, event.currentTarget.checked),
                              )
                            }
                          />
                        </Table.Td>
                        <Table.Td>{ref.name}</Table.Td>
                        <Table.Td>
                          <Text size="sm" c="dimmed">
                            {student.login}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          {change ? (
                            <Badge color={change.assigned ? 'green' : 'yellow'} radius="sm" variant="light">
                              {change.assigned ? 'Будет назначен' : 'Будет снят'}
                            </Badge>
                          ) : student.isAssigned ? (
                            <Badge color="indigo" radius="sm" variant="light">
                              Назначен
                            </Badge>
                          ) : (
                            <Text size="xs" c="dimmed">
                              Не назначен
                            </Text>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>

            {totalPages > 1 ? (
              <Group justify="center">
                <Pagination size="sm" total={totalPages} value={Math.min(page, totalPages)} onChange={setPage} />
              </Group>
            ) : null}
          </>
        ) : null}

        <Group justify="space-between" wrap="wrap" gap="xs">
          <Text size="sm" c={pending.size > 0 ? undefined : 'dimmed'}>
            {pending.size > 0
              ? `Изменения: назначить ${counts.add}, снять ${counts.remove}`
              : 'Изменений нет'}
          </Text>
          <Group gap="xs">
            <Button
              size="xs"
              variant="default"
              disabled={pending.size === 0 || saving}
              onClick={() => setPending(new Map())}
            >
              Сбросить
            </Button>
            <Button size="xs" disabled={pending.size === 0} loading={saving} onClick={() => void save()}>
              Сохранить
            </Button>
          </Group>
        </Group>
      </Stack>

      <ConfirmModal
        opened={bulk !== null}
        title={bulk?.assigned ? 'Назначить всех найденных?' : 'Снять всех найденных?'}
        message={(() => {
          if (!bulk) return '';
          const count = bulk.students.filter(
            (student) => isEffectivelyAssigned(pending, student) !== bulk.assigned,
          ).length;
          return `${bulk.assigned ? 'Будут назначены' : 'Будут сняты'} ${count} ${studentsWord(count)}. Изменения вступят в силу после нажатия «Сохранить».`;
        })()}
        confirmLabel={bulk?.assigned ? 'Назначить' : 'Снять'}
        confirmColor="blue"
        onCancel={() => setBulk(null)}
        onConfirm={confirmBulk}
      />
    </AppCard>
  );
}
