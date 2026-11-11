import { Alert, Badge, Button, Group, Stack, Text } from '@mantine/core';
import { useState } from 'react';
import {
  useGetMyTaskAssignments,
  useStartModuleSessionByAssignment,
} from '../../../api/education/task-assignments/task-assignments';
import { toNumber } from '../../../shared/lib';
import { AppCard } from '../../../shared/ui';
import { useClassLock } from '../../class-windows';
import { AssignmentStateBadge } from './AssignmentStateBadge';

type Props = {
  practicalId: string;
};

/** Список случайных заданий студента на текущую пару с запуском каждого в модуле. */
export function StudentRandomAssignments({ practicalId }: Props) {
  const assignmentsQuery = useGetMyTaskAssignments(practicalId, {
    query: { retry: false, refetchInterval: 10_000 },
  });
  const startMutation = useStartModuleSessionByAssignment();
  const locked = useClassLock();
  const [error, setError] = useState<string | null>(null);

  const start = async (assignmentId: string) => {
    setError(null);
    const response = await startMutation
      .mutateAsync({ practicalId, assignmentId })
      .catch(() => null);

    if (!response) {
      setError('Не удалось запустить — Education API недоступен.');
      return;
    }
    if (response.status === 200) {
      window.location.assign(response.data.launchUrl);
      return;
    }
    if (response.status === 403) {
      setError('Задания доступны только во время пары.');
      return;
    }
    if (response.status === 404) {
      setError('Задание не найдено — набор мог быть пересобран преподавателем. Обновите страницу.');
      void assignmentsQuery.refetch();
      return;
    }
    if (response.status === 409) {
      setError('Попытки по этому заданию исчерпаны.');
      void assignmentsQuery.refetch();
      return;
    }
    if (response.status === 502) {
      setError('Модуль сейчас недоступен. Попробуйте позже.');
      return;
    }
    setError('Не удалось запустить задание.');
  };

  if (assignmentsQuery.isPending) {
    return (
      <AppCard p="md">
        <Text size="sm" c="dimmed">
          Загрузка набора заданий…
        </Text>
      </AppCard>
    );
  }

  if (assignmentsQuery.data?.status === 404) {
    return (
      <Alert color="yellow" variant="light" title="Набор ещё не сформирован">
        Персональный набор заданий появится здесь при открытии пары. Если пара уже идёт —
        обновите страницу.
      </Alert>
    );
  }

  const data = assignmentsQuery.data?.status === 200 ? assignmentsQuery.data.data : null;
  if (!data) {
    return (
      <Alert color="red" variant="light" title="Education API недоступен">
        <Stack gap="xs">
          <Text size="sm">Не удалось загрузить набор заданий.</Text>
          <Button size="xs" variant="subtle" w="fit-content" onClick={() => void assignmentsQuery.refetch()}>
            Повторить
          </Button>
        </Stack>
      </Alert>
    );
  }

  return (
    <AppCard p="md">
      <Stack gap="sm">
        <Group justify="space-between" wrap="wrap" gap="xs">
          <Text fw={600}>Ваш набор заданий</Text>
          <Badge color="violet" radius="sm" variant="light">
            случайная выборка
          </Badge>
        </Group>

        {error ? (
          <Alert color="red" variant="light" withCloseButton onClose={() => setError(null)}>
            {error}
          </Alert>
        ) : null}

        <Stack gap="xs">
          {data.tasks.map((task) => (
            <Group key={task.assignmentId} justify="space-between" wrap="nowrap">
              <Group gap="xs" wrap="nowrap">
                <Text size="sm">
                  {task.sortOrder}. {task.externalTaskRef}
                </Text>
                <AssignmentStateBadge state={task.lastState} />
                {task.bestGrade !== null ? (
                  <Badge color="green" radius="sm" variant="light">
                    Оценка: {toNumber(task.bestGrade)}
                  </Badge>
                ) : null}
              </Group>
              <Button
                size="xs"
                variant={task.lastState === 'ACTIVE' ? 'filled' : 'light'}
                disabled={locked || task.lastState === 'COMPLETED' || task.lastState === 'EXPIRED'}
                loading={startMutation.isPending}
                onClick={() => void start(task.assignmentId)}
              >
                {task.lastState === 'ACTIVE' ? 'Продолжить' : 'Начать'}
              </Button>
            </Group>
          ))}
        </Stack>

        <Text size="xs" c="dimmed">
          Каждое задание запускается в модуле отдельно. Состояние обновляется автоматически.
        </Text>
      </Stack>
    </AppCard>
  );
}
