import {
  Alert,
  Anchor,
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
import { Link } from 'react-router-dom';
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
  userId: '',
  login: '',
  firstName: '',
  lastName: '',
  middleName: '',
  role: ProfileRole.Student,
  group: '',
};

type EditForm = {
  id: string;
  displayName: string;
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

const fullName = (profile: Pick<AdminProfileResponse, 'lastName' | 'firstName' | 'middleName'>) =>
  [profile.lastName, profile.firstName, profile.middleName]
    .filter((part) => part && part !== '-')
    .join(' ') || '—';

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
  const [restoreError, setRestoreError] = useState<string | null>(null);

  // Данные берём из IdentityService по ID пользователя: роль определяется автоматически, ФИО и логин подставляются
  // из учётной записи — их источник истины Identity, руками вводить не нужно.
  const trimmedUserId = form.userId.trim();
  const userIdIsGuid = GUID_RE.test(trimmedUserId);
  const identityLookup = useGetUserDetails(trimmedUserId, {
    query: { enabled: createOpened && userIdIsGuid, retry: false },
  });
  const identityUser =
    userIdIsGuid && identityLookup.data?.status === 200 ? identityLookup.data.data : null;
  const identityLookupFailed =
    userIdIsGuid && !identityLookup.isFetching && identityLookup.data?.status !== 200;
  const detectedRole = identityUser ? pickProfileRole(identityUser.roles) : null;
  const identityUserKey = identityUser?.id ?? null;

  useEffect(() => {
    if (!identityUser) {
      return;
    }
    setForm((previous) => ({
      ...previous,
      role: pickProfileRole(identityUser.roles),
      login: previous.login || identityUser.email,
      firstName: identityUser.firstName ?? previous.firstName,
      lastName: identityUser.lastName ?? previous.lastName,
      middleName: identityUser.middleName ?? previous.middleName,
    }));
    // Подставляем один раз на найденного пользователя, а не на каждое обновление кэша.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identityUserKey]);

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/profiles'] }),
      queryClient.invalidateQueries({ queryKey: ['/api/v1/student-groups'] }),
    ]);

  const startEdit = (profile: AdminProfileResponse) => {
    setEditError(null);
    setEditForm({ id: profile.id, displayName: fullName(profile), group: profile.group ?? '' });
  };

  const submitEdit = async () => {
    if (!editForm) {
      return;
    }
    setEditError(null);
    const response = await updateMutation
      .mutateAsync({
        legacyUserId: editForm.id,
        data: { group: editForm.group.trim() || undefined },
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
      .mutateAsync({
        data: { ...form, userId: trimmedUserId, group: form.group?.trim() || undefined },
      })
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
      setCreateError('Профиль с таким ID или логином уже существует.');
      return;
    }

    setCreateError(
      response.data && typeof response.data === 'object'
        ? getEducationProblemMessage(response.data, response.status)
        : 'Не удалось создать профиль.',
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

  // Восстановление отключённого профиля — тот же POST: для существующей записи сервер лишь включает её обратно.
  const restore = async (profile: AdminProfileResponse) => {
    setRestoreError(null);
    const response = await createMutation
      .mutateAsync({
        data: {
          userId: profile.id,
          login: profile.login,
          firstName: profile.firstName,
          lastName: profile.lastName,
          middleName: profile.middleName,
          role: ProfileRole.Student,
          group: profile.group ?? undefined,
        },
      })
      .catch(() => null);
    if (response?.status === 201) {
      await invalidate();
      return;
    }
    setRestoreError('Не удалось восстановить профиль.');
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
            description="Профиль создаётся автоматически при первом входе пользователя. ФИО и роль приходят из IdentityService, здесь задаётся учебная группа."
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setForm(emptyForm);
              setCreateError(null);
              createModal.open();
            }}
          >
            Создать вручную
          </Button>
        </Group>
        <AdminContourTabs />
      </Stack>

      {restoreError ? (
        <Alert color="red" variant="light" withCloseButton onClose={() => setRestoreError(null)}>
          {restoreError}
        </Alert>
      ) : null}

      <AppCard p={0}>
        <QueryBoundary
          isPending={profilesQuery.isPending}
          isError={profilesQuery.isError || profilesQuery.data?.status !== 200}
          data={profilesQuery.data?.status === 200 ? profilesQuery.data.data : undefined}
          errorTitle="Education API недоступен"
          emptyTitle="Профилей пока нет"
          emptyDescription="Профиль появится, когда пользователь первый раз войдёт на платформу."
          isEmpty={(rows) => rows.length === 0}
        >
          {(rows) => (
            <Table striped highlightOnHover withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>ФИО</Table.Th>
                  <Table.Th>Логин</Table.Th>
                  <Table.Th>Группа</Table.Th>
                  <Table.Th>ID</Table.Th>
                  <Table.Th>Статус</Table.Th>
                  <Table.Th>Действия</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((profile) => (
                  <Table.Tr key={profile.id}>
                    <Table.Td>
                      <Anchor component={Link} to={`/admin/users/${profile.id}`} size="sm">
                        {fullName(profile)}
                      </Anchor>
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
                      <Text size="xs" c="dimmed">
                        {profile.id}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={profile.isActive ? 'green' : 'gray'} radius="sm" variant="dot">
                        {profile.isActive ? 'Активен' : 'Отключён'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} wrap="nowrap">
                        <Button size="xs" variant="subtle" onClick={() => startEdit(profile)}>
                          Группа
                        </Button>
                        {profile.isActive ? (
                          <Button
                            size="xs"
                            variant="subtle"
                            color="red"
                            onClick={() => setDeactivateTarget(profile.id)}
                          >
                            Отключить
                          </Button>
                        ) : (
                          <Button
                            size="xs"
                            variant="subtle"
                            loading={createMutation.isPending}
                            onClick={() => void restore(profile)}
                          >
                            Восстановить
                          </Button>
                        )}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </QueryBoundary>
      </AppCard>

      <Modal opened={createOpened} onClose={createModal.close} title="Создать профиль вручную" centered>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submitCreate();
          }}
        >
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Обычно не нужно: профиль создаётся сам при первом входе. Ручное создание нужно, если автосоздание
              выключено.
            </Text>
            {createError ? (
              <Alert color="red" variant="light" title="Не удалось создать">
                {createError}
              </Alert>
            ) : null}
            <TextInput
              label="ID пользователя (IdentityService)"
              description="GUID пользователя — по нему подставляются роль, логин и ФИО"
              value={form.userId}
              onChange={(event) => setForm({ ...form, userId: event.currentTarget.value })}
              error={identityLookupFailed ? 'Пользователь с таким ID не найден в IdentityService' : undefined}
              withAsterisk
            />
            <TextInput
              label="Логин"
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
            {userIdIsGuid && identityLookup.isFetching ? (
              <Text size="sm" c="dimmed">
                Загружаем данные из IdentityService…
              </Text>
            ) : detectedRole ? (
              <Stack gap={4}>
                <Text size="sm" fw={500}>
                  Роль
                </Text>
                <Group gap="xs">
                  <Badge radius="sm">{roleLabel(detectedRole)}</Badge>
                  <Text size="xs" c="dimmed">
                    определена по роли в IdentityService, вручную не меняется
                  </Text>
                </Group>
              </Stack>
            ) : (
              <Select
                label="Роль"
                description={
                  identityLookupFailed
                    ? 'Не удалось определить автоматически — укажите вручную. Только профили с ролью «Студент» доступны для назначения на курсы и практики'
                    : 'Укажите ID пользователя, чтобы роль определилась автоматически. Только профили с ролью «Студент» доступны для назначения на курсы и практики'
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
              submitLabel="Создать"
              loading={createMutation.isPending || (userIdIsGuid && identityLookup.isFetching)}
              onCancel={createModal.close}
            />
          </Stack>
        </form>
      </Modal>

      <Modal
        opened={editForm !== null}
        onClose={() => setEditForm(null)}
        title="Учебная группа"
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
                label="Пользователь"
                description="ФИО и роль меняются в разделе «Пользователи» (IdentityService)"
                value={editForm.displayName}
                readOnly
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
        title="Отключить профиль"
        message="Пользователь потеряет доступ к учебным разделам и автоматически не восстановится. Вернуть доступ можно кнопкой «Восстановить»."
        confirmLabel="Отключить"
        loading={deactivateMutation.isPending}
        onCancel={() => setDeactivateTarget(null)}
        onConfirm={() => void confirmDeactivate()}
      />
    </Page>
  );
}
