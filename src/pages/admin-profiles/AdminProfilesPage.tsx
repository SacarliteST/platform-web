import {
  Alert,
  Autocomplete,
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
  useGetStudentGroups,
  useUpdateAdminProfile,
} from '../../api/education/admin-profiles/admin-profiles';
import type { AdminProfileResponse, CreateAdminProfileRequest } from '../../api/education/model';
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
  group: '',
};

type EditForm = {
  legacyUserId: string;
  login: string;
  lastName: string;
  firstName: string;
  middleName: string;
  group: string;
};

const MAX_GROUP_LENGTH = 50;

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
  const updateMutation = useUpdateAdminProfile();
  const groupsQuery = useGetStudentGroups({ query: { retry: false } });
  const groupNames =
    groupsQuery.data?.status === 200 ? groupsQuery.data.data.map((group) => group.name) : [];

  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
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
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/profiles'] }),
      queryClient.invalidateQueries({ queryKey: ['/api/v1/student-groups'] }),
    ]);

  const startEdit = (profile: AdminProfileResponse) => {
    setEditError(null);
    setEditForm({
      legacyUserId: profile.legacyUserId,
      login: profile.login,
      lastName: profile.lastName,
      firstName: profile.firstName,
      middleName: profile.middleName,
      group: profile.group ?? '',
    });
  };

  const submitEdit = async () => {
    if (!editForm) {
      return;
    }
    setEditError(null);
    const response = await updateMutation
      .mutateAsync({
        legacyUserId: editForm.legacyUserId,
        data: {
          login: editForm.login.trim(),
          lastName: editForm.lastName.trim(),
          firstName: editForm.firstName.trim(),
          middleName: editForm.middleName.trim(),
          group: editForm.group.trim() || undefined,
        },
      })
      .catch(() => null);

    if (!response) {
      setEditError('Education API недоступен.');
      return;
    }
    if (response.status === 200) {
      await invalidate();
      setEditForm(null);
      return;
    }
    setEditError(
      response.data && typeof response.data === 'object'
        ? getEducationProblemMessage(response.data, response.status)
        : 'Не удалось сохранить профиль.',
    );
  };

  const submitCreate = async () => {
    setCreateError(null);
    const response = await createMutation
      .mutateAsync({ data: { ...form, group: form.group?.trim() || undefined } })
      .catch(() => null);

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
                  <Table.Th>Группа</Table.Th>
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
                      <Text size="sm" c={profile.group ? undefined : 'dimmed'}>
                        {profile.group ?? '—'}
                      </Text>
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
                      <Group gap={4} wrap="nowrap">
                        <Button size="xs" variant="subtle" onClick={() => startEdit(profile)}>
                          Изменить
                        </Button>
                        {profile.isActive ? (
                          <Button
                            size="xs"
                            variant="subtle"
                            color="red"
                            onClick={() => setDeactivateTarget(profile.legacyUserId)}
                          >
                            Отвязать
                          </Button>
                        ) : null}
                      </Group>
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
            {(detectedRole ?? form.role ?? ProfileRole.Student) === ProfileRole.Student ? (
              <Autocomplete
                label="Группа"
                description="Учебная группа студента, например «ИС-21». Необязательно — можно задать позже"
                data={groupNames}
                value={form.group ?? ''}
                maxLength={MAX_GROUP_LENGTH}
                onChange={(value) => setForm({ ...form, group: value })}
              />
            ) : null}
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

      <Modal
        opened={editForm !== null}
        onClose={() => setEditForm(null)}
        title="Изменить профиль"
        centered
      >
        {editForm ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submitEdit();
            }}
          >
            <Stack gap="md">
              {editError ? (
                <Alert color="red" variant="light" title="Не удалось сохранить">
                  {editError}
                </Alert>
              ) : null}
              <TextInput
                label="Логин / отображаемое имя"
                value={editForm.login}
                onChange={(event) => setEditForm({ ...editForm, login: event.currentTarget.value })}
                withAsterisk
              />
              <Group grow>
                <TextInput
                  label="Фамилия"
                  value={editForm.lastName}
                  onChange={(event) => setEditForm({ ...editForm, lastName: event.currentTarget.value })}
                  withAsterisk
                />
                <TextInput
                  label="Имя"
                  value={editForm.firstName}
                  onChange={(event) => setEditForm({ ...editForm, firstName: event.currentTarget.value })}
                  withAsterisk
                />
              </Group>
              <TextInput
                label="Отчество"
                value={editForm.middleName}
                onChange={(event) => setEditForm({ ...editForm, middleName: event.currentTarget.value })}
              />
              <Autocomplete
                label="Группа"
                description="Оставьте пустым, чтобы снять группу"
                data={groupNames}
                value={editForm.group}
                maxLength={MAX_GROUP_LENGTH}
                onChange={(value) => setEditForm({ ...editForm, group: value })}
              />
              <FormActions
                submitLabel="Сохранить"
                loading={updateMutation.isPending}
                onCancel={() => setEditForm(null)}
              />
            </Stack>
          </form>
        ) : null}
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
