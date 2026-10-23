import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegisterPage, validateRegistration } from './RegisterPage';
import { useSessionStore } from '../../session';
import { renderWithProviders } from '../../test/render';
import { expiresIn, makeJwt } from '../../test/jwt';

const mutateAsync = vi.fn();

vi.mock('../../api/identity/auth/auth', () => ({
  useRegister: () => ({ mutateAsync, isPending: false }),
}));

beforeEach(() => {
  mutateAsync.mockReset();
  useSessionStore.setState({ status: 'anonymous', accessToken: null, user: null });
});

async function fillValid(user: ReturnType<typeof userEvent.setup>, overrides: { repeat?: string; consent?: boolean } = {}) {
  await user.type(screen.getByLabelText(/^Фамилия/), 'Петров');
  await user.type(screen.getByLabelText(/^Имя/), 'Иван');
  await user.type(screen.getByLabelText(/^Email/), 'ivan@scoodle.local');
  await user.type(screen.getByLabelText(/^Пароль/), 'Password1');
  await user.type(screen.getByLabelText(/^Повторите пароль/), overrides.repeat ?? 'Password1');
  if (overrides.consent !== false) {
    await user.click(screen.getByRole('checkbox'));
  }
  await user.click(screen.getByRole('button', { name: 'Зарегистрироваться' }));
}

describe('validateRegistration', () => {
  const valid = {
    lastName: 'Петров',
    firstName: 'Иван',
    middleName: '',
    email: 'ivan@scoodle.local',
    password: 'Password1',
    passwordRepeat: 'Password1',
    inviteCode: '',
    consent: true,
  };

  it('корректная форма — без ошибок', () => {
    expect(validateRegistration(valid)).toEqual({});
  });

  it('требует ФИО, email, сложный пароль, совпадение и согласие', () => {
    const errors = validateRegistration({
      ...valid,
      lastName: ' ',
      firstName: '',
      email: 'x',
      password: 'password',
      passwordRepeat: 'other',
      consent: false,
    });

    expect(Object.keys(errors).sort()).toEqual(
      ['consent', 'email', 'firstName', 'lastName', 'password', 'passwordRepeat'].sort(),
    );
  });

  it('короткий пароль отклоняется', () => {
    expect(validateRegistration({ ...valid, password: 'Pa1', passwordRepeat: 'Pa1' }).password).toBeDefined();
  });
});

describe('RegisterPage', () => {
  it('пароли не совпадают → ошибка, запрос не уходит', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />);

    await fillValid(user, { repeat: 'Different1' });

    expect(await screen.findByText('Пароли не совпадают')).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('без согласия на обработку данных запрос не уходит', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />);

    await fillValid(user, { consent: false });

    expect(await screen.findByText('Нужно согласие на обработку персональных данных')).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('202 → «Заявка отправлена», сессии нет', async () => {
    mutateAsync.mockResolvedValue({
      status: 202,
      data: { status: 'Pending', email: 'ivan@scoodle.local', message: 'ok' },
    });
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />);

    await fillValid(user);

    expect(await screen.findByText('Заявка отправлена')).toBeInTheDocument();
    expect(useSessionStore.getState().status).not.toBe('authenticated');
    expect(mutateAsync).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'ivan@scoodle.local',
        lastName: 'Петров',
        firstName: 'Иван',
        middleName: null,
        inviteCode: null,
      }),
    });
  });

  it('201 (код приглашения) → заводит сессию', async () => {
    const token = makeJwt({ sub: 'u-5', exp: expiresIn(3600), role: 'Student', name: 'Иван Петров' });
    mutateAsync.mockResolvedValue({ status: 201, data: { accessToken: token, refreshToken: 'r' } });
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />);

    await user.type(screen.getByLabelText(/^Код приглашения/), ' ABCD-2345 ');
    await fillValid(user);

    await waitFor(() => expect(useSessionStore.getState().status).toBe('authenticated'));
    expect(mutateAsync).toHaveBeenCalledWith({ data: expect.objectContaining({ inviteCode: 'ABCD-2345' }) });
  });

  it('409/422 → показывает сообщение сервера', async () => {
    mutateAsync.mockResolvedValue({
      status: 422,
      data: { title: 'Ошибка проверки данных', errors: { '': ['Код приглашения недействителен, истёк или уже использован.'] } },
    });
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />);

    await fillValid(user);

    expect(await screen.findByText(/Код приглашения недействителен/)).toBeInTheDocument();
  });
});
