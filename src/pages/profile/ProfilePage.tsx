import { Alert, Badge, Button, Grid, Group, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGetMyEducationProfile } from '../../api/education/profile/profile';
import { logout } from '../../api/identity/auth/auth';
import { useChangeMyPassword, useGetMyProfile, useUpdateMyProfile } from '../../api/identity/cabinet/cabinet';
import { formatUserDateTime, formatUserRoles, formatUserStatus } from '../../entities/user';
import { refreshSession } from '../../shared/http/refresh-session';
import { getIdentityProblemPresentation, type IdentityApiProblemPresentation } from '../../shared/lib/identity-problem-details';
import { useSessionStore } from '../../session';
import { AppCard, Page, PageBreadcrumbs, PageHeader, QueryBoundary } from '../../shared/ui';

import { LOGIN_NOTICE_KEY } from '../../session/lib/login-notice';

type NameForm = { lastName: string; firstName: string; middleName: string };

export function ProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const clearSession = useSessionStore((state) => state.clearSession);

  const profileQuery = useGetMyProfile({ query: { retry: false } });
  const educationQuery = useGetMyEducationProfile({ query: { retry: false } });
  const updateProfile = useUpdateMyProfile();
  const changePassword = useChangeMyPassword();

  const profile = profileQuery.data?.status === 200 ? profileQuery.data.data : undefined;
  const education = educationQuery.data?.status === 200 ? educationQuery.data.data : undefined;

  const [names, setNames] = useState<NameForm>({ lastName: '', firstName: '', middleName: '' });
  const [nameError, setNameError] = useState<IdentityApiProblemPresentation | null>(null);
  const [nameSaved, setNameSaved] = useState(false);

  const [passwords, setPasswords] = useState({ current: '', next: '', repeat: '' });
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setNames({
        lastName: profile.lastName ?? '',
        firstName: profile.firstName ?? '',
        middleName: profile.middleName ?? '',
      });
    }
  }, [profile]);

  const saveNames = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNameError(null);
    setNameSaved(false);
    if (!names.lastName.trim() && !names.firstName.trim()) {
      setNameError({ title: 'Не заполнено', message: 'Укажите хотя бы имя или фамилию.' });
      return;
    }

    const response = await updateProfile
      .mutateAsync({
        data: {
          lastName: names.lastName.trim() || null,
          firstName: names.firstName.trim() || null,
          middleName: names.middleName.trim() || null,
        },
      })
      .catch(() => null);
    if (!response) {
      setNameError({ title: 'IdentityService недоступен', message: 'Повторите попытку позже.' });
      return;
    }
    if (response.status !== 204) {
      setNameError(getIdentityProblemPresentation(response.data, response.status));
      return;
    }

    // Новый токен несёт обновлённое ФИО: так оно сразу попадает и в учебный профиль.
    await refreshSession(useSessionStore.getState().accessToken).catch(() => false);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['/api/v1/me'] }),
      queryClient.invalidateQueries({ queryKey: ['/api/v1/profile'] }),
    ]);
    setNameSaved(true);
  };

  const savePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError(null);
    if (!passwords.current) {
      setPasswordError('Введите текущий пароль.');
      return;
    }
    if (passwords.next.length < 8 || !/[A-Z]/.test(passwords.next) || !/[a-z]/.test(passwords.next) || !/[0-9]/.test(passwords.next)) {
      setPasswordError('Новый пароль: не короче 8 символов, заглавная и строчная буквы, цифра.');
      return;
    }
    if (passwords.next !== passwords.repeat) {
      setPasswordError('Новые пароли не совпадают.');
      return;
    }

    const response = await changePassword
      .mutateAsync({ data: { currentPassword: passwords.current, newPassword: passwords.next } })
      .catch(() => null);
    if (!response) {
      setPasswordError('IdentityService недоступен. Повторите попытку позже.');
      return;
    }
    if (response.status !== 204) {
      setPasswordError(getIdentityProblemPresentation(response.data, response.status).message);
      return;
    }

    // Сервер отозвал все сессии — выходим и просим войти с новым паролем.
    const { refreshToken } = useSessionStore.getState();
    clearSession();
    if (refreshToken) {
      void logout({ refreshToken }).catch(() => undefined);
    }
    // Охранник маршрута при выходе сам перекидывает на /login и теряет state — сообщение передаём через sessionStorage.
    try {
      sessionStorage.setItem(LOGIN_NOTICE_KEY, 'Пароль изменён. Войдите с новым паролем.');
    } catch {
      // Хранилище недоступно — вход просто откроется без сообщения.
    }
    navigate('/login', { replace: true });
  };

  return (
    <Page>
      <PageBreadcrumbs items={[{ label: 'Главная', to: '/' }, { label: 'Личный кабинет' }]} />
      <PageHeader title="Личный кабинет" description="Ваши данные. Все изменения записываются в журнал аудита." />

      <AppCard>
        <QueryBoundary
          isPending={profileQuery.isPending}
          isError={profileQuery.isError || profileQuery.data?.status !== 200}
          data={profile}
          errorTitle="Не удалось загрузить данные"
        >
          {(data) => (
            <Stack gap="md">
              <Title order={3} size="h5">
                Учётная запись
              </Title>
              <Grid gutter="md">
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Text c="dimmed" size="xs" tt="uppercase">
                    Email
                  </Text>
                  <Text fw={600}>{data.email}</Text>
                  <Text c="dimmed" size="xs">
                    Email меняет администратор
                  </Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Text c="dimmed" size="xs" tt="uppercase">
                    Роли
                  </Text>
                  <Group gap={6}>
                    <Text fw={600}>{formatUserRoles(data.roles)}</Text>
                    <Badge color="green" radius="sm" variant="dot">
                      {formatUserStatus(data.status)}
                    </Badge>
                  </Group>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Text c="dimmed" size="xs" tt="uppercase">
                    Учебная группа
                  </Text>
                  <Text fw={600}>{education?.group ?? '—'}</Text>
                  <Text c="dimmed" size="xs">
                    Группу назначает администратор
                  </Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Text c="dimmed" size="xs" tt="uppercase">
                    Последний вход
                  </Text>
                  <Text fw={600}>{formatUserDateTime(data.lastLoginAt)}</Text>
                </Grid.Col>
              </Grid>
            </Stack>
          )}
        </QueryBoundary>
      </AppCard>

      <AppCard>
        <form onSubmit={saveNames} noValidate>
          <Stack gap="md">
            <Title order={3} size="h5">
              ФИО
            </Title>
            {nameError ? (
              <Alert color="red" title={nameError.title} variant="light">
                {nameError.message}
              </Alert>
            ) : null}
            {nameSaved ? (
              <Alert color="green" variant="light">
                Сохранено.
              </Alert>
            ) : null}
            <Group grow align="flex-start">
              <TextInput
                label="Фамилия"
                maxLength={100}
                value={names.lastName}
                onChange={(event) => setNames({ ...names, lastName: event.currentTarget.value })}
              />
              <TextInput
                label="Имя"
                maxLength={100}
                value={names.firstName}
                onChange={(event) => setNames({ ...names, firstName: event.currentTarget.value })}
              />
              <TextInput
                label="Отчество"
                maxLength={100}
                value={names.middleName}
                onChange={(event) => setNames({ ...names, middleName: event.currentTarget.value })}
              />
            </Group>
            <Group>
              <Button type="submit" loading={updateProfile.isPending}>
                Сохранить
              </Button>
            </Group>
          </Stack>
        </form>
      </AppCard>

      <AppCard>
        <form onSubmit={savePassword} noValidate>
          <Stack gap="md" maw={420}>
            <Title order={3} size="h5">
              Смена пароля
            </Title>
            <Text c="dimmed" size="sm">
              После смены все ваши сессии завершатся, потребуется войти заново.
            </Text>
            {passwordError ? (
              <Alert color="red" variant="light">
                {passwordError}
              </Alert>
            ) : null}
            <PasswordInput
              label="Текущий пароль"
              autoComplete="current-password"
              value={passwords.current}
              onChange={(event) => setPasswords({ ...passwords, current: event.currentTarget.value })}
            />
            <PasswordInput
              label="Новый пароль"
              autoComplete="new-password"
              value={passwords.next}
              onChange={(event) => setPasswords({ ...passwords, next: event.currentTarget.value })}
            />
            <PasswordInput
              label="Повторите новый пароль"
              autoComplete="new-password"
              value={passwords.repeat}
              onChange={(event) => setPasswords({ ...passwords, repeat: event.currentTarget.value })}
            />
            <Group>
              <Button type="submit" variant="outline" loading={changePassword.isPending}>
                Сменить пароль
              </Button>
            </Group>
          </Stack>
        </form>
      </AppCard>
    </Page>
  );
}
