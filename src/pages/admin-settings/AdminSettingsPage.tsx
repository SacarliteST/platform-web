import { Badge, Button, Code, Group, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import { useMemo, useState } from 'react';
import { useRuntimeConfig } from '../../app/providers/runtime-config-store';
import { buildApiUrl } from '../../shared/http';
import { AdminContourTabs } from '../../features/admin-contour';
import { AppCard, Page, PageBreadcrumbs, PageHeader } from '../../shared/ui';
import {
  getPracticalModuleTasks,
  useGetPracticalModules,
} from '../../api/education/practical-modules/practical-modules';

type CheckState = 'idle' | 'checking' | 'ok' | 'fail' | 'forbidden';

type CheckResult = { state: CheckState; latencyMs: number | null; detail: string };

// Статические проверки (URL, доступный прямо из браузера) и проверки внешних
// модулей (через прокси-каталог Education — сам модуль браузеру не виден).
type CheckDef =
  | { id: string; name: string; kind: 'url'; probe: string }
  | { id: string; name: string; kind: 'module'; moduleId: string; probe: string };

const idleResult: CheckResult = { state: 'idle', latencyMs: null, detail: '—' };

async function probeUrl(url: string): Promise<CheckResult> {
  const startedAt = performance.now();
  try {
    const response = await fetch(url, { cache: 'no-store' });
    const latencyMs = Math.round(performance.now() - startedAt);
    return {
      state: response.ok || response.status === 401 ? 'ok' : 'fail',
      latencyMs,
      detail: `HTTP ${response.status}`,
    };
  } catch {
    return { state: 'fail', latencyMs: Math.round(performance.now() - startedAt), detail: 'нет ответа' };
  }
}

// Модуль недоступен браузеру напрямую (внутренний Docker-адрес в configuration),
// поэтому проверяем через тот же прокси каталога, которым реально пользуется
// привязка задания: GET /practical-modules/{id}/tasks (TeacherOnly на Education).
async function probeModule(moduleId: string): Promise<CheckResult> {
  const startedAt = performance.now();
  const response = await getPracticalModuleTasks(moduleId).catch(() => null);
  const latencyMs = Math.round(performance.now() - startedAt);

  if (!response) {
    return { state: 'fail', latencyMs, detail: 'нет ответа' };
  }
  if (response.status === 200) {
    return { state: 'ok', latencyMs, detail: `каталог: ${response.data.length} заданий` };
  }
  if (response.status === 403) {
    return { state: 'forbidden', latencyMs, detail: 'нет прав — нужна роль «Преподаватель»' };
  }
  if (response.status === 502) {
    return { state: 'fail', latencyMs, detail: 'модуль не отвечает (502)' };
  }
  return { state: 'fail', latencyMs, detail: `HTTP ${response.status}` };
}

export function AdminSettingsPage() {
  const config = useRuntimeConfig();
  const modulesQuery = useGetPracticalModules({ query: { retry: false } });
  const modules = modulesQuery.data?.status === 200 ? modulesQuery.data.data : [];

  const checkDefs = useMemo<CheckDef[]>(
    () => [
      { id: 'education', name: 'Education API', kind: 'url', probe: buildApiUrl(config.educationApiUrl, '/health') },
      {
        id: 'identity',
        name: 'IdentityService',
        kind: 'url',
        probe: config.identityApiUrl
          ? buildApiUrl(config.identityApiUrl, '/.well-known/openid-configuration')
          : '',
      },
      ...modules.map(
        (module): CheckDef => ({
          id: `module:${module.id}`,
          name: `Модуль: ${module.name} (${module.slug})`,
          kind: 'module',
          moduleId: module.id,
          probe: `GET /practical-modules/${module.id}/tasks`,
        }),
      ),
    ],
    [config.educationApiUrl, config.identityApiUrl, modules],
  );

  const [results, setResults] = useState<Record<string, CheckResult>>({});
  const [running, setRunning] = useState(false);

  const runChecks = async () => {
    setRunning(true);
    setResults((current) =>
      Object.fromEntries(checkDefs.map((check) => [check.id, { ...(current[check.id] ?? idleResult), state: 'checking' as CheckState }])),
    );

    const entries = await Promise.all(
      checkDefs.map(async (check): Promise<[string, CheckResult]> => {
        if (check.kind === 'url') {
          if (!check.probe) {
            return [check.id, { state: 'fail', latencyMs: null, detail: 'адрес не настроен' }];
          }
          return [check.id, await probeUrl(check.probe)];
        }
        return [check.id, await probeModule(check.moduleId)];
      }),
    );

    setResults(Object.fromEntries(entries));
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
            {checkDefs.map((check) => {
              const result = results[check.id] ?? idleResult;
              return (
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
                        result.state === 'ok'
                          ? 'green'
                          : result.state === 'fail'
                            ? 'red'
                            : result.state === 'forbidden'
                              ? 'orange'
                              : result.state === 'checking'
                                ? 'yellow'
                                : 'gray'
                      }
                      radius="sm"
                      variant="light"
                    >
                      {result.state === 'ok'
                        ? 'Доступен'
                        : result.state === 'fail'
                          ? 'Недоступен'
                          : result.state === 'forbidden'
                            ? 'Нет доступа'
                            : result.state === 'checking'
                              ? 'Проверяется'
                              : 'Не проверялся'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text c="dimmed" size="sm">
                      {result.latencyMs === null ? '—' : `${result.latencyMs} мс`}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text c="dimmed" size="sm">
                      {result.detail}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </AppCard>
    </Page>
  );
}
