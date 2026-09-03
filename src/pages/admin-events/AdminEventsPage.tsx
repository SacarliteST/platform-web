import {
  Alert,
  Anchor,
  Badge,
  Button,
  Grid,
  Group,
  Pagination,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ListAuditEventsParams } from '../../api/identity/model';
import { useListAuditEvents } from '../../api/identity/audit/audit';
import { auditEventTypeOptions, formatAuditEventType } from '../../entities/audit';
import { formatUserDateTime } from '../../entities/user';
import { AdminContourTabs } from '../../features/admin-contour';
import { getAdminUsersErrorPresentation } from '../../features/admin-users';
import { AppCard, EmptyState, Page, PageBreadcrumbs, PageHeader } from '../../shared/ui';

type EventTypeFilter = 'all' | string;

const pageSize = 10;

export function AdminEventsPage() {
  const [page, setPage] = useState(1);
  const [actorUserId, setActorUserId] = useState('');
  const [targetUserId, setTargetUserId] = useState('');
  const [eventType, setEventType] = useState<EventTypeFilter>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const auditParams = useMemo<ListAuditEventsParams>(() => {
    return {
      Page: page,
      PageSize: pageSize,
      ActorUserId: actorUserId.trim() || undefined,
      TargetUserId: targetUserId.trim() || undefined,
      EventType: eventType === 'all' ? undefined : eventType,
      From: from || undefined,
      To: to || undefined,
    };
  }, [actorUserId, eventType, from, page, targetUserId, to]);

  const auditQuery = useListAuditEvents(auditParams, { query: { retry: false } });

  const response = auditQuery.data;
  const auditPage = response?.status === 200 ? response.data : null;
  const events = auditPage?.items ?? [];
  const totalCount = auditPage?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const shownFrom = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const shownTo = Math.min(page * pageSize, totalCount);
  const apiError = response && response.status !== 200 ? response.data : null;
  const apiErrorStatus = response && response.status !== 200 ? response.status : undefined;
  const apiErrorPresentation = apiError
    ? getAdminUsersErrorPresentation(apiError, apiErrorStatus)
    : null;

  const resetToFirstPage = () => setPage(1);

  const resetFilters = () => {
    setActorUserId('');
    setTargetUserId('');
    setEventType('all');
    setFrom('');
    setTo('');
    setPage(1);
  };

  return (
    <Page>
      <PageBreadcrumbs
        items={[
          { label: 'Главная', to: '/' },
          { label: 'Администратор', to: '/admin' },
          { label: 'Аудит' },
        ]}
      />

      <Stack gap="md">
        <PageHeader
          title="Журнал аудита"
          description="События безопасности и административные действия IdentityService."
        />
        <AdminContourTabs />
      </Stack>

      <AppCard p="md">
        <Grid gutter="sm" align="flex-end">
          <Grid.Col span={{ base: 12, md: 3 }}>
            <TextInput
              label="Инициатор"
              placeholder="ID пользователя"
              value={actorUserId}
              onChange={(event) => {
                setActorUserId(event.currentTarget.value);
                resetToFirstPage();
              }}
              size="sm"
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <TextInput
              label="Объект"
              placeholder="ID пользователя"
              value={targetUserId}
              onChange={(event) => {
                setTargetUserId(event.currentTarget.value);
                resetToFirstPage();
              }}
              size="sm"
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Select
              label="Тип события"
              value={eventType}
              onChange={(value) => {
                setEventType(value ?? 'all');
                resetToFirstPage();
              }}
              data={[{ value: 'all', label: 'Все события' }, ...auditEventTypeOptions]}
              allowDeselect={false}
              searchable
              size="sm"
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 1.5 }}>
            <TextInput
              label="С"
              type="date"
              value={from}
              onChange={(event) => {
                setFrom(event.currentTarget.value);
                resetToFirstPage();
              }}
              size="sm"
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 1.5 }}>
            <TextInput
              label="По"
              type="date"
              value={to}
              onChange={(event) => {
                setTo(event.currentTarget.value);
                resetToFirstPage();
              }}
              size="sm"
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12 }}>
            <Group justify="flex-end">
              <Button size="xs" variant="outline" onClick={resetFilters}>
                Сбросить фильтры
              </Button>
            </Group>
          </Grid.Col>
        </Grid>
      </AppCard>

      <AppCard p={0}>
        {auditQuery.isPending ? (
          <EmptyState
            title="Загружаем журнал аудита"
            description="Получаем события IdentityService."
          />
        ) : auditQuery.isError ? (
          <EmptyState
            title="IdentityService недоступен"
            description="Проверьте, что сервис запущен и runtime config указывает на правильный адрес."
          />
        ) : apiError ? (
          <Stack p="md">
            <Alert color="red" title={apiErrorPresentation?.title} variant="light">
              {apiErrorPresentation?.message}
            </Alert>
          </Stack>
        ) : events.length > 0 ? (
          <Stack gap={0}>
            <Table striped highlightOnHover withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Дата</Table.Th>
                  <Table.Th>Тип</Table.Th>
                  <Table.Th>Описание</Table.Th>
                  <Table.Th>Инициатор</Table.Th>
                  <Table.Th>Объект</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {events.map((event) => (
                  <Table.Tr key={event.id}>
                    <Table.Td>
                      <Text size="sm">{formatUserDateTime(event.createdAt)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge color="blue" radius="sm" variant="light">
                        {formatAuditEventType(event.eventType)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{event.description}</Text>
                    </Table.Td>
                    <Table.Td>
                      {event.actorUserId ? (
                        <Anchor component={Link} to={`/admin/users/${event.actorUserId}`} size="sm">
                          {event.actorUserId}
                        </Anchor>
                      ) : (
                        <Text c="dimmed" size="sm">
                          Система
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {event.targetUserId ? (
                        <Anchor component={Link} to={`/admin/users/${event.targetUserId}`} size="sm">
                          {event.targetUserId}
                        </Anchor>
                      ) : (
                        <Text c="dimmed" size="sm">
                          Не указано
                        </Text>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>

            <Group justify="space-between" p="sm" gap="md" wrap="wrap">
              <Text c="dimmed" size="sm">
                Показано {shownFrom}-{shownTo} из {totalCount} событий
              </Text>
              <Pagination total={totalPages} value={page} onChange={setPage} size="sm" />
            </Group>
          </Stack>
        ) : (
          <EmptyState
            title="События не найдены"
            description="Измените фильтры или проверьте, что в IdentityService включена запись аудита."
          />
        )}
      </AppCard>
    </Page>
  );
}
