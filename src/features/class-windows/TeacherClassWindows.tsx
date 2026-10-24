import { Alert, Badge, Button, Group, Select, Stack, Switch, Table, Text } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  getGetCourseClassWindowsQueryKey,
  useExtendClassWindow,
  useFinishClassWindow,
  useGetCourseClassWindows,
  useSetCoursePracticeAccess,
  useStartClassWindow,
} from '../../api/education/class-windows/class-windows';
import { AppCard } from '../../shared/ui';
import { formatRemaining } from './ClassAccessGate';

const DURATIONS = [
  { value: '45', label: '45 минут' },
  { value: '90', label: '90 минут (пара)' },
  { value: '135', label: '135 минут' },
  { value: '180', label: '3 часа' },
  { value: '240', label: '4 часа' },
];

function formatTime(value: string) {
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Вкладка преподавателя «Пары»: режим курса, запуск, продление и завершение пар по группам. */
export function TeacherClassWindows({ courseId }: { courseId: string }) {
  const queryClient = useQueryClient();
  const query = useGetCourseClassWindows(courseId, { query: { retry: false, refetchInterval: 20_000 } });
  const startMutation = useStartClassWindow();
  const extendMutation = useExtendClassWindow();
  const finishMutation = useFinishClassWindow();
  const modeMutation = useSetCoursePracticeAccess();

  const [group, setGroup] = useState<string | null>(null);
  const [duration, setDuration] = useState<string>('90');
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const data = query.data?.status === 200 ? query.data.data : undefined;
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: getGetCourseClassWindowsQueryKey(courseId) });

  const reasonOf = (response: { status: number; data: unknown }, fallback: string) => {
    const body = response.data as { detail?: string } | undefined;
    return body?.detail ?? fallback;
  };

  const start = async () => {
    if (!group) {
      return;
    }
    setError(null);
    const response = await startMutation
      .mutateAsync({ courseId, data: { groupName: group, durationMinutes: Number(duration) } })
      .catch(() => null);
    if (!response) {
      setError('Education API недоступен.');
      return;
    }
    if (response.status !== 200) {
      setError(reasonOf(response, 'Не удалось начать пару.'));
    }
    await refresh();
  };

  const extend = async (windowId: string, minutes: number) => {
    setError(null);
    const response = await extendMutation.mutateAsync({ windowId, data: { minutes } }).catch(() => null);
    if (!response || response.status !== 200) {
      setError(response ? reasonOf(response, 'Не удалось продлить пару.') : 'Education API недоступен.');
    }
    await refresh();
  };

  const finish = async (windowId: string) => {
    setError(null);
    const response = await finishMutation.mutateAsync({ windowId }).catch(() => null);
    if (!response || response.status !== 200) {
      setError(response ? reasonOf(response, 'Не удалось завершить пару.') : 'Education API недоступен.');
    }
    await refresh();
  };

  const toggleMode = async (value: boolean) => {
    setError(null);
    const response = await modeMutation
      .mutateAsync({ courseId, data: { practiceOnlyDuringClass: value } })
      .catch(() => null);
    if (!response || response.status !== 204) {
      setError('Не удалось изменить режим курса.');
    }
    await refresh();
  };

  const windows = data?.windows ?? [];
  const active = windows.filter((item) => item.isActive && new Date(item.endsAt).getTime() > now);
  const history = windows.filter((item) => !active.includes(item));
  const busyGroups = new Set(active.map((item) => item.groupName.toLowerCase()));

  return (
    <Stack gap="md">
      <AppCard p="md">
        <Stack gap="sm">
          <Switch
            label="Тесты и практика только на парах"
            description="Когда включено, студенты запускают тесты, практику и сдают файлы только пока идёт пара их группы. Теория и результаты открыты всегда."
            checked={data?.practiceOnlyDuringClass ?? false}
            disabled={!data || modeMutation.isPending}
            onChange={(event) => void toggleMode(event.currentTarget.checked)}
          />
        </Stack>
      </AppCard>

      {error ? (
        <Alert color="red" variant="light" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : null}

      <AppCard p="md">
        <Stack gap="sm">
          <Text fw={600}>Начать пару</Text>
          {data && data.groups.length === 0 ? (
            <Text size="sm" c="dimmed">
              На курс не назначены студенты с указанной группой. Назначьте студентов и задайте им группу.
            </Text>
          ) : (
            <Group align="flex-end" gap="sm" wrap="wrap">
              <Select
                label="Группа"
                placeholder="Выберите группу"
                data={(data?.groups ?? []).map((name) => ({
                  value: name,
                  label: name,
                  disabled: busyGroups.has(name.toLowerCase()),
                }))}
                value={group}
                onChange={setGroup}
                w={200}
              />
              <Select
                label="Длительность"
                data={DURATIONS}
                value={duration}
                onChange={(value) => setDuration(value ?? '90')}
                allowDeselect={false}
                w={200}
              />
              <Button onClick={() => void start()} disabled={!group} loading={startMutation.isPending}>
                Начать пару
              </Button>
            </Group>
          )}
        </Stack>
      </AppCard>

      {active.length > 0 ? (
        <AppCard p="md">
          <Stack gap="sm">
            <Text fw={600}>Идут сейчас</Text>
            {active.map((item) => (
              <Group key={item.id} justify="space-between" wrap="wrap" gap="sm">
                <Group gap="sm">
                  <Badge color="green" variant="light">
                    {item.groupName}
                  </Badge>
                  <Text size="sm">
                    до {formatTime(item.endsAt)} · осталось{' '}
                    {formatRemaining(new Date(item.endsAt).getTime() - now)}
                  </Text>
                </Group>
                <Group gap="xs">
                  <Button
                    size="xs"
                    variant="light"
                    loading={extendMutation.isPending}
                    onClick={() => void extend(item.id, 15)}
                  >
                    +15 мин
                  </Button>
                  <Button
                    size="xs"
                    variant="light"
                    color="red"
                    loading={finishMutation.isPending}
                    onClick={() => void finish(item.id)}
                  >
                    Завершить
                  </Button>
                </Group>
              </Group>
            ))}
          </Stack>
        </AppCard>
      ) : null}

      <AppCard p={0}>
        <Table striped withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Группа</Table.Th>
              <Table.Th>Начало</Table.Th>
              <Table.Th>Конец</Table.Th>
              <Table.Th>Статус</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {history.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={4}>
                  <Text size="sm" c="dimmed">
                    Завершённых пар пока нет.
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              history.map((item) => (
                <Table.Tr key={item.id}>
                  <Table.Td>{item.groupName}</Table.Td>
                  <Table.Td>{formatTime(item.startsAt)}</Table.Td>
                  <Table.Td>{formatTime(item.endsAt)}</Table.Td>
                  <Table.Td>{item.closedAt ? 'Завершена досрочно' : 'Закончилась'}</Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </AppCard>
    </Stack>
  );
}
