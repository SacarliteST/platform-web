import { Badge, Button, Group, Stack, Table, Text } from '@mantine/core';
import { useState } from 'react';
import { AppCard, QueryBoundary } from '../../../shared/ui';
import { useModuleSessionsList } from '../api/moduleSessionsList';
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

/** Преподаватель: список попыток внешнего модуля по практике + протокол выбранной. */
export function TeacherSessionProtocols({ practicalId }: Props) {
  const listQuery = useModuleSessionsList(practicalId);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <Stack gap="md">
      <AppCard p={0}>
        <QueryBoundary
          isPending={listQuery.isPending}
          isError={listQuery.isError || listQuery.data?.status !== 200}
          data={listQuery.data?.status === 200 ? listQuery.data.rows : undefined}
          errorTitle="Education API недоступен"
          emptyTitle="Попыток нет"
          emptyDescription="Студенты ещё не запускали модуль по этой практике."
          isEmpty={(rows) => rows.length === 0}
        >
          {(rows) => (
            <Table striped highlightOnHover withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Студент</Table.Th>
                  <Table.Th w={90}>Попытка</Table.Th>
                  <Table.Th w={150}>Статус</Table.Th>
                  <Table.Th w={80}>Оценка</Table.Th>
                  <Table.Th w={170}>Начата</Table.Th>
                  <Table.Th w={120}>Действия</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((row) => {
                  const meta = STATUS_META[row.status] ?? { label: row.status, color: 'gray' };
                  return (
                    <Table.Tr key={row.sessionId}>
                      <Table.Td>
                        <Text size="sm">{row.studentName}</Text>
                      </Table.Td>
                      <Table.Td>#{row.tryNumber}</Table.Td>
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
                      <Table.Td>{row.grade == null ? '—' : row.grade}</Table.Td>
                      <Table.Td>
                        <Text size="xs" c="dimmed">
                          {formatTimestamp(row.startedAt)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Button
                          size="xs"
                          variant={selectedId === row.sessionId ? 'light' : 'subtle'}
                          onClick={() =>
                            setSelectedId((current) =>
                              current === row.sessionId ? null : row.sessionId,
                            )
                          }
                        >
                          Протокол
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          )}
        </QueryBoundary>
      </AppCard>

      {selectedId ? (
        <SessionEventsFeed practicalId={practicalId} sessionId={selectedId} />
      ) : null}
    </Stack>
  );
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('ru-RU');
}
