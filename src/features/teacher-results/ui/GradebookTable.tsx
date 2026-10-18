import { Button, Group, SegmentedControl, Stack, Table, Text, TextInput } from '@mantine/core';
import { useMemo, useState } from 'react';
import type { CourseGradebookResponse } from '../../../api/education/model';
import type { SortDirection } from '../../../shared/lib';
import { EmptyState, SortableTh } from '../../../shared/ui';
import {
  buildGradebookCsv,
  buildGradebookRows,
  cellLabel,
  filterGradebookRows,
  sortGradebookRows,
  type GradebookFilter,
  type GradebookSortKey,
} from '../model/gradebook-rows';
import { GradeBadge } from './GradeBadge';

type Props = { book: CourseGradebookResponse; fileName?: string };

const DEFAULT_DIRECTION: Record<GradebookSortKey, SortDirection> = {
  studentName: 'asc',
  passedCount: 'desc',
  averageGrade: 'desc',
};

function downloadCsv(content: string, fileName: string) {
  const blob = new Blob(['﻿', content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/** Ведомость курса: студенты × практики с оценками, поиск, фильтр по итогу, сортировка и выгрузка в CSV. */
export function GradebookTable({ book, fileName = 'gradebook.csv' }: Props) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<GradebookFilter>('all');
  const [sort, setSort] = useState<{ key: GradebookSortKey; direction: SortDirection }>({
    key: 'studentName',
    direction: 'asc',
  });

  const allRows = useMemo(() => buildGradebookRows(book), [book]);
  const rows = useMemo(
    () => sortGradebookRows(filterGradebookRows(allRows, search, filter), sort.key, sort.direction),
    [allRows, search, filter, sort],
  );

  const toggleSort = (key: GradebookSortKey) =>
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: DEFAULT_DIRECTION[key] },
    );

  const header = (key: GradebookSortKey, label: string, w?: number) => (
    <SortableTh active={sort.key === key} direction={sort.direction} onSort={() => toggleSort(key)} w={w}>
      {label}
    </SortableTh>
  );

  return (
    <Stack gap="sm" p="md">
      <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm">
        <Group align="flex-end" gap="md" wrap="wrap">
          <TextInput
            label="Поиск по студенту"
            placeholder="Фамилия, имя или группа…"
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            maw={320}
          />
          <SegmentedControl
            value={filter}
            onChange={(value) => setFilter(value as GradebookFilter)}
            data={[
              { value: 'all', label: 'Все' },
              { value: 'passed', label: 'Прошли' },
              { value: 'failed', label: 'Не прошли' },
              { value: 'incomplete', label: 'В процессе' },
            ]}
          />
        </Group>
        <Group gap="sm">
          <Text size="sm" c="dimmed">
            Студентов: {rows.length === allRows.length ? allRows.length : `${rows.length} из ${allRows.length}`}
          </Text>
          <Button
            size="xs"
            variant="outline"
            disabled={rows.length === 0}
            onClick={() => downloadCsv(buildGradebookCsv(book, rows), fileName)}
          >
            Скачать CSV
          </Button>
        </Group>
      </Group>

      {rows.length === 0 ? (
        <EmptyState
          title="Ничего не найдено"
          description="Измените поиск или фильтр."
          actions={
            <Button
              variant="subtle"
              size="xs"
              onClick={() => {
                setSearch('');
                setFilter('all');
              }}
            >
              Сбросить
            </Button>
          }
        />
      ) : (
        <Table.ScrollContainer minWidth={600}>
          <Table striped highlightOnHover withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                {header('studentName', 'Студент')}
                {book.practicals.map((practical) => (
                  <Table.Th key={practical.id} ta="center" title={`${practical.moduleName}: ${practical.name}`}>
                    <Text size="xs" c="dimmed" lineClamp={1}>
                      {practical.moduleName}
                    </Text>
                    <Text size="sm" fw={600} lineClamp={2}>
                      {practical.name}
                    </Text>
                  </Table.Th>
                ))}
                {header('passedCount', 'Зачтено', 110)}
                {header('averageGrade', 'Средняя', 110)}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((row) => (
                <Table.Tr key={row.studentId}>
                  <Table.Td>
                    <Text size="sm">{row.studentName}</Text>
                    {row.group ? (
                      <Text size="xs" c="dimmed">
                        {row.group}
                      </Text>
                    ) : null}
                  </Table.Td>
                  {book.practicals.map((practical) => {
                    const cell = row.cells.find((item) => item.practicalId === practical.id);
                    return (
                      <Table.Td key={practical.id} ta="center">
                        {cell ? <GradeBadge label={cellLabel(cell)} status={cell.status} /> : '—'}
                      </Table.Td>
                    );
                  })}
                  <Table.Td ta="center">
                    {row.passedCount} из {row.assignedCount}
                  </Table.Td>
                  <Table.Td ta="center">{row.averageGrade === null ? '—' : row.averageGrade.toFixed(2)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
      <Text size="xs" c="dimmed">
        «нет» — оценки ещё нет (условия практики не выполнены), «—» — практика студенту не назначена. Средняя — по практикам, где оценка уже есть.
      </Text>
    </Stack>
  );
}
