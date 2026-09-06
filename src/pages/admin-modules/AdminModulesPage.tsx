import {
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  Stack,
  Switch,
  Table,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  getGetPracticalModulesQueryKey,
  useCreatePracticalModule,
  useDeletePracticalModule,
  useGetPracticalModules,
  useUpdatePracticalModule,
} from '../../api/education/practical-modules/practical-modules';
import type { PracticalModuleResponse } from '../../api/education/model';
import { AdminContourTabs } from '../../features/admin-contour';
import { getEducationProblemMessage } from '../../shared/lib';
import {
  AppCard,
  ConfirmModal,
  FormActions,
  Page,
  PageBreadcrumbs,
  PageHeader,
  QueryBoundary,
} from '../../shared/ui';

type ModuleFormState = {
  slug: string;
  name: string;
  description: string;
  practiceType: string;
  basePath: string;
  identityAudience: string;
  configuration: string;
  isEnabled: boolean;
};

const emptyForm: ModuleFormState = {
  slug: '',
  name: '',
  description: '',
  practiceType: '',
  basePath: '',
  identityAudience: '',
  configuration: '{\n  "catalogEndpoint": "",\n  "sessionsEndpoint": ""\n}',
  isEnabled: true,
};

function toForm(module: PracticalModuleResponse): ModuleFormState {
  return {
    slug: module.slug,
    name: module.name,
    description: module.description,
    practiceType: module.practiceType,
    basePath: module.basePath,
    identityAudience: module.identityAudience,
    configuration: prettyJson(module.configuration),
    isEnabled: module.isEnabled,
  };
}

function prettyJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

export function AdminModulesPage() {
  const queryClient = useQueryClient();
  const modulesQuery = useGetPracticalModules({ query: { retry: false } });
  const createMutation = useCreatePracticalModule();
  const updateMutation = useUpdatePracticalModule();
  const deleteMutation = useDeletePracticalModule();

  const [formOpened, formModal] = useDisclosure(false);
  const [editing, setEditing] = useState<PracticalModuleResponse | null>(null);
  const [form, setForm] = useState<ModuleFormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PracticalModuleResponse | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getGetPracticalModulesQueryKey() });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    formModal.open();
  };

  const openEdit = (module: PracticalModuleResponse) => {
    setEditing(module);
    setForm(toForm(module));
    setFormError(null);
    formModal.open();
  };

  const submit = async () => {
    setFormError(null);

    const configuration = form.configuration.trim();
    if (configuration.length > 0) {
      try {
        JSON.parse(configuration);
      } catch {
        setFormError('Поле «Конфигурация» — невалидный JSON.');
        return;
      }
    }

    const response = editing
      ? await updateMutation
          .mutateAsync({
            id: editing.id,
            data: {
              name: form.name.trim(),
              description: form.description.trim(),
              practiceType: form.practiceType.trim(),
              basePath: form.basePath.trim(),
              identityAudience: form.identityAudience.trim(),
              configuration: configuration.length > 0 ? configuration : null,
              isEnabled: form.isEnabled,
            },
          })
          .catch(() => null)
      : await createMutation
          .mutateAsync({
            data: {
              slug: form.slug.trim(),
              name: form.name.trim(),
              description: form.description.trim(),
              practiceType: form.practiceType.trim(),
              basePath: form.basePath.trim(),
              identityAudience: form.identityAudience.trim(),
              configuration: configuration.length > 0 ? configuration : null,
            },
          })
          .catch(() => null);

    if (!response) {
      setFormError('Education API недоступен.');
      return;
    }

    if (response.status === 200 || response.status === 201) {
      await invalidate();
      formModal.close();
      return;
    }

    if (response.status === 409) {
      setFormError('Модуль с таким slug уже зарегистрирован.');
      return;
    }

    if (response.status === 404) {
      setFormError('Модуль не найден — возможно, удалён в другой вкладке.');
      return;
    }

    setFormError(
      response.data && typeof response.data === 'object'
        ? getEducationProblemMessage(response.data, response.status)
        : 'Не удалось сохранить модуль.',
    );
  };

  const confirmDelete = async () => {
    if (!deleteTarget) {
      return;
    }
    await deleteMutation.mutateAsync({ id: deleteTarget.id }).catch(() => null);
    await invalidate();
    setDeleteTarget(null);
  };

  return (
    <Page>
      <PageBreadcrumbs
        items={[
          { label: 'Главная', to: '/' },
          { label: 'Администратор', to: '/admin' },
          { label: 'Практические модули' },
        ]}
      />

      <Stack gap="md">
        <Group justify="space-between" align="flex-end" gap="md" wrap="wrap">
          <PageHeader
            title="Практические модули"
            description="Реестр внешних модулей отработки навыков, подключаемых к практикам."
          />
          <Button size="sm" onClick={openCreate}>
            Зарегистрировать модуль
          </Button>
        </Group>
        <AdminContourTabs />
      </Stack>

      <AppCard p={0}>
        <QueryBoundary
          isPending={modulesQuery.isPending}
          isError={modulesQuery.isError || modulesQuery.data?.status !== 200}
          data={modulesQuery.data?.status === 200 ? modulesQuery.data.data : undefined}
          errorTitle="Education API недоступен"
          emptyTitle="Модулей нет"
          emptyDescription="Зарегистрируйте первый внешний практический модуль."
          isEmpty={(rows) => rows.length === 0}
        >
          {(rows) => (
            <Table striped highlightOnHover withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Slug</Table.Th>
                  <Table.Th>Название</Table.Th>
                  <Table.Th>Тип</Table.Th>
                  <Table.Th>Базовый путь</Table.Th>
                  <Table.Th>Audience</Table.Th>
                  <Table.Th>Статус</Table.Th>
                  <Table.Th>Действия</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((module) => (
                  <Table.Tr key={module.id}>
                    <Table.Td>
                      <Text size="sm" ff="monospace">
                        {module.slug}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{module.name}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">
                        {module.practiceType}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" ff="monospace" c="dimmed">
                        {module.basePath}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" ff="monospace" c="dimmed">
                        {module.identityAudience}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        color={module.isEnabled ? 'green' : 'gray'}
                        radius="sm"
                        variant="dot"
                      >
                        {module.isEnabled ? 'Включён' : 'Отключён'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs" wrap="nowrap">
                        <Button size="xs" variant="subtle" onClick={() => openEdit(module)}>
                          Изменить
                        </Button>
                        <Button
                          size="xs"
                          variant="subtle"
                          color="red"
                          onClick={() => setDeleteTarget(module)}
                        >
                          Удалить
                        </Button>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </QueryBoundary>
      </AppCard>

      <Modal
        opened={formOpened}
        onClose={formModal.close}
        title={editing ? `Модуль «${editing.slug}»` : 'Регистрация модуля'}
        centered
        size="lg"
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <Stack gap="md">
            {formError ? (
              <Alert color="red" variant="light" title="Не удалось сохранить">
                {formError}
              </Alert>
            ) : null}

            {editing ? (
              <TextInput label="Slug" value={editing.slug} readOnly disabled />
            ) : (
              <TextInput
                label="Slug"
                description="Латиница в нижнем регистре, цифры и дефис. Часть URL: /modules/<slug>/"
                value={form.slug}
                onChange={(event) => setForm({ ...form, slug: event.currentTarget.value })}
                withAsterisk
              />
            )}

            <TextInput
              label="Название"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.currentTarget.value })}
              withAsterisk
            />
            <Textarea
              label="Описание"
              autosize
              minRows={2}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.currentTarget.value })}
            />
            <Group grow align="flex-start">
              <TextInput
                label="Тип практики"
                placeholder="SQL_SIMULATOR"
                value={form.practiceType}
                onChange={(event) =>
                  setForm({ ...form, practiceType: event.currentTarget.value })
                }
                withAsterisk
              />
              <TextInput
                label="Базовый путь"
                placeholder="/modules/sql"
                value={form.basePath}
                onChange={(event) => setForm({ ...form, basePath: event.currentTarget.value })}
                withAsterisk
              />
            </Group>
            <TextInput
              label="Identity audience"
              description="Отдельная аудитория токена модуля"
              placeholder="sql-module-api"
              value={form.identityAudience}
              onChange={(event) =>
                setForm({ ...form, identityAudience: event.currentTarget.value })
              }
              withAsterisk
            />
            <Textarea
              label="Конфигурация (JSON)"
              description="catalogEndpoint / sessionsEndpoint модуля. serviceKey сюда не кладётся — он в secret-конфиге Education."
              autosize
              minRows={4}
              styles={{ input: { fontFamily: 'monospace' } }}
              value={form.configuration}
              onChange={(event) =>
                setForm({ ...form, configuration: event.currentTarget.value })
              }
            />
            {editing ? (
              <Switch
                label="Модуль включён"
                checked={form.isEnabled}
                onChange={(event) =>
                  setForm({ ...form, isEnabled: event.currentTarget.checked })
                }
              />
            ) : null}

            <FormActions
              submitLabel={editing ? 'Сохранить' : 'Зарегистрировать'}
              loading={createMutation.isPending || updateMutation.isPending}
              onCancel={formModal.close}
            />
          </Stack>
        </form>
      </Modal>

      <ConfirmModal
        opened={deleteTarget !== null}
        title="Удалить модуль"
        message={
          deleteTarget
            ? `Удалить модуль «${deleteTarget.name}» (${deleteTarget.slug})? Привязки практик к нему нужно будет переназначить.`
            : ''
        }
        loading={deleteMutation.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </Page>
  );
}
