import { Alert, Anchor, Button, Checkbox, Group, Paper, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useRegister } from '../../api/identity/auth/auth';
import {
  getIdentityProblemPresentation,
  type IdentityApiProblemPresentation,
} from '../../shared/lib/identity-problem-details';
import { createSessionUserFromTokenResponse, getDefaultSessionRoute, useSessionStore } from '../../session';
import '../../session/ui/LoginPage.css';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Form = {
  lastName: string;
  firstName: string;
  middleName: string;
  email: string;
  password: string;
  passwordRepeat: string;
  inviteCode: string;
  consent: boolean;
};

type Errors = Partial<Record<keyof Form, string>>;

const emptyForm: Form = {
  lastName: '',
  firstName: '',
  middleName: '',
  email: '',
  password: '',
  passwordRepeat: '',
  inviteCode: '',
  consent: false,
};

export function validateRegistration(form: Form): Errors {
  const errors: Errors = {};
  if (!form.lastName.trim()) errors.lastName = 'Укажите фамилию';
  if (!form.firstName.trim()) errors.firstName = 'Укажите имя';
  if (form.lastName.trim().length > 100) errors.lastName = 'Не длиннее 100 символов';
  if (form.firstName.trim().length > 100) errors.firstName = 'Не длиннее 100 символов';
  if (form.middleName.trim().length > 100) errors.middleName = 'Не длиннее 100 символов';
  if (!emailPattern.test(form.email.trim())) errors.email = 'Введите корректный email';
  if (form.password.length < 8) errors.password = 'Не короче 8 символов';
  else if (!/[A-Z]/.test(form.password) || !/[a-z]/.test(form.password) || !/[0-9]/.test(form.password)) {
    errors.password = 'Нужны заглавная и строчная буквы и цифра';
  }
  if (form.passwordRepeat !== form.password) errors.passwordRepeat = 'Пароли не совпадают';
  if (!form.consent) errors.consent = 'Нужно согласие на обработку персональных данных';
  return errors;
}

export function RegisterPage() {
  const navigate = useNavigate();
  const setSession = useSessionStore((state) => state.setSession);
  const registerMutation = useRegister();

  const [form, setForm] = useState<Form>(emptyForm);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<IdentityApiProblemPresentation | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((previous) => ({ ...previous, [key]: value }));

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    const found = validateRegistration(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      return;
    }

    const response = await registerMutation
      .mutateAsync({
        data: {
          email: form.email.trim(),
          password: form.password,
          lastName: form.lastName.trim(),
          firstName: form.firstName.trim(),
          middleName: form.middleName.trim() || null,
          inviteCode: form.inviteCode.trim() || null,
        },
      })
      .catch(() => null);

    if (!response) {
      setFormError({ title: 'IdentityService недоступен', message: 'Проверьте подключение и повторите попытку.' });
      return;
    }

    if (response.status === 202) {
      // Заявка принята и ждёт решения администратора: токенов нет.
      setSubmittedEmail(response.data.email);
      return;
    }

    if (response.status === 201) {
      const user = createSessionUserFromTokenResponse(response.data);
      if (!response.data.accessToken || !user) {
        setFormError({ title: 'Ошибка токена', message: 'Не удалось прочитать данные пользователя из токена.' });
        return;
      }
      setSession({ accessToken: response.data.accessToken, refreshToken: response.data.refreshToken, user });
      navigate(getDefaultSessionRoute(user), { replace: true });
      return;
    }

    if ((response.status as number) === 429) {
      setFormError({ title: 'Слишком много попыток', message: 'Подождите минуту и повторите.' });
      return;
    }

    setFormError(getIdentityProblemPresentation(response.data, response.status));
  };

  if (submittedEmail) {
    return (
      <section className="login-page">
        <div className="login-page__inner">
          <Paper className="login-page__card" p="xl" radius="sm" shadow="sm" withBorder>
            <Title className="login-page__title" order={2} size="h3" ta="center">
              Заявка отправлена
            </Title>
            <Stack gap="md" mt="lg">
              <Alert color="green" variant="light" title="Ожидайте одобрения">
                Заявка для {submittedEmail} принята. Войти можно после того, как администратор её одобрит.
              </Alert>
              <Button component={Link} to="/login" fullWidth variant="outline">
                Ко входу
              </Button>
            </Stack>
          </Paper>
        </div>
      </section>
    );
  }

  return (
    <section className="login-page">
      <div className="login-page__inner" style={{ width: 'min(100%, 460px)' }}>
        <Paper className="login-page__card" p="xl" radius="sm" shadow="sm" withBorder>
          <Title className="login-page__title" order={2} size="h3" ta="center">
            Регистрация
          </Title>

          <form onSubmit={onSubmit} noValidate>
            <Stack gap="md" mt="lg">
              {formError ? (
                <Alert color="red" title={formError.title} variant="light">
                  {formError.message}
                </Alert>
              ) : null}

              <Group grow align="flex-start">
                <TextInput
                  label="Фамилия"
                  withAsterisk
                  autoComplete="family-name"
                  value={form.lastName}
                  error={errors.lastName}
                  onChange={(event) => set('lastName', event.currentTarget.value)}
                />
                <TextInput
                  label="Имя"
                  withAsterisk
                  autoComplete="given-name"
                  value={form.firstName}
                  error={errors.firstName}
                  onChange={(event) => set('firstName', event.currentTarget.value)}
                />
              </Group>
              <TextInput
                label="Отчество"
                autoComplete="additional-name"
                value={form.middleName}
                error={errors.middleName}
                onChange={(event) => set('middleName', event.currentTarget.value)}
              />
              <TextInput
                label="Email"
                withAsterisk
                type="email"
                autoComplete="username"
                value={form.email}
                error={errors.email}
                onChange={(event) => set('email', event.currentTarget.value)}
              />
              <PasswordInput
                label="Пароль"
                withAsterisk
                description="Не короче 8 символов, заглавная и строчная буквы, цифра"
                autoComplete="new-password"
                value={form.password}
                error={errors.password}
                onChange={(event) => set('password', event.currentTarget.value)}
              />
              <PasswordInput
                label="Повторите пароль"
                withAsterisk
                autoComplete="new-password"
                value={form.passwordRepeat}
                error={errors.passwordRepeat}
                onChange={(event) => set('passwordRepeat', event.currentTarget.value)}
              />
              <TextInput
                label="Код приглашения"
                description="Необязательно. С кодом доступ открывается сразу, без ожидания администратора"
                value={form.inviteCode}
                onChange={(event) => set('inviteCode', event.currentTarget.value)}
              />
              <Checkbox
                label="Согласен на обработку персональных данных (ФИО, email) для работы в системе"
                checked={form.consent}
                error={errors.consent}
                onChange={(event) => set('consent', event.currentTarget.checked)}
              />

              <Button fullWidth type="submit" size="md" loading={registerMutation.isPending}>
                Зарегистрироваться
              </Button>
              <Text size="sm" ta="center" c="dimmed">
                Уже есть аккаунт?{' '}
                <Anchor component={Link} to="/login" size="sm">
                  Войти
                </Anchor>
              </Text>
            </Stack>
          </form>
        </Paper>
      </div>
    </section>
  );
}
