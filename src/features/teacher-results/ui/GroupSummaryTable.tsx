import { Button, Group, Stack, Table, Text } from '@mantine/core';
import { useMemo } from 'react';
import { EmptyState } from '../../../shared/ui';
import { buildGroupSummaryCsv, summarizeByGroup, type GroupSummary } from '../model/gradebook-summary';
import type { GradebookRow } from '../model/gradebook-rows';
import { downloadCsv } from '../lib/download-csv';

type Props = { rows: readonly GradebookRow[]; fileName?: string };

function formatAverage(value: number | null): string {
  return value === null ? '—' : value.toFixed(2);
}

function SummaryRow({ item, bold }: { item: GroupSummary; bold?: boolean }) {
  return (
    <Table.Tr fw={bold ? 700 : undefined}>
      <Table.Td>{item.group}</Table.Td>
      <Table.Td ta="center">{item.students}</Table.Td>
      <Table.Td ta="center">{item.passed}</Table.Td>
      <Table.Td ta="center">{item.failed}</Table.Td>
      <Table.Td ta="center">{item.inProgress}</Table.Td>
      <Table.Td ta="center">{formatAverage(item.averageGrade)}</Table.Td>
      <Table.Td ta="center">
        {item.distribution[5]} / {item.distribution[4]} / {item.distribution[3]} / {item.distribution[2]}
      </Table.Td>
    </Table.Tr>
  );
}

/** Сводка по группам: сколько студентов прошли курс, не прошли, ещё в процессе, средняя оценка и распределение оценок. */
export function GroupSummaryTable({ rows, fileName = 'group-summary.csv' }: Props) {
  const summary = useMemo(() => summarizeByGroup(rows), [rows]);

  if (rows.length === 0) {
    return <EmptyState title="Студентов нет" description="Назначьте студентов на курс." />;
  }

  return (
    <Stack gap="sm" p="md">
      <Group justify="space-between" wrap="wrap" gap="sm">
        <Text size="sm" c="dimmed">
          «Прошли» — зачтено всё назначенное, «не прошли» — есть оценка ниже 3, остальные «в процессе».
        </Text>
        <Button size="xs" variant="outline" onClick={() => downloadCsv(buildGroupSummaryCsv(summary), fileName)}>
          Скачать сводку CSV
        </Button>
      </Group>
      <Table.ScrollContainer minWidth={640}>
        <Table striped withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Группа</Table.Th>
              <Table.Th ta="center">Студентов</Table.Th>
              <Table.Th ta="center">Прошли</Table.Th>
              <Table.Th ta="center">Не прошли</Table.Th>
              <Table.Th ta="center">В процессе</Table.Th>
              <Table.Th ta="center">Средняя</Table.Th>
              <Table.Th ta="center" title="Количество выставленных оценок 5 / 4 / 3 / 2">
                Оценки 5 / 4 / 3 / 2
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {summary.groups.map((item) => (
              <SummaryRow key={item.group} item={item} />
            ))}
            <SummaryRow item={summary.total} bold />
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Stack>
  );
}
