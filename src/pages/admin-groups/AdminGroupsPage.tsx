import { Alert, Button, Group, Modal, Stack, Table, Text, TextInput } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useCreateGroup, useDeleteGroup, useListGroups, useRenameGroup } from '../../api/identity/groups/groups';
import type { GroupDto } from '../../api/identity/model';
import { formatUserDateTime } from '../../entities/user';
import { AdminContourTabs } from '../../features/admin-contour';
import { getIdentityProblemPresentation, type IdentityApiProblemPresentation } from '../../shared/lib/identity-problem-details';
import { AppCard, ConfirmModal, FormActions, Page, PageBreadcrumbs, PageHeader, QueryBoundary } from '../../shared/ui';

export function AdminGroupsPage() {
  const queryClient = useQueryClient();
  const groupsQuery = useListGroups({ query: { retry: false } });
  const createMutation = useCreateGroup();
  const renameMutation = useRenameGroup();
  const deleteMutation = useDeleteGroup();

  const [editorOpened, editorModal] = useDisclosure(false);
  const [editingGroup, setEditingGroup] = useState<GroupDto | null>(null);
  const [name, setName] = useState('');
  const [editorError, setEditorError] = useState<IdentityApiProblemPresentation | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GroupDto | null>(null);
  const [deleteError, setDeleteError] = useState<IdentityApiProblemPresentation | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['/api/v1/groups'] });

  const openCreate = () => {
    setEditingGroup(null);
    setName('');
    setEditorError(null);
    editorModal.open();
  };

  const openRename = (group: GroupDto) => {
    setEditingGroup(group);
    setName(group.name);
    setEditorError(null);
    editorModal.open();
  };

  const submitEditor = async () => {
    setEditorError(null);
    const trimmedName = name.trim();
    const mutation = editingGroup
      ? renameMutation.mutateAsync({ id: editingGroup.id, data: { name: trimmedName } })
      : createMutation.mutateAsync({ data: { name: trimmedName } });
    const response = await mutation.catch(() => null);
    if (!response) {
      setEditorError({ title: 'IdentityService недоступен', message: 'Повторите попытку позже.' });
      return;
    }
    const successStatus = editingGroup ? 204 : 201;
    if (response.status !== successStatus) {
      const data: unknown = response.data;
      const problem =
        typeof data === 'object' && data !== null && ('title' in data || 'errors' in data) ? data : {};
      setEditorError(getIdentityProblemPresentation(problem, response.status));
      return;
    }
    await refresh();
    editorModal.close();
  };

  const submitDelete = async () => {
    if (!deleteTarget) {
      return;
    }
    setDeleteError(null);
    const response = await deleteMutation.mutateAsync({ id: deleteTarget.id }).catch(() => null);
    if (!response) {
      setDeleteError({ title: 'IdentityService недоступен', message: 'Повторите попытку позже.' });
      return;
    }
    if (response.status !== 204) {
      const problem = typeof response.data === 'object' && response.data !== null ? response.data : {};
      setDeleteError(getIdentityProblemPresentation(problem, response.status));
      return;
    }
    await refresh();
    setDeleteTarget(null);
  };

  return (
    <Page>
      <PageBreadcrumbs
        items={[
          { label: 'Главная', to: '/' },
          { label: 'Администратор', to: '/admin' },
          { label: 'Группы' },
        ]}
      />
      <Stack gap="md">
        <Group justify="space-between" align="flex-end" gap="md" wrap="wrap">
          <PageHeader
            title="Учебные группы"
            description="Справочник групп. Группу можно указать в коде приглашения — зарегистрированные по нему студенты попадут в неё сразу."
          />
          <Button size="sm" onClick={openCreate}>
            Создать группу
          </Button>
        </Group>
        <AdminContourTabs />
      </Stack>

      <AppCard p={0}>
        <QueryBoundary
          isPending={groupsQuery.isPending}
          isError={groupsQuery.isError || groupsQuery.data?.status !== 200}
          data={groupsQuery.data?.status === 200 ? groupsQuery.data.data : undefined}
          errorTitle="IdentityService недоступен"
          emptyTitle="Групп пока нет"
          emptyDescription="Создайте группу и укажите её в коде приглашения."
          isEmpty={(rows) => rows.length === 0}
        >
          {(rows) => (
            <Table striped highlightOnHover withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Название</Table.Th>
                  <Table.Th>Создана</Table.Th>
                  <Table.Th>Действия</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((group) => (
                  <Table.Tr key={group.id}>
                    <Table.Td>
                      <Text fw={600}>{group.name}</Text>
                    </Table.Td>
                    <Table.Td>{formatUserDateTime(group.createdAt)}</Table.Td>
                    <Table.Td>
                      <Group gap={4} wrap="nowrap">
                        <Button size="xs" variant="subtle" onClick={() => openRename(group)}>
                          Переименовать
                        </Button>
                        <Button
                          size="xs"
                          variant="subtle"
                          color="red"
                          onClick={() => {
                            setDeleteError(null);
                            setDeleteTarget(group);
                          }}
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
        opened={editorOpened}
        onClose={editorModal.close}
        title={editingGroup ? 'Переименовать группу' : 'Создать группу'}
        centered
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submitEditor();
          }}
        >
          <Stack gap="md">
            {editorError ? (
              <Alert color="red" title={editorError.title} variant="light">
                {editorError.message}
              </Alert>
            ) : null}
            <TextInput
              label="Название"
              description="Уникальное, без учёта регистра. До 50 символов"
              placeholder="ИС-21"
              value={name}
              maxLength={50}
              onChange={(event) => setName(event.currentTarget.value)}
            />
            <FormActions
              submitLabel={editingGroup ? 'Сохранить' : 'Создать'}
              loading={createMutation.isPending || renameMutation.isPending}
              onCancel={editorModal.close}
            />
          </Stack>
        </form>
      </Modal>

      <ConfirmModal
        opened={deleteTarget !== null}
        title="Удалить группу"
        message={`Группа «${deleteTarget?.name ?? ''}» будет удалена. Если к ней привязаны пользователи или коды приглашения, удаление не пройдёт.`}
        confirmLabel="Удалить"
        loading={deleteMutation.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void submitDelete()}
      >
        {deleteError ? (
          <Alert color="red" title={deleteError.title} variant="light">
            {deleteError.message}
          </Alert>
        ) : null}
      </ConfirmModal>
    </Page>
  );
}
