import { Alert, Badge, Button, Group, Modal, NumberInput, Stack, Table, Text, TextInput } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useCreateInviteCode, useDeactivateInviteCode, useListInviteCodes } from '../../api/identity/invite-codes/invite-codes';
import type { InviteCodeDto } from '../../api/identity/model';
import { formatUserDateTime } from '../../entities/user';
import { AdminContourTabs } from '../../features/admin-contour';
import { getIdentityProblemPresentation, type IdentityApiProblemPresentation } from '../../shared/lib/identity-problem-details';
import { AppCard, ConfirmModal, FormActions, Page, PageBreadcrumbs, PageHeader, QueryBoundary } from '../../shared/ui';

type Form = { code: string; note: string; maxUses: number | string; expiresOn: string };
const emptyForm: Form = { code: '', note: '', maxUses: '', expiresOn: '' };

function codeState(code: InviteCodeDto): { label: string; color: string } {
  if (!code.isActive) return { label: 'Выключен', color: 'gray' };
  if (code.expiresAt && new Date(code.expiresAt).getTime() <= Date.now()) return { label: 'Истёк', color: 'orange' };
  if (code.maxUses != null && code.usedCount >= code.maxUses) return { label: 'Исчерпан', color: 'orange' };
  return { label: 'Действует', color: 'green' };
}

export function AdminInvitesPage() {
  const queryClient = useQueryClient();
  const codesQuery = useListInviteCodes({ query: { retry: false } });
  const createMutation = useCreateInviteCode();
  const deactivateMutation = useDeactivateInviteCode();

  const [createOpened, createModal] = useDisclosure(false);
  const [form, setForm] = useState<Form>(emptyForm);
  const [createError, setCreateError] = useState<IdentityApiProblemPresentation | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<InviteCodeDto | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['/api/v1/invite-codes'] });

  const submitCreate = async () => {
    setCreateError(null);
    const maxUses = form.maxUses === '' ? null : Number(form.maxUses);
    const response = await createMutation
      .mutateAsync({
        data: {
          code: form.code.trim() || null,
          note: form.note.trim() || null,
          maxUses,
          // Срок действует до конца выбранного дня (по местному времени).
          expiresAt: form.expiresOn ? new Date(`${form.expiresOn}T23:59:59`).toISOString() : null,
        },
      })
      .catch(() => null);
    if (!response) {
      setCreateError({ title: 'IdentityService недоступен', message: 'Повторите попытку позже.' });
      return;
    }
    if (response.status !== 201) {
      setCreateError(getIdentityProblemPresentation(response.data, response.status));
      return;
    }
    await refresh();
    setForm(emptyForm);
    createModal.close();
  };

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
    } catch {
      setCopied(null);
    }
  };

  return (
    <Page>
      <PageBreadcrumbs
        items={[
          { label: 'Главная', to: '/' },
          { label: 'Администратор', to: '/admin' },
          { label: 'Коды приглашения' },
        ]}
      />
      <Stack gap="md">
        <Group justify="space-between" align="flex-end" gap="md" wrap="wrap">
          <PageHeader
            title="Коды приглашения"
            description="Регистрация с действующим кодом одобряется сразу, без ожидания администратора."
          />
          <Button
            size="sm"
            onClick={() => {
              setForm(emptyForm);
              setCreateError(null);
              createModal.open();
            }}
          >
            Создать код
          </Button>
        </Group>
        <AdminContourTabs />
      </Stack>

      <AppCard p={0}>
        <QueryBoundary
          isPending={codesQuery.isPending}
          isError={codesQuery.isError || codesQuery.data?.status !== 200}
          data={codesQuery.data?.status === 200 ? codesQuery.data.data : undefined}
          errorTitle="IdentityService недоступен"
          emptyTitle="Кодов пока нет"
          emptyDescription="Создайте код и передайте его студентам."
          isEmpty={(rows) => rows.length === 0}
        >
          {(rows) => (
            <Table striped highlightOnHover withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Код</Table.Th>
                  <Table.Th>Заметка</Table.Th>
                  <Table.Th>Использован</Table.Th>
                  <Table.Th>Действует до</Table.Th>
                  <Table.Th>Статус</Table.Th>
                  <Table.Th>Действия</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((code) => {
                  const state = codeState(code);
                  return (
                    <Table.Tr key={code.id}>
                      <Table.Td>
                        <Text ff="monospace" fw={600}>
                          {code.code}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c={code.note ? undefined : 'dimmed'}>
                          {code.note ?? '—'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        {code.usedCount}
                        {code.maxUses != null ? ` из ${code.maxUses}` : ''}
                      </Table.Td>
                      <Table.Td>{code.expiresAt ? formatUserDateTime(code.expiresAt) : 'Без срока'}</Table.Td>
                      <Table.Td>
                        <Badge color={state.color} radius="sm" variant="dot">
                          {state.label}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4} wrap="nowrap">
                          <Button size="xs" variant="subtle" onClick={() => void copy(code.code)}>
                            {copied === code.code ? 'Скопировано' : 'Копировать'}
                          </Button>
                          {code.isActive ? (
                            <Button size="xs" variant="subtle" color="red" onClick={() => setDeactivateTarget(code)}>
                              Выключить
                            </Button>
                          ) : null}
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          )}
        </QueryBoundary>
      </AppCard>

      <Modal opened={createOpened} onClose={createModal.close} title="Создать код приглашения" centered>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submitCreate();
          }}
        >
          <Stack gap="md">
            {createError ? (
              <Alert color="red" title={createError.title} variant="light">
                {createError.message}
              </Alert>
            ) : null}
            <TextInput
              label="Код"
              description="Оставьте пустым — сгенерируем случайный. Буквы, цифры, дефис, 4–32 символа"
              value={form.code}
              onChange={(event) => setForm({ ...form, code: event.currentTarget.value })}
            />
            <TextInput
              label="Заметка"
              description="Для кого код, например «Группа ИС-21»"
              value={form.note}
              maxLength={500}
              onChange={(event) => setForm({ ...form, note: event.currentTarget.value })}
            />
            <NumberInput
              label="Сколько раз можно использовать"
              description="Пусто — без ограничения"
              min={1}
              allowDecimal={false}
              value={form.maxUses}
              onChange={(value) => setForm({ ...form, maxUses: value })}
            />
            <TextInput
              label="Действует до (включительно)"
              description="Пусто — без срока"
              type="date"
              value={form.expiresOn}
              onChange={(event) => setForm({ ...form, expiresOn: event.currentTarget.value })}
            />
            <FormActions submitLabel="Создать" loading={createMutation.isPending} onCancel={createModal.close} />
          </Stack>
        </form>
      </Modal>

      <ConfirmModal
        opened={deactivateTarget !== null}
        title="Выключить код"
        message={`Код ${deactivateTarget?.code ?? ''} перестанет работать. Уже зарегистрированные по нему пользователи не пострадают.`}
        confirmLabel="Выключить"
        loading={deactivateMutation.isPending}
        onCancel={() => setDeactivateTarget(null)}
        onConfirm={async () => {
          if (deactivateTarget) {
            await deactivateMutation.mutateAsync({ id: deactivateTarget.id }).catch(() => null);
            await refresh();
            setDeactivateTarget(null);
          }
        }}
      />
    </Page>
  );
}
