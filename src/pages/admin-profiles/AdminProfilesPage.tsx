import {
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  useCreateAdminProfile,
  useDeactivateAdminProfile,
  useGetAdminProfiles,
} from '../../api/education/admin-profiles/admin-profiles';
import type { CreateAdminProfileRequest } from '../../api/education/model';
import { ProfileRole } from '../../api/education/model';
import { useGetUserDetails } from '../../api/identity/users/users';
import { UserRole } from '../../api/identity/model';
import { getEducationProblemMessage } from '../../shared/lib';
import { AdminContourTabs } from '../../features/admin-contour';
import {
  AppCard,
  ConfirmModal,
  FormActions,
  Page,
  PageBreadcrumbs,
  PageHeader,
  QueryBoundary,
} from '../../shared/ui';

const emptyForm: CreateAdminProfileRequest = {
  identityUserId: '',
  login: '',
  firstName: '',
  lastName: '',
  middleName: '',
  role: ProfileRole.Student,
};

const roleOptions = [
  { value: ProfileRole.Student, label: 'Студент' },
  { value: ProfileRole.Teacher, label: 'Преподаватель' },
  { value: ProfileRole.Admin, label: 'Администратор' },
];

const roleLabel = (role: ProfileRole) =>
  roleOptions.find((option) => option.value === role)?.label ?? role;

const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Старшая роль identity-пользователя → роль профиля Education. Admin и Teacher — приоритетнее Student. */
function pickProfileRole(identityRoles: string[]): ProfileRole {
  if (identityRoles.includes(UserRole.Admin)) return ProfileRole.Admin;
  if (identityRoles.includes(UserRole.Teacher)) return ProfileRole.Teacher;
  return ProfileRole.Student;
}

export function AdminProfilesPage() {
  const queryClient = useQueryClient();
  const profilesQuery = useGetAdminProfiles({ query: { retry: false } });
  const createMutation = useCreateAdminProfile();
  const deactivateMutation = useDeactivateAdminProfile();

  const [createOpened, createModal] = useDisclosure(false);
  const [form, setForm] = useState<CreateAdminProfileRequest>(emptyForm);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<string | null>(null);

  // Роль берём из IdentityService по Identity User ID — чтобы нельзя было случайно
  // связать профиль с ролью, не совпадающей с ролью в токене этого пользователя.
  const trimmedIdentityId = form.identityUserId.trim();
  const identityIdIsGuid = GUID_RE.test(trimmedIdentityId);
  const identityLookup = useGetUserDetails(trimmedIdentityId, {
    query: { enabled: createOpened && identityIdIsGuid, retry: false },
  });
  const identityUser =
    identityIdIsGuid && identityLookup.data?.status === 200 ? identityLookup.data.data : null;
  const identityLookupFailed =
    identityIdIsGuid && !identityLookup.isFetching && identityLookup.data?.status !== 200;
  const detectedRole = identityUser ? pickProfileRole(identityUser.roles) : null;

  useEffect(() => {
    if (detectedRole) {
      setForm((previous) => (previous.role === detectedRole ? previous : { ...previous, role: detectedRole }));
    }
  }, [detectedRole]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/profiles'] });

  const submitCreate = async () => {
    setCreateError(null);
    const response = await createMutation.mutateAsync({ data: form }).catch(() => null);

    if (!response) {
      setCreateError('Education API недоступен.');
      return;
    }

    if (response.status === 201) {
      await invalidate();
      setForm(emptyForm);
      createModal.close();
      return;
    }

    if (response.status === 409) {
      setCreateError('Такой identity-пользователь или логин уже связан.');
      return;
    }

    setCreateError(
      response.data && typeof response.data === 'object'
        ? getEducationProblemMessage(response.data, response.status)
        : 'Не удалось связать пользователя.',
    );
  };

  const confirmDeactivate = async () => {
    if (!deactivateTarget) {
      return;
    }
    await deactivateMutation.mutateAsync({ legacyUserId: deactivateTarget }).catch(() => null);
    await invalidate();
    setDeactivateTarget(null);
  };

  return (
    <Page>
      <PageBreadcrumbs
        items={[
          { label: 'Главная', to: '/' },
          { label: 'Администратор', to: '/admin' },
          { label: 'Учебные профили' },
        ]}
      />

      <Stack gap="md">
        <Group justify="space-between" align="flex-end" gap="md" wrap="wrap">
          <PageHeader
            title="Учебные профили"
            description="Связь пользователей IdentityService с локальными профилями платформы."
          />
          <Button
            size="sm"
            onClick={() => {
              setForm(emptyForm);
              setCreateError(null);
              createModal.open();
            }}
          >
            Связать пользователя
          </Button>
        </Group>
        <AdminContourTabs />
      </Stack>

      <AppCard p={0}>
        <QueryBoundary
          isPending={profilesQuery.isPending}
          isError={profilesQuery.isError || profilesQuery.data?.status !== 200}
          data={profilesQuery.data?.status === 200 ? profilesQuery.data.data : undefined}
          errorTitle="Education API недоступен"
          emptyTitle="Профилей нет"
          emptyDescription="Свяжите identity-пользователя с учебным профилем."
          isEmpty={(rows) => rows.length === 0}
        >
          {(rows) => (
            <Table striped highlightOnHover withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>ФИО</Table.Th>
                  <Table.Th>Логин</Table.Th>
                  <Table.Th>Identity ID</Table.Th>
                  <Table.Th>Статус</Table.Th>
                  <Table.Th>Действия</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((profile) => (
                  <Table.Tr key={profile.legacyUserId}>
                    <Table.Td>
                      <Text size="sm">
                        {[profile.lastName, profile.firstName, profile.middleName]
                          .filter(Boolean)
                          .join(' ') || '—'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{profile.login}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">
                        {profile.identityUserId ?? '—'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={profile.isActive ? 'green' : 'gray'} radius="sm" variant="dot">
                        {profile.isActive ? 'Связан' : 'Не связан'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      {profile.isActive ? (
                        <Button
                          size="xs"
                          variant="subtle"
                          color="red"
                          onClick={() => setDeactivateTarget(profile.legacyUserId)}
                        >
                          Отвязать
                        </Button>
                      ) : (
                        <Text c="dimmed" size="xs">
                          —
                        </Text>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </QueryBoundary>
      </AppCard>

      <Modal opened={createOpened} onClose={createModal.close} title="Связать пользователя" centered>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submitCreate();
          }}
        >
          <Stack gap="md">
            {createError ? (
              <Alert color="red" variant="light" title="Не удалось связать">
                {createError}
              </Alert>
            ) : null}
            <TextInput
              label="Identity User ID"
              description="GUID пользователя из IdentityService — по нему определяем роль автоматически"
              value={form.identityUserId}
              onChange={(event) => setForm({ ...form, identityUserId: event.currentTarget.value })}
              error={identityLookupFailed ? 'Пользователь с таким ID не найден в IdentityService' : undefined}
              withAsterisk
            />
            <TextInput
              label="Логин / отображаемое имя"
              value={form.login}
              onChange={(event) => setForm({ ...form, login: event.currentTarget.value })}
              withAsterisk
            />
            <Group grow>
              <TextInput
                label="Фамилия"
                value={form.lastName}
                onChange={(event) => setForm({ ...form, lastName: event.currentTarget.value })}
                withAsterisk
              />
              <TextInput
                label="Имя"
                value={form.firstName}
                onChange={(event) => setForm({ ...form, firstName: event.currentTarget.value })}
                withAsterisk
              />
            </Group>
            <TextInput
              label="Отчество"
              value={form.middleName}
              onChange={(event) => setForm({ ...form, middleName: event.currentTarget.value })}
            />
            {identityIdIsGuid && identityLookup.isFetching ? (
              <Text size="sm" c="dimmed">
                Определяем роль по IdentityService…
              </Text>
            ) : detectedRole ? (
              <Stack gap={4}>
                <Text size="sm" fw={500}>
                  Роль
                </Text>
                <Group gap="xs">
                  <Badge radius="sm">{roleLabel(detectedRole)}</Badge>
                  <Text size="xs" c="dimmed">
                    определена автоматически по роли в IdentityService, вручную не меняется
                  </Text>
                </Group>
              </Stack>
            ) : (
              <Select
                label="Роль"
                description={
                  identityLookupFailed
                    ? 'Не удалось определить автоматически — укажите вручную. Только профили с ролью «Студент» доступны для назначения на курсы и практики'
                    : 'Укажите Identity User ID, чтобы роль определилась автоматически. Только профили с ролью «Студент» доступны для назначения на курсы и практики'
                }
                data={roleOptions}
                value={form.role ?? ProfileRole.Student}
                onChange={(value) =>
                  setForm({ ...form, role: (value as ProfileRole | null) ?? ProfileRole.Student })
                }
                allowDeselect={false}
                withAsterisk
              />
            )}
            <FormActions
              submitLabel="Связать"
              loading={createMutation.isPending || (identityIdIsGuid && identityLookup.isFetching)}
              onCancel={createModal.close}
            />
          </Stack>
        </form>
      </Modal>

      <ConfirmModal
        opened={deactivateTarget !== null}
        title="Отвязать профиль"
        message="Связь учебного профиля с identity-пользователем будет деактивирована."
        confirmLabel="Отвязать"
        loading={deactivateMutation.isPending}
        onCancel={() => setDeactivateTarget(null)}
        onConfirm={() => void confirmDeactivate()}
      />
    </Page>
  );
}
