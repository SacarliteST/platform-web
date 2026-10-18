import { Stack, Table, Text, TextInput } from '@mantine/core';
import { useMemo, useState } from 'react';
import type { PracticalStudentGradeResponse } from '../../../api/education/model';
import { compareNullable, matchesAllWords, toNullableNumber, type SortDirection } from '../../../shared/lib';
import { EmptyState, SortableTh } from '../../../shared/ui';
import { GradeBadge } from './GradeBadge';
import type { GradeStatus } from '../model/gradebook-rows';

type Props = { items: readonly PracticalStudentGradeResponse[] };

type SortKey = 'studentName' | 'grade';

/** Преподаватель: оценка каждого назначенного студента по практике (та же, что видит студент). */
export function PracticalGradesTable({ items }: Props) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'studentName',
    direction: 'asc',
  });

  const rows = useMemo(() => {
    const filtered = items.filter((item) => matchesAllWords(`${item.studentName} ${item.group ?? ''}`, search));
    return [...filtered].sort((a, b) =>
      compareNullable(
        sort.key === 'grade' ? toNullableNumber(a.grade) : a.studentName,
        sort.key === 'grade' ? toNullableNumber(b.grade) : b.studentName,
        sort.direction,
      ),
    );
  }, [items, search, sort]);

  const toggle = (key: SortKey) =>
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: key === 'grade' ? 'desc' : 'asc' },
    );

  return (
    <Stack gap="sm" p="md">
      <TextInput
        label="Поиск по студенту"
        placeholder="Фамилия, имя или группа…"
        value={search}
        onChange={(event) => setSearch(event.currentTarget.value)}
        maw={320}
      />
      {rows.length === 0 ? (
        <EmptyState title="Ничего не найдено" description="По запросу студентов нет." />
      ) : (
        <Table striped highlightOnHover withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <SortableTh active={sort.key === 'studentName'} direction={sort.direction} onSort={() => toggle('studentName')}>
                Студент
              </SortableTh>
              <SortableTh active={sort.key === 'grade'} direction={sort.direction} onSort={() => toggle('grade')} w={110}>
                Оценка
              </SortableTh>
              <Table.Th>Что осталось</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((row) => {
              const grade = toNullableNumber(row.grade);
              return (
                <Table.Tr key={row.studentId}>
                  <Table.Td>
                    <Text size="sm">{row.studentName}</Text>
                    {row.group ? (
                      <Text size="xs" c="dimmed">
                        {row.group}
                      </Text>
                    ) : null}
                  </Table.Td>
                  <Table.Td ta="center">
                    <GradeBadge label={grade === null ? 'нет' : String(grade)} status={row.status as GradeStatus} />
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {row.messages.join('; ') || '—'}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}
