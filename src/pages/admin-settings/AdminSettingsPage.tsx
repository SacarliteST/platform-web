import { Badge, Button, Code, Group, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import { useState } from 'react';
import { useRuntimeConfig } from '../../app/providers/runtime-config-store';
import { buildApiUrl } from '../../shared/http';
import { AdminContourTabs } from '../../features/admin-contour';
import { AppCard, Page, PageBreadcrumbs, PageHeader } from '../../shared/ui';

type CheckState = 'idle' | 'checking' | 'ok' | 'fail';

type ServiceCheck = {
  id: string;
  name: string;
  probe: string;
  state: CheckState;
  latencyMs: number | null;
  detail: string;
};

async function probeService(url: string): Promise<{ ok: boolean; latencyMs: number; detail: string }> {
  const startedAt = performance.now();
  try {
    const response = await fetch(url, { cache: 'no-store' });
    const latencyMs = Math.round(performance.now() - startedAt);
    return {
      ok: response.ok || response.status === 401,
      latencyMs,
      detail: `HTTP ${response.status}`,
    };
  } catch {
    return { ok: false, latencyMs: Math.round(performance.now() - startedAt), detail: 'нет ответа' };
  }
}

export function AdminSettingsPage() {
  const config = useRuntimeConfig();
  const [checks, setChecks] = useState<ServiceCheck[]>(() => [
    {
      id: 'education',
      name: 'Education API',
      probe: buildApiUrl(config.educationApiUrl, '/health'),
      state: 'idle',
      latencyMs: null,
      detail: '—',
    },
    {
      id: 'identity',
      name: 'IdentityService',
      probe: config.identityApiUrl
        ? buildApiUrl(config.identityApiUrl, '/.well-known/openid-configuration')
        : '',
      state: 'idle',
      latencyMs: null,
      detail: config.identityApiUrl ? '—' : 'не настроен',
    },
  ]);
  const [running, setRunning] = useState(false);

  const runChecks = async () => {
    setRunning(true);
    setChecks((current) => current.map((check) => ({ ...check, state: 'checking' as CheckState })));

    const results = await Promise.all(
      checks.map(async (check) => {
        if (!check.probe) {
          return { ...check, state: 'fail' as CheckState, detail: 'адрес не настроен' };
        }
        const result = await probeService(check.probe);
        return {
          ...check,
          state: (result.ok ? 'ok' : 'fail') as CheckState,
          latencyMs: result.latencyMs,
          detail: result.detail,
        };
      }),
    );

    setChecks(results);
    setRunning(false);
  };

  const integrationRows = [
    { label: 'Education API URL', value: config.educationApiUrl },
    { label: 'IdentityService URL', value: config.identityApiUrl ?? 'не задан' },
    { label: 'Base Path', value: config.basePath ?? '/' },
    { label: 'Режим', value: config.mode },
  ];

  return (
    <Page>
      <PageBreadcrumbs
        items={[
          { label: 'Главная', to: '/' },
          { label: 'Администратор', to: '/admin' },
          { label: 'Настройки' },
        ]}
      />

      <Stack gap="md">
        <PageHeader
          title="Настройки"
          description="Адреса сервисов из runtime config и проверка их доступности."
        />
        <AdminContourTabs />
      </Stack>

      <AppCard p="md">
        <Stack gap="md">
          <Group justify="space-between" gap="md" wrap="wrap">
            <Title order={3} size="h5">
              Интеграции
            </Title>
            <Badge color="gray" radius="sm" variant="light">
              runtime config
            </Badge>
          </Group>
          <Stack gap="sm">
            {integrationRows.map((row) => (
              <TextInput key={row.label} label={row.label} value={row.value} readOnly size="sm" />
            ))}
          </Stack>
          <Text c="dimmed" size="xs">
            Значения только для просмотра. Конфигурация задаётся через `public/runtime-config.json`
            или переменные окружения `VITE_*`.
          </Text>
        </Stack>
      </AppCard>

      <AppCard p={0}>
        <Group justify="space-between" p="md" gap="md" wrap="wrap">
          <Title order={3} size="h5">
            Проверка подключения
          </Title>
          <Button size="xs" onClick={runChecks} loading={running}>
            Проверить сервисы
          </Button>
        </Group>
        <Table striped highlightOnHover withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Сервис</Table.Th>
              <Table.Th>Статус</Table.Th>
              <Table.Th>Задержка</Table.Th>
              <Table.Th>Ответ</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {checks.map((check) => (
              <Table.Tr key={check.id}>
                <Table.Td>
                  <Text fw={600} size="sm">
                    {check.name}
                  </Text>
                  <Code>{check.probe || '—'}</Code>
                </Table.Td>
                <Table.Td>
                  <Badge
                    color={
                      check.state === 'ok'
                        ? 'green'
                        : check.state === 'fail'
                          ? 'red'
                          : check.state === 'checking'
                            ? 'yellow'
                            : 'gray'
                    }
                    radius="sm"
                    variant="light"
                  >
                    {check.state === 'ok'
                      ? 'Доступен'
                      : check.state === 'fail'
                        ? 'Недоступен'
                        : check.state === 'checking'
                          ? 'Проверяется'
                          : 'Не проверялся'}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text c="dimmed" size="sm">
                    {check.latencyMs === null ? '—' : `${check.latencyMs} мс`}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text c="dimmed" size="sm">
                    {check.detail}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </AppCard>
    </Page>
  );
}
