import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Grid,
  Group,
  Modal,
  Pagination,
  Stack,
  Text,
  Textarea,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { FormEvent } from 'react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { UserRole, type UserRole as UserRoleType } from '../../api/identity/model';
import { useGetUserActivity } from '../../api/identity/audit/audit';
import { useGetUserDetails } from '../../api/identity/users/users';
import { formatAuditEventType } from '../../entities/audit';
import {
  formatUserDateTime,
  formatUserRole,
  formatUserStatus,
  getUserDisplayName,
  getUserStatusTone,
} from '../../entities/user';
import { AdminContourTabs } from '../../features/admin-contour';
import {
  AdminUsersApiError,
  blockAdminUser,
  getAdminUsersErrorPresentation,
  replaceAdminUserRoles,
  unblockAdminUser,
} from '../../features/admin-users';
import type { IdentityApiProblemPresentation } from '../../shared/lib/identity-problem-details';
import {
  AppCard,
  ConfirmModal,
  EmptyState,
  FormActions,
  Page,
  PageBreadcrumbs,
  PageHeader,
} from '../../shared/ui';

const editableRoles = [UserRole.Admin, UserRole.Teacher, UserRole.Student];
const activityPageSize = 5;

const getAdminUserMutationErrorPresentation = (error: unknown): IdentityApiProblemPresentation =>
  error instanceof AdminUsersApiError
    ? getAdminUsersErrorPresentation(error.problem, error.status)
    : { title: 'IdentityService недоступен', message: 'Проверьте, что сервис запущен.' };

function UserDetailsSkeleton() {
  return (
    <AppCard>
      <EmptyState
        title="Загружаем пользователя"
        description="Получаем карточку пользователя из IdentityService."
      />
    </AppCard>
  );
}

function UserNotFound() {
  return (
    <AppCard>
      <EmptyState
        title="Пользователь не найден"
        description="Проверьте ссылку или вернитесь к списку пользователей."
        actions={
          <Button component={Link} to="/admin/users" variant="outline">
            К списку пользователей
          </Button>
        }
      />
    </AppCard>
  );
}

export function AdminUserDetailsPage() {
  const { userId } = useParams();
  const safeUserId = userId ?? '';
  const queryClient = useQueryClient();
  const [rolesModalOpened, rolesModal] = useDisclosure(false);
  const [blockModalOpened, blockModal] = useDisclosure(false);
  const [unblockModalOpened, unblockModal] = useDisclosure(false);
  const [selectedRoles, setSelectedRoles] = useState<UserRoleType[]>([]);
  const [rolesError, setRolesError] = useState<IdentityApiProblemPresentation | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [blockError, setBlockError] = useState<IdentityApiProblemPresentation | null>(null);
  const [unblockError, setUnblockError] = useState<IdentityApiProblemPresentation | null>(null);
  const [activityPage, setActivityPage] = useState(1);

  const userQuery = useGetUserDetails(safeUserId, {
    query: { enabled: Boolean(userId), retry: false },
  });

  const activityQuery = useGetUserActivity(
    safeUserId,
    { Page: activityPage, PageSize: activityPageSize },
    { query: { enabled: Boolean(userId), retry: false } },
  );

  const response = userQuery.data;
  const user = response?.status === 200 ? response.data : null;
  const apiError = response && response.status !== 200 ? response.data : null;
  const apiErrorStatus = response && response.status !== 200 ? response.status : undefined;
  const apiErrorPresentation = apiError
    ? getAdminUsersErrorPresentation(apiError, apiErrorStatus)
    : null;
  const pageTitle = user ? getUserDisplayName(user) : 'Карточка пользователя';
  const isBlocked = user ? user.status === 'Blocked' || Boolean(user.blockedAt) : false;
  const activityResponse = activityQuery.data;
  const activity = activityResponse?.status === 200 ? activityResponse.data : null;
  const activityError =
    activityResponse && activityResponse.status !== 200 ? activityResponse.data : null;
  const activityErrorStatus =
    activityResponse && activityResponse.status !== 200 ? activityResponse.status : undefined;
  const activityErrorPresentation = activityError
    ? getAdminUsersErrorPresentation(activityError, activityErrorStatus)
    : null;
  const activityTotalPages = Math.max(1, Math.ceil((activity?.totalCount ?? 0) / activityPageSize));

  const refreshUserQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [`/api/v1/users/${safeUserId}`] }),
      queryClient.invalidateQueries({ queryKey: [`/api/v1/users/${safeUserId}/activity`] }),
      queryClient.invalidateQueries({ queryKey: ['/api/v1/users'] }),
    ]);
  };

  const updateRolesMutation = useMutation({
    mutationFn: () => replaceAdminUserRoles(safeUserId, selectedRoles),
    onSuccess: async () => {
      await refreshUserQueries();
      setRolesError(null);
      rolesModal.close();
    },
    onError: (error) => setRolesError(getAdminUserMutationErrorPresentation(error)),
  });

  const blockUserMutation = useMutation({
    mutationFn: () => blockAdminUser(safeUserId, blockReason),
    onSuccess: async () => {
      await refreshUserQueries();
      setBlockError(null);
      setBlockReason('');
      blockModal.close();
    },
    onError: (error) => setBlockError(getAdminUserMutationErrorPresentation(error)),
  });

  const unblockUserMutation = useMutation({
    mutationFn: () => unblockAdminUser(safeUserId),
    onSuccess: async () => {
      await refreshUserQueries();
      setUnblockError(null);
      unblockModal.close();
    },
    onError: (error) => setUnblockError(getAdminUserMutationErrorPresentation(error)),
  });

  const openRolesModal = () => {
    if (!user) {
      return;
    }

    setSelectedRoles(
      user.roles.filter((role): role is UserRoleType =>
        editableRoles.includes(role as UserRoleType),
      ),
    );
    setRolesError(null);
    rolesModal.open();
  };

  const closeRolesModal = () => {
    if (!updateRolesMutation.isPending) {
      rolesModal.close();
    }
  };

  const openBlockModal = () => {
    setBlockReason('');
    setBlockError(null);
    blockModal.open();
  };

  const closeBlockModal = () => {
    if (!blockUserMutation.isPending) {
      blockModal.close();
    }
  };

  const openUnblockModal = () => {
    setUnblockError(null);
    unblockModal.open();
  };

  const closeUnblockModal = () => {
    if (!unblockUserMutation.isPending) {
      unblockModal.close();
    }
  };

  const submitRoles = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRolesError(null);

    if (selectedRoles.length === 0) {
      setRolesError({ title: 'Ошибка валидации', message: 'Выберите хотя бы одну роль.' });
      return;
    }

    updateRolesMutation.mutate();
  };

  return (
    <Page>
      <PageBreadcrumbs
        items={[
          { label: 'Главная', to: '/' },
          { label: 'Администратор', to: '/admin' },
          { label: 'Пользователи', to: '/admin/users' },
          { label: user?.email ?? 'Карточка пользователя' },
        ]}
      />

      <Stack gap="md">
        <Group justify="space-between" align="flex-end" gap="md" wrap="wrap">
          <PageHeader title={pageTitle} description={user?.email ?? safeUserId} />
          <Button component={Link} to="/admin/users" size="sm" variant="outline">
            Назад к списку
          </Button>
        </Group>
        <AdminContourTabs />
      </Stack>

      {!userId ? (
        <UserNotFound />
      ) : userQuery.isPending ? (
        <UserDetailsSkeleton />
      ) : userQuery.isError ? (
        <AppCard>
          <EmptyState
            title="IdentityService недоступен"
            description="Проверьте, что сервис запущен и runtime config указывает на правильный адрес."
          />
        </AppCard>
      ) : apiErrorStatus === 404 ? (
        <UserNotFound />
      ) : apiError ? (
        <AppCard p="md">
          <Alert color="red" title={apiErrorPresentation?.title} variant="light">
            {apiErrorPresentation?.message}
          </Alert>
        </AppCard>
      ) : user ? (
        <Grid gutter="md" align="flex-start">
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Stack gap="md">
              <AppCard p="md">
                <Stack gap="md">
                  <Title order={3} size="h5">
                    Основная информация
                  </Title>
                  <Grid gutter="md">
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <Text c="dimmed" size="xs" tt="uppercase">
                        Имя пользователя
                      </Text>
                      <Text fw={600}>{getUserDisplayName(user)}</Text>
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <Text c="dimmed" size="xs" tt="uppercase">
                        Email
                      </Text>
                      <Text fw={600}>{user.email}</Text>
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <Text c="dimmed" size="xs" tt="uppercase">
                        Статус
                      </Text>
                      <Badge color={getUserStatusTone(user.status)} radius="sm" variant="dot">
                        {formatUserStatus(user.status)}
                      </Badge>
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <Text c="dimmed" size="xs" tt="uppercase">
                        Идентификатор
                      </Text>
                      <Text fw={600}>{user.id}</Text>
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <Text c="dimmed" size="xs" tt="uppercase">
                        Создан
                      </Text>
                      <Text fw={600}>{formatUserDateTime(user.createdAt)}</Text>
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <Text c="dimmed" size="xs" tt="uppercase">
                        Обновлен
                      </Text>
                      <Text fw={600}>{formatUserDateTime(user.updatedAt)}</Text>
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <Text c="dimmed" size="xs" tt="uppercase">
                        Последний вход
                      </Text>
                      <Text fw={600}>{formatUserDateTime(user.lastLoginAt)}</Text>
                    </Grid.Col>
                  </Grid>
                </Stack>
              </AppCard>

              <AppCard p="md">
                <Stack gap="md">
                  <Group justify="space-between" align="center" gap="md" wrap="wrap">
                    <Title order={3} size="h5">
                      Роли доступа
                    </Title>
                    <Button size="xs" variant="outline" onClick={openRolesModal}>
                      Изменить роли
                    </Button>
                  </Group>
                  {user.roles.length > 0 ? (
                    <Group gap="xs">
                      {user.roles.map((role) => (
                        <Badge key={role} color="blue" radius="sm" variant="light">
                          {formatUserRole(role)}
                        </Badge>
                      ))}
                    </Group>
                  ) : (
                    <Text c="dimmed" size="sm">
                      У пользователя нет назначенных ролей.
                    </Text>
                  )}
                </Stack>
              </AppCard>
            </Stack>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 4 }}>
            <Stack gap="md">
              <AppCard p="md">
                <Stack gap="md">
                  <Title order={3} size="h5">
                    Блокировка
                  </Title>
                  <Grid gutter="md">
                    <Grid.Col span={12}>
                      <Text c="dimmed" size="xs" tt="uppercase">
                        Дата блокировки
                      </Text>
                      <Text fw={600}>{formatUserDateTime(user.blockedAt)}</Text>
                    </Grid.Col>
                    <Grid.Col span={12}>
                      <Text c="dimmed" size="xs" tt="uppercase">
                        Причина
                      </Text>
                      <Text fw={600}>{user.blockReason?.trim() || 'Не указано'}</Text>
                    </Grid.Col>
                  </Grid>
                  {isBlocked ? (
                    <Button size="sm" variant="outline" onClick={openUnblockModal}>
                      Разблокировать пользователя
                    </Button>
                  ) : (
                    <Button color="red" size="sm" onClick={openBlockModal}>
                      Заблокировать пользователя
                    </Button>
                  )}
                </Stack>
              </AppCard>

              <AppCard p="md">
                <Stack gap="md">
                  <Group justify="space-between" align="center" gap="md" wrap="wrap">
                    <Title order={3} size="h5">
                      Активность
                    </Title>
                    {activity ? (
                      <Badge color="gray" radius="sm" variant="light">
                        {activity.totalCount}
                      </Badge>
                    ) : null}
                  </Group>

                  {activityQuery.isPending ? (
                    <Text c="dimmed" size="sm">
                      Загружаем последние события пользователя.
                    </Text>
                  ) : activityQuery.isError ? (
                    <Alert color="red" variant="light">
                      IdentityService недоступен. Проверьте, что сервис запущен.
                    </Alert>
                  ) : activityError ? (
                    <Alert color="red" title={activityErrorPresentation?.title} variant="light">
                      {activityErrorPresentation?.message}
                    </Alert>
                  ) : activity && activity.items.length > 0 ? (
                    <Stack gap="sm">
                      {activity.items.map((event) => (
                        <Stack
                          key={event.id}
                          gap={4}
                          p="xs"
                          style={{
                            border: '1px solid var(--mantine-color-gray-3)',
                            borderRadius: 4,
                          }}
                        >
                          <Group gap="xs" justify="space-between" wrap="nowrap">
                            <Badge color="blue" radius="sm" variant="light">
                              {formatAuditEventType(event.eventType)}
                            </Badge>
                            <Text c="dimmed" size="xs" ta="right">
                              {formatUserDateTime(event.createdAt)}
                            </Text>
                          </Group>
                          <Text size="sm">{event.description}</Text>
                        </Stack>
                      ))}

                      {activityTotalPages > 1 ? (
                        <Pagination
                          size="xs"
                          total={activityTotalPages}
                          value={activityPage}
                          onChange={setActivityPage}
                        />
                      ) : null}
                    </Stack>
                  ) : (
                    <Text c="dimmed" size="sm">
                      По пользователю пока нет событий.
                    </Text>
                  )}
                </Stack>
              </AppCard>
            </Stack>
          </Grid.Col>
        </Grid>
      ) : (
        <UserNotFound />
      )}

      <Modal
        opened={rolesModalOpened}
        onClose={closeRolesModal}
        title="Изменить роли"
        centered
        size="md"
      >
        <form onSubmit={submitRoles}>
          <Stack gap="md">
            {rolesError ? (
              <Alert color="red" title={rolesError.title} variant="light">
                {rolesError.message}
              </Alert>
            ) : null}

            <Checkbox.Group
              label="Роли пользователя"
              value={selectedRoles}
              onChange={(roles) => setSelectedRoles(roles as UserRoleType[])}
              withAsterisk
            >
              <Stack gap="xs" mt="xs">
                {editableRoles.map((role) => (
                  <Checkbox key={role} value={role} label={formatUserRole(role)} />
                ))}
              </Stack>
            </Checkbox.Group>

            <Text c="dimmed" size="sm">
              Будет сохранён полный набор выбранных ролей. Если бэк запрещает снять последнего
              администратора или изменить собственные права, ошибка появится здесь.
            </Text>

            <FormActions
              cancelLabel="Отмена"
              loading={updateRolesMutation.isPending}
              onCancel={closeRolesModal}
              submitLabel="Сохранить"
            />
          </Stack>
        </form>
      </Modal>

      <ConfirmModal
        opened={blockModalOpened}
        title="Заблокировать пользователя"
        message={`Пользователь ${user?.email ?? safeUserId} не сможет входить в систему до разблокировки.`}
        confirmLabel="Заблокировать"
        loading={blockUserMutation.isPending}
        onCancel={closeBlockModal}
        onConfirm={() => blockUserMutation.mutate()}
      >
        <Stack gap="sm">
          {blockError ? (
            <Alert color="red" title={blockError.title} variant="light">
              {blockError.message}
            </Alert>
          ) : null}
          <Textarea
            label="Причина"
            placeholder="Например: нарушение правил платформы"
            value={blockReason}
            autosize
            minRows={3}
            maxRows={5}
            onChange={(event) => setBlockReason(event.currentTarget.value)}
          />
        </Stack>
      </ConfirmModal>

      <ConfirmModal
        opened={unblockModalOpened}
        title="Разблокировать пользователя"
        message={`Пользователь ${user?.email ?? safeUserId} снова сможет входить в систему.`}
        confirmColor="blue"
        confirmLabel="Разблокировать"
        loading={unblockUserMutation.isPending}
        onCancel={closeUnblockModal}
        onConfirm={() => unblockUserMutation.mutate()}
      >
        {unblockError ? (
          <Alert color="red" title={unblockError.title} variant="light">
            {unblockError.message}
          </Alert>
        ) : null}
      </ConfirmModal>
    </Page>
  );
}
