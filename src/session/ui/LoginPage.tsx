import { Alert, Button, Paper, PasswordInput, Stack, TextInput, Title } from '@mantine/core';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLogin } from '../../api/identity/auth/auth';
import type { ProblemDetails } from '../../api/identity/model';
import {
  getIdentityProblemMessage,
  getIdentityProblemPresentation,
  getIdentityProblemStringValues,
  type IdentityApiProblemPresentation,
} from '../../shared/lib/identity-problem-details';
import {
  createSessionUserFromTokenResponse,
  getDefaultSessionRoute,
  useSessionStore,
} from '../index';
import './LoginPage.css';

// Простая клиентская проверка формы из двух полей — без react-hook-form/zod,
// чтобы `forms`-чанк (rhf + zod + resolvers) не попадал в начальный бандл (TD-002).
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldErrors = { email?: string; password?: string };

function validate(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!emailPattern.test(email.trim())) {
    errors.email = 'Введите корректный email';
  }
  if (password.length < 1) {
    errors.password = 'Введите пароль';
  }
  return errors;
}

const blockedAccountMessage =
  'Учётная запись заблокирована. Обратитесь к администратору системы.';

const isBlockedAccountProblem = (problem: ProblemDetails): boolean => {
  const valuesToCheck = getIdentityProblemStringValues(problem);

  return valuesToCheck.some((value) => {
    const normalizedValue = value.toLowerCase();

    return (
      normalizedValue.includes('blocked') ||
      normalizedValue.includes('block') ||
      normalizedValue.includes('заблок')
    );
  });
};

export function LoginPage() {
  const navigate = useNavigate();
  const setSession = useSessionStore((state) => state.setSession);
  const loginMutation = useLogin();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<IdentityApiProblemPresentation | null>(null);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const errors = validate(email, password);
    setFieldErrors(errors);
    if (errors.email || errors.password) {
      return;
    }

    const response = await loginMutation
      .mutateAsync({ data: { email: email.trim(), password } })
      .catch(() => null);

    if (!response) {
      setFormError({
        title: 'IdentityService недоступен',
        message: 'Проверьте адрес сервиса и runtime config.',
      });
      return;
    }

    if (response.status === 401 && isBlockedAccountProblem(response.data)) {
      setFormError({
        title: response.data.title?.trim() || 'Вход заблокирован',
        message: response.data.detail?.trim() || blockedAccountMessage,
      });
      return;
    }

    if (response.status === 401) {
      setFormError({
        title: response.data.title?.trim() || 'Не удалось войти',
        message: getIdentityProblemMessage(response.data, response.status),
      });
      return;
    }

    if (response.status !== 200) {
      setFormError(getIdentityProblemPresentation(response.data, response.status));
      return;
    }

    if (!response.data.accessToken) {
      setFormError({
        title: 'Ошибка токена',
        message: 'IdentityService не вернул access token.',
      });
      return;
    }

    const user = createSessionUserFromTokenResponse(response.data);

    if (!user) {
      setFormError({
        title: 'Ошибка токена',
        message: 'Не удалось прочитать данные пользователя из токена.',
      });
      return;
    }

    setSession({
      accessToken: response.data.accessToken,
      user,
    });
    navigate(getDefaultSessionRoute(user), { replace: true });
  };

  return (
    <section className="login-page">
      <div className="login-page__inner">
        <Paper className="login-page__card" p="xl" radius="sm" shadow="sm" withBorder>
          <Title className="login-page__title" order={2} size="h3" ta="center">
            Вход в систему
          </Title>

          <form onSubmit={onSubmit} noValidate>
            <Stack gap="md" mt="lg">
              {formError ? (
                <Alert color="red" title={formError.title} variant="light">
                  {formError.message}
                </Alert>
              ) : null}

              <TextInput
                label="Email"
                placeholder="admin@scoodle.local"
                size="md"
                type="email"
                autoComplete="username"
                value={email}
                error={fieldErrors.email}
                onChange={(event) => setEmail(event.currentTarget.value)}
              />

              <PasswordInput
                label="Пароль"
                placeholder="Введите пароль"
                size="md"
                autoComplete="current-password"
                value={password}
                error={fieldErrors.password}
                onChange={(event) => setPassword(event.currentTarget.value)}
              />

              <Button fullWidth type="submit" size="md" loading={loginMutation.isPending}>
                Войти
              </Button>
            </Stack>
          </form>
        </Paper>
      </div>
    </section>
  );
}
