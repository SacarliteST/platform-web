import { Alert, Badge, Button, Group, Select, Stack, Table, Text } from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import { useGetCourseClassWindows } from '../../../api/education/class-windows/class-windows';
import {
  useListTaskAssignments,
  useRegenerateTaskAssignments,
} from '../../../api/education/task-assignments/task-assignments';
import { AppCard } from '../../../shared/ui';
import { AssignmentStateBadge } from './AssignmentStateBadge';

type Props = {
  practicalId: string;
  courseId: string;
};

/** Таблица «студент → случайные задания» по выбранной паре + пересбор набора (преподаватель). */
export function TeacherAssignmentSets({ practicalId, courseId }: Props) {
  const windowsQuery = useGetCourseClassWindows(courseId, {
    query: { enabled: Boolean(courseId), retry: false },
  });
  const windows = useMemo(
    () => (windowsQuery.data?.status === 200 ? windowsQuery.data.data.windows : []),
    [windowsQuery.data],
  );

  const [classWindowId, setClassWindowId] = useState<string | null>(null);

  useEffect(() => {
    if (classWindowId || windows.length === 0) {
      return;
    }
    const active = windows.find((window) => window.isActive);
    setClassWindowId((active ?? windows[0]).id);
  }, [classWindowId, windows]);

  return (
    <AppCard p="md">
      <Stack gap="sm">
        <Text fw={600}>Наборы заданий по парам</Text>
        <Select
          label="Пара"
          placeholder={windowsQuery.isPending ? 'Загрузка…' : 'Выберите пару'}
          data={windows.map((window) => ({
            value: window.id,
            label: `${formatWindowTime(window.startsAt)} — ${formatWindowTime(window.endsAt)}${
              window.groupName ? ` · ${window.groupName}` : ''
            }${window.isActive ? ' · идёт' : ''}`,
          }))}
          value={classWindowId}
          onChange={setClassWindowId}
          disabled={windows.length === 0}
          w={{ base: '100%', sm: 420 }}
        />
        {windows.length === 0 && !windowsQuery.isPending ? (
          <Text size="sm" c="dimmed">
            У курса ещё нет пар — наборы сформируются при открытии пары.
          </Text>
        ) : null}
        {classWindowId ? (
          <AssignmentsTable practicalId={practicalId} classWindowId={classWindowId} />
        ) : null}
      </Stack>
    </AppCard>
  );
}

function formatWindowTime(value: string): string {
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function AssignmentsTable({
  practicalId,
  classWindowId,
}: {
  practicalId: string;
  classWindowId: string;
}) {
  const assignmentsQuery = useListTaskAssignments(
    practicalId,
    { classWindowId },
    { query: { enabled: Boolean(classWindowId), retry: false } },
  );
  const regenerateMutation = useRegenerateTaskAssignments();
  const [error, setError] = useState<string | null>(null);

  const rows = assignmentsQuery.data?.status === 200 ? assignmentsQuery.data.data : null;

  const regenerate = async (studentId: string) => {
    setError(null);
    const response = await regenerateMutation
      .mutateAsync({ practicalId, data: { studentId, classWindowId } })
      .catch(() => null);
    if (response && response.status === 204) {
      await assignmentsQuery.refetch();
      return;
    }
    setError(
      response && response.status === 409
        ? 'У студента уже есть запущенные сессии — набор пересобрать нельзя.'
        : 'Не удалось пересобрать набор.',
    );
  };

  if (assignmentsQuery.isPending) {
    return (
      <Text size="sm" c="dimmed">
        Загрузка наборов…
      </Text>
    );
  }
  if (!rows) {
    return (
      <Alert color="red" variant="light">
        Не удалось загрузить наборы заданий.
      </Alert>
    );
  }
  if (rows.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        На пару не назначен ни один студент.
      </Text>
    );
  }

  return (
    <Stack gap="xs">
      {error ? (
        <Alert color="red" variant="light" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : null}
      <Table striped withTableBorder withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Студент</Table.Th>
            <Table.Th>Задания</Table.Th>
            <Table.Th w={130}>Действия</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row) => {
            const hasSessions = row.tasks.some((task) => task.lastState !== null);
            return (
              <Table.Tr key={row.studentId}>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {row.studentName}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Stack gap={4}>
                    {row.tasks.map((task) => (
                      <Group key={task.assignmentId} gap="xs" wrap="nowrap">
                        <Text size="sm">
                          {task.sortOrder}. {task.externalTaskRef}
                        </Text>
                        <AssignmentStateBadge state={task.lastState} />
                        {task.bestGrade !== null ? (
                          <Badge color="green" radius="sm" variant="light">
                            {task.bestGrade}
                          </Badge>
                        ) : null}
                      </Group>
                    ))}
                  </Stack>
                </Table.Td>
                <Table.Td>
                  <Button
                    size="xs"
                    variant="subtle"
                    disabled={hasSessions}
                    loading={regenerateMutation.isPending}
                    title={
                      hasSessions
                        ? 'Студент уже начал работу — пересбор недоступен'
                        : 'Пересобрать случайный набор'
                    }
                    onClick={() => void regenerate(row.studentId)}
                  >
                    Пересобрать
                  </Button>
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}
