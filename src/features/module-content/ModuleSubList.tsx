import { Alert, Button, Group, Modal, Stack, Table, Text, TextInput } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useState, type ReactNode } from 'react';
import { AppCard, ConfirmModal, FormActions, QueryBoundary } from '../../shared/ui';

export type ModuleSubItem = { id: string; name: string };

type ModuleSubListProps = {
  title: string;
  addLabel: string;
  namePlaceholder: string;
  isPending: boolean;
  isError: boolean;
  items: ModuleSubItem[] | undefined;
  emptyDescription: string;
  creating: boolean;
  deleting: boolean;
  onCreate: (name: string) => Promise<string | null>;
  onDelete: (id: string) => Promise<void>;
  renderActions?: (item: ModuleSubItem) => ReactNode;
};

export function ModuleSubList({
  addLabel,
  creating,
  deleting,
  emptyDescription,
  isError,
  isPending,
  items,
  namePlaceholder,
  onCreate,
  onDelete,
  renderActions,
  title,
}: ModuleSubListProps) {
  const [createOpened, createModal] = useDisclosure(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ModuleSubItem | null>(null);

  const submit = async () => {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Укажите название.');
      return;
    }
    const failure = await onCreate(trimmed);
    if (failure) {
      setError(failure);
      return;
    }
    setName('');
    createModal.close();
  };

  return (
    <AppCard p={0}>
      <Group justify="space-between" p="md" gap="md" wrap="wrap">
        <Text fw={600}>{title}</Text>
        <Button
          size="xs"
          onClick={() => {
            setName('');
            setError(null);
            createModal.open();
          }}
        >
          {addLabel}
        </Button>
      </Group>

      <QueryBoundary
        isPending={isPending}
        isError={isError}
        data={items}
        errorTitle="Education API недоступен"
        emptyTitle="Пусто"
        emptyDescription={emptyDescription}
        isEmpty={(rows) => rows.length === 0}
      >
        {(rows) => (
          <Table striped highlightOnHover withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Название</Table.Th>
                <Table.Th w={260}>Действия</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((item) => (
                <Table.Tr key={item.id}>
                  <Table.Td>
                    <Text size="sm">{item.name}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      {renderActions?.(item)}
                      <Button
                        size="xs"
                        color="red"
                        variant="subtle"
                        onClick={() => setDeleteTarget(item)}
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

      <Modal opened={createOpened} onClose={createModal.close} title={addLabel} centered>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <Stack gap="md">
            {error ? (
              <Alert color="red" variant="light" title="Не удалось создать">
                {error}
              </Alert>
            ) : null}
            <TextInput
              label="Название"
              placeholder={namePlaceholder}
              withAsterisk
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
            />
            <FormActions submitLabel="Создать" loading={creating} onCancel={createModal.close} />
          </Stack>
        </form>
      </Modal>

      <ConfirmModal
        opened={deleteTarget !== null}
        title="Удалить"
        message={`«${deleteTarget?.name ?? ''}» и связанное содержимое будут удалены.`}
        confirmLabel="Удалить"
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) {
            await onDelete(deleteTarget.id);
          }
          setDeleteTarget(null);
        }}
      />
    </AppCard>
  );
}
