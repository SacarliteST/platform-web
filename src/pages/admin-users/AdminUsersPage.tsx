import {
  Alert,
  Anchor,
  Avatar,
  Badge,
  Button,
  Checkbox,
  Grid,
  Group,
  Modal,
  Pagination,
  PasswordInput,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { UserRole, type CreateUserRequest, type ListUsersParams } from '../../api/identity/model';
import { useListUsers } from '../../api/identity/users/users';
import {
  formatUserDateTime,
  formatUserRole,
  formatUserStatus,
  getUserDisplayName,
  getUserInitials,
  getUserStatusTone,
} from '../../entities/user';
import { AdminContourTabs } from '../../features/admin-contour';
import {
  AdminUsersApiError,
  createAdminUser,
  getAdminUsersErrorPresentation,
  getAdminUsersFieldErrors,
} from '../../features/admin-users';
import type { IdentityApiProblemPresentation } from '../../shared/lib/identity-problem-details';
import {
  AppCard,
  EmptyState,
  FormActions,
  Page,
  PageBreadcrumbs,
  PageHeader,
} from '../../shared/ui';

type RoleFilter = 'all' | (typeof UserRole)[keyof typeof UserRole];
type StatusFilter = 'all' | 'Active' | 'Blocked';

const pageSize = 10;

const createUserSchema = z.object({
  email: z.string().email('Введите корректный email'),
  displayName: z.string().optional(),
  password: z.string().min(6, 'Пароль должен быть не короче 6 символов'),
  roles: z
    .array(z.enum([UserRole.Admin, UserRole.Teacher, UserRole.Student]))
    .min(1, 'Выберите хотя бы одну роль'),
});

type CreateUserFormValues = z.infer<typeof createUserSchema>;

const createUserDefaultValues: CreateUserFormValues = {
  email: '',
  displayName: '',
  password: '',
  roles: [UserRole.Student],
};

export function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [createModalOpened, createModal] = useDisclosure(false);
  const [createFormError, setCreateFormError] = useState<IdentityApiProblemPresentation | null>(null);

  const listUsersParams = useMemo<ListUsersParams>(() => {
    return {
      Page: page,
      PageSize: pageSize,
      Search: search.trim() || undefined,
      Role: roleFilter === 'all' ? undefined : roleFilter,
      Status: statusFilter === 'all' ? undefined : statusFilter,
    };
  }, [page, roleFilter, search, statusFilter]);

  const usersQuery = useListUsers(listUsersParams, { query: { retry: false } });

  const createUserForm = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: createUserDefaultValues,
  });

  const createUserMutation = useMutation({
    mutationFn: (values: CreateUserFormValues) => {
      const payload: CreateUserRequest = {
        email: values.email.trim(),
        displayName: values.displayName?.trim() || null,
        password: values.password,
        roles: values.roles,
      };

      return createAdminUser(payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/v1/users'] });
      createUserForm.reset(createUserDefaultValues);
      setCreateFormError(null);
      createModal.close();
      setPage(1);
    },
    onError: (error) => {
      setCreateFormError(
        error instanceof AdminUsersApiError
          ? getAdminUsersErrorPresentation(error.problem, error.status)
          : { title: 'IdentityService недоступен', message: 'Проверьте, что сервис запущен.' },
      );

      const fieldErrors = getAdminUsersFieldErrors(error);

      Object.entries(fieldErrors).forEach(([fieldName, messages]) => {
        const normalizedFieldName = fieldName.charAt(0).toLowerCase() + fieldName.slice(1);

        if (
          normalizedFieldName === 'email' ||
          normalizedFieldName === 'displayName' ||
          normalizedFieldName === 'password' ||
          normalizedFieldName === 'roles'
        ) {
          createUserForm.setError(normalizedFieldName, { message: messages[0], type: 'server' });
        }
      });
    },
  });

  const response = usersQuery.data;
  const usersPage = response?.status === 200 ? response.data : null;
  const users = usersPage?.items ?? [];
  const totalCount = usersPage?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const shownFrom = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const shownTo = Math.min(page * pageSize, totalCount);
  const apiError = response && response.status !== 200 ? response.data : null;
  const apiErrorStatus = response && response.status !== 200 ? response.status : undefined;
  const apiErrorPresentation = apiError
    ? getAdminUsersErrorPresentation(apiError, apiErrorStatus)
    : null;

  const resetToFirstPage = () => setPage(1);

  const openCreateModal = () => {
    createUserForm.reset(createUserDefaultValues);
    setCreateFormError(null);
    createModal.open();
  };

  const closeCreateModal = () => {
    if (!createUserMutation.isPending) {
      createModal.close();
    }
  };

  const submitCreateUser = createUserForm.handleSubmit((values) => {
    setCreateFormError(null);
    createUserMutation.mutate(values);
  });

  return (
    <Page>
      <PageBreadcrumbs
        items={[
          { label: 'Главная', to: '/' },
          { label: 'Администратор', to: '/admin' },
          { label: 'Пользователи' },
        ]}
      />

      <Stack gap="md">
        <Group justify="space-between" align="flex-end" gap="md" wrap="wrap">
          <PageHeader
            title="Пользователи"
            description="Поиск пользователей и управление ролями доступа."
          />
          <Button onClick={openCreateModal} size="sm">
            Создать пользователя
          </Button>
        </Group>
        <AdminContourTabs />
      </Stack>

      <AppCard p="md">
        <Grid gutter="sm">
          <Grid.Col span={{ base: 12, md: 6 }}>
            <TextInput
              label="Поиск"
              value={search}
              onChange={(event) => {
                setSearch(event.currentTarget.value);
                resetToFirstPage();
              }}
              placeholder="Поиск по email или имени..."
              size="sm"
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Select
              label="Роль"
              value={roleFilter}
              onChange={(value) => {
                setRoleFilter((value ?? 'all') as RoleFilter);
                resetToFirstPage();
              }}
              data={[
                { value: 'all', label: 'Все роли' },
                { value: UserRole.Admin, label: formatUserRole(UserRole.Admin) },
                { value: UserRole.Teacher, label: formatUserRole(UserRole.Teacher) },
                { value: UserRole.Student, label: formatUserRole(UserRole.Student) },
              ]}
              size="sm"
              allowDeselect={false}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Select
              label="Статус"
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter((value ?? 'all') as StatusFilter);
                resetToFirstPage();
              }}
              data={[
                { value: 'all', label: 'Все статусы' },
                { value: 'Active', label: formatUserStatus('Active') },
                { value: 'Blocked', label: formatUserStatus('Blocked') },
              ]}
              size="sm"
              allowDeselect={false}
            />
          </Grid.Col>
        </Grid>
      </AppCard>

      <AppCard p={0}>
        {usersQuery.isPending ? (
          <EmptyState
            title="Загружаем пользователей"
            description="Получаем список пользователей из IdentityService."
          />
        ) : usersQuery.isError ? (
          <EmptyState
            title="IdentityService недоступен"
            description="Проверьте, что сервис запущен и runtime config указывает на правильный адрес."
          />
        ) : apiError ? (
          <Stack p="md">
            <Alert color="red" title={apiErrorPresentation?.title} variant="light">
              {apiErrorPresentation?.message}
            </Alert>
          </Stack>
        ) : users.length > 0 ? (
          <Stack gap={0}>
            <Table striped highlightOnHover withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Пользователь</Table.Th>
                  <Table.Th>Email</Table.Th>
                  <Table.Th>Роли</Table.Th>
                  <Table.Th>Статус</Table.Th>
                  <Table.Th>Последний вход</Table.Th>
                  <Table.Th>Действия</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {users.map((user) => (
                  <Table.Tr key={user.id}>
                    <Table.Td>
                      <Group gap="sm" wrap="nowrap">
                        <Avatar color="gray" radius="xl" size="sm">
                          {getUserInitials(user)}
                        </Avatar>
                        <Text fw={600} size="sm">
                          {getUserDisplayName(user)}
                        </Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{user.email}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        {user.roles.length > 0 ? (
                          user.roles.map((role) => (
                            <Badge key={role} color="blue" radius="sm" variant="light">
                              {formatUserRole(role)}
                            </Badge>
                          ))
                        ) : (
                          <Text c="dimmed" size="sm">
                            Без ролей
                          </Text>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={getUserStatusTone(user.status)} radius="sm" variant="dot">
                        {formatUserStatus(user.status)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{formatUserDateTime(user.lastLoginAt)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs" wrap="nowrap">
                        <Anchor component={Link} to={`/admin/users/${user.id}`} size="sm">
                          Открыть
                        </Anchor>
                        <Button
                          component={Link}
                          to={`/admin/users/${user.id}`}
                          size="xs"
                          variant="subtle"
                        >
                          Роли
                        </Button>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>

            <Group justify="space-between" p="sm" gap="md" wrap="wrap">
              <Text c="dimmed" size="sm">
                Показано {shownFrom}-{shownTo} из {totalCount} пользователей
              </Text>
              <Pagination total={totalPages} value={page} onChange={setPage} size="sm" />
            </Group>
          </Stack>
        ) : (
          <EmptyState
            title="Пользователи не найдены"
            description="Измените поисковый запрос или параметры фильтрации."
          />
        )}
      </AppCard>

      <Modal
        opened={createModalOpened}
        onClose={closeCreateModal}
        title="Создать пользователя"
        centered
        size="lg"
      >
        <form onSubmit={submitCreateUser}>
          <Stack gap="md">
            {createFormError ? (
              <Alert color="red" title={createFormError.title} variant="light">
                {createFormError.message}
              </Alert>
            ) : null}

            <TextInput
              label="Email"
              placeholder="user@scoodle.local"
              error={createUserForm.formState.errors.email?.message}
              withAsterisk
              {...createUserForm.register('email')}
            />

            <TextInput
              label="Имя"
              placeholder="Иван Петров"
              error={createUserForm.formState.errors.displayName?.message}
              {...createUserForm.register('displayName')}
            />

            <PasswordInput
              label="Пароль"
              placeholder="Временный пароль"
              error={createUserForm.formState.errors.password?.message}
              withAsterisk
              {...createUserForm.register('password')}
            />

            <Controller
              control={createUserForm.control}
              name="roles"
              render={({ field, fieldState }) => (
                <Checkbox.Group
                  label="Роли"
                  value={field.value}
                  onChange={field.onChange}
                  error={fieldState.error?.message}
                  withAsterisk
                >
                  <Group mt="xs" gap="md">
                    <Checkbox value={UserRole.Admin} label={formatUserRole(UserRole.Admin)} />
                    <Checkbox value={UserRole.Teacher} label={formatUserRole(UserRole.Teacher)} />
                    <Checkbox value={UserRole.Student} label={formatUserRole(UserRole.Student)} />
                  </Group>
                </Checkbox.Group>
              )}
            />

            <FormActions
              cancelLabel="Отмена"
              loading={createUserMutation.isPending}
              onCancel={closeCreateModal}
              submitLabel="Создать"
            />
          </Stack>
        </form>
      </Modal>
    </Page>
  );
}
