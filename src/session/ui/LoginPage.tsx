import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Paper, PasswordInput, Stack, TextInput, Title } from '@mantine/core';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
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

const loginSchema = z.object({
  email: z.string().email('Введите корректный email'),
  password: z.string().min(1, 'Введите пароль'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

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
  const [formError, setFormError] = useState<IdentityApiProblemPresentation | null>(null);
  const loginMutation = useLogin();

  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    const response = await loginMutation
      .mutateAsync({
        data: values,
      })
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
  });

  return (
    <section className="login-page">
      <div className="login-page__inner">
        <Paper className="login-page__card" p="xl" radius="sm" shadow="sm" withBorder>
          <Title className="login-page__title" order={2} size="h3" ta="center">
            Вход в систему
          </Title>

          <form onSubmit={onSubmit}>
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
                error={errors.email?.message}
                {...register('email')}
              />

              <PasswordInput
                label="Пароль"
                placeholder="Введите пароль"
                size="md"
                error={errors.password?.message}
                {...register('password')}
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
