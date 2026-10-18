import { Button, Group, Stack, Table, Text, TextInput } from '@mantine/core';
import { useMemo, useState } from 'react';
import type { TestProtocolSummaryResponse } from '../../../api/education/model';
import { formatDateTime, formatDuration, type SortDirection } from '../../../shared/lib';
import { EmptyState, SortableTh } from '../../../shared/ui';
import {
  buildProtocolRows,
  filterProtocolRows,
  sortProtocolRows,
  type ProtocolSortKey,
} from '../model/protocol-rows';

type Props = {
  items: readonly TestProtocolSummaryResponse[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

const DEFAULT_DIRECTION: Record<ProtocolSortKey, SortDirection> = {
  studentName: 'asc',
  tryNumber: 'desc',
  scorePercent: 'desc',
  grade: 'desc',
  submittedAt: 'desc',
  durationSeconds: 'desc',
};

/** Преподаватель: попытки прохождения теста — студент, баллы, оценка, время сдачи и длительность; поиск и сортировка. */
export function TestProtocolsTable({ items, selectedId, onSelect }: Props) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: ProtocolSortKey; direction: SortDirection }>({
    key: 'submittedAt',
    direction: 'desc',
  });

  const allRows = useMemo(() => buildProtocolRows(items), [items]);
  const rows = useMemo(
    () => sortProtocolRows(filterProtocolRows(allRows, search), sort.key, sort.direction),
    [allRows, search, sort],
  );

  const toggleSort = (key: ProtocolSortKey) =>
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: DEFAULT_DIRECTION[key] },
    );

  const header = (key: ProtocolSortKey, label: string, w?: number) => (
    <SortableTh active={sort.key === key} direction={sort.direction} onSort={() => toggleSort(key)} w={w}>
      {label}
    </SortableTh>
  );

  return (
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
        <Table.ScrollContainer minWidth={760}>
          <Table striped highlightOnHover withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                {header('studentName', 'Студент')}
                {header('tryNumber', 'Попытка', 100)}
                {header('scorePercent', 'Баллы', 120)}
                {header('grade', 'Оценка', 90)}
                {header('submittedAt', 'Сдан', 170)}
                {header('durationSeconds', 'Длительность', 130)}
                <Table.Th w={110}>Разбор</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((row) => (
                <Table.Tr key={row.id}>
                  <Table.Td>
                    <Text size="sm">{row.studentName}</Text>
                  </Table.Td>
                  <Table.Td>#{row.tryNumber}</Table.Td>
                  <Table.Td>{row.score === null ? '—' : `${row.score} / ${row.maxScore ?? '—'}`}</Table.Td>
                  <Table.Td>{row.grade}</Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed">
                      {formatDateTime(row.submittedAt)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{formatDuration(row.durationSeconds)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Button
                      size="xs"
                      variant={selectedId === row.id ? 'light' : 'subtle'}
                      onClick={() => onSelect(row.id)}
                    >
                      Разбор
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </Stack>
  );
}
