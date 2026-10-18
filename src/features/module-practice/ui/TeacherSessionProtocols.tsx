import { Badge, Button, Group, Stack, Table, Text, TextInput } from '@mantine/core';
import { useMemo, useState } from 'react';
import { useListPracticalModuleSessions } from '../../../api/education/module-sessions/module-sessions';
import { formatDateTime, formatDuration, type SortDirection } from '../../../shared/lib';
import { AppCard, EmptyState, QueryBoundary, SortableTh } from '../../../shared/ui';
import {
  buildSessionRows,
  filterSessionRows,
  sortSessionRows,
  type SessionRow,
  type SessionSortKey,
} from '../model/session-rows';
import { SessionEventsFeed } from './SessionEventsFeed';

type Props = {
  practicalId: string;
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Идёт', color: 'blue' },
  COMPLETED: { label: 'Завершена', color: 'green' },
  EXPIRED: { label: 'Не завершена', color: 'gray' },
};

const END_REASON_LABEL: Record<string, string> = {
  completed: 'сдана',
  timeout: 'время вышло',
  abandoned: 'прервана студентом',
};

/** Направление по умолчанию при первом клике на столбец: текст — по возрастанию, числа и время — по убыванию. */
const DEFAULT_DIRECTION: Record<SessionSortKey, SortDirection> = {
  studentName: 'asc',
  status: 'asc',
  tryNumber: 'desc',
  attemptsCount: 'desc',
  grade: 'desc',
  studentBestGrade: 'desc',
  durationSeconds: 'desc',
  startedAt: 'desc',
};

/** Преподаватель: попытки внешнего модуля по практике (поиск, сортировка) + разбор выбранной. */
export function TeacherSessionProtocols({ practicalId }: Props) {
  const listQuery = useListPracticalModuleSessions(practicalId, {
    query: { enabled: Boolean(practicalId), retry: false },
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: SessionSortKey; direction: SortDirection }>({
    key: 'startedAt',
    direction: 'desc',
  });

  const source = listQuery.data?.status === 200 ? listQuery.data.data : undefined;
  const allRows = useMemo(() => (source ? buildSessionRows(source) : []), [source]);
  const rows = useMemo(
    () => sortSessionRows(filterSessionRows(allRows, search), sort.key, sort.direction),
    [allRows, search, sort],
  );
  const selected = allRows.find((row) => row.sessionId === selectedId) ?? null;

  const toggleSort = (key: SessionSortKey) =>
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: DEFAULT_DIRECTION[key] },
    );

  const header = (key: SessionSortKey, label: string, w?: number) => (
    <SortableTh active={sort.key === key} direction={sort.direction} onSort={() => toggleSort(key)} w={w}>
      {label}
    </SortableTh>
  );

  return (
    <Stack gap="md">
      <AppCard p={0}>
        <QueryBoundary
          isPending={listQuery.isPending}
          isError={listQuery.isError || listQuery.data?.status !== 200}
          data={source}
          errorTitle="Education API недоступен"
          emptyTitle="Попыток нет"
          emptyDescription="Студенты ещё не запускали модуль по этой практике."
          isEmpty={(items) => items.length === 0}
        >
          {() => (
            <Stack gap="sm" p="md">
              <Group justify="space-between" wrap="wrap" gap="sm">
                <TextInput
                  label="Поиск по студенту"
                  placeholder="Фамилия или имя…"
                  value={search}
                  onChange={(event) => setSearch(event.currentTarget.value)}
                  maw={320}
                />
                <Text size="sm" c="dimmed">
                  {search.trim() ? `Найдено: ${rows.length} из ${allRows.length}` : `Попыток: ${allRows.length}`}
                </Text>
              </Group>

              {rows.length === 0 ? (
                <EmptyState
                  title="Ничего не найдено"
                  description={`По запросу «${search.trim()}» студентов нет.`}
                  actions={
                    <Button variant="subtle" size="xs" onClick={() => setSearch('')}>
                      Сбросить поиск
                    </Button>
                  }
                />
              ) : (
                <Table.ScrollContainer minWidth={900}>
                  <Table striped highlightOnHover withTableBorder withColumnBorders>
                    <Table.Thead>
                      <Table.Tr>
                        {header('studentName', 'Студент')}
                        {header('tryNumber', 'Попытка', 100)}
                        {header('attemptsCount', 'Попыток в модуле', 140)}
                        {header('status', 'Статус', 170)}
                        {header('grade', 'Оценка', 90)}
                        {header('studentBestGrade', 'Лучшая у студента', 130)}
                        {header('durationSeconds', 'Длительность', 130)}
                        {header('startedAt', 'Начата', 170)}
                        <Table.Th w={110}>Разбор</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {rows.map((row) => (
                        <SessionTableRow
                          key={row.sessionId}
                          row={row}
                          selected={selectedId === row.sessionId}
                          onToggle={() =>
                            setSelectedId((current) => (current === row.sessionId ? null : row.sessionId))
                          }
                        />
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              )}
            </Stack>
          )}
        </QueryBoundary>
      </AppCard>

      {selected ? (
        <SessionEventsFeed
          practicalId={practicalId}
          sessionId={selected.sessionId}
          title={`Разбор: ${selected.studentName}, попытка #${selected.tryNumber}`}
        />
      ) : null}
    </Stack>
  );
}

function SessionTableRow({ row, selected, onToggle }: { row: SessionRow; selected: boolean; onToggle: () => void }) {
  const meta = STATUS_META[row.status] ?? { label: row.status, color: 'gray' };

  return (
    <Table.Tr>
      <Table.Td>
        <Text size="sm">{row.studentName}</Text>
      </Table.Td>
      <Table.Td>#{row.tryNumber}</Table.Td>
      <Table.Td>{row.attemptsCount ?? '—'}</Table.Td>
      <Table.Td>
        <Group gap={6} wrap="nowrap">
          <Badge color={meta.color} radius="sm" variant="light">
            {meta.label}
          </Badge>
          {row.endReason && END_REASON_LABEL[row.endReason] ? (
            <Text size="xs" c="dimmed">
              {END_REASON_LABEL[row.endReason]}
            </Text>
          ) : null}
        </Group>
      </Table.Td>
      <Table.Td>{row.grade ?? '—'}</Table.Td>
      <Table.Td>{row.studentBestGrade ?? '—'}</Table.Td>
      <Table.Td>
        <Text size="sm">{row.status === 'ACTIVE' ? 'идёт' : formatDuration(row.durationSeconds)}</Text>
      </Table.Td>
      <Table.Td>
        <Text size="xs" c="dimmed">
          {formatDateTime(row.startedAt)}
        </Text>
      </Table.Td>
      <Table.Td>
        <Button size="xs" variant={selected ? 'light' : 'subtle'} onClick={onToggle}>
          Разбор
        </Button>
      </Table.Td>
    </Table.Tr>
  );
}
