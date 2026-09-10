import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginPage } from './LoginPage';
import { useSessionStore } from '../store';
import { renderWithProviders } from '../../test/render';
import { expiresIn, makeJwt } from '../../test/jwt';

const mutateAsync = vi.fn();
let isPending = false;

vi.mock('../../api/identity/auth/auth', () => ({
  useLogin: () => ({ mutateAsync, isPending }),
}));

beforeEach(() => {
  mutateAsync.mockReset();
  isPending = false;
  useSessionStore.setState({ status: 'anonymous', accessToken: null, user: null });
});

describe('LoginPage (без react-hook-form/zod — TD-002 ит.4)', () => {
  it('невалидный email → ошибка поля, запрос не уходит', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.type(screen.getByLabelText('Пароль'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Войти' }));

    expect(await screen.findByText('Введите корректный email')).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('пустой пароль → ошибка поля', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText('Email'), 'admin@scoodle.local');
    await user.click(screen.getByRole('button', { name: 'Войти' }));

    expect(await screen.findByText('Введите пароль')).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('валидный ввод → вызывает login и заводит сессию по токену', async () => {
    const token = makeJwt({ sub: 'u-9', exp: expiresIn(3600), role: 'Teacher', name: 'Пётр' });
    mutateAsync.mockResolvedValue({ status: 200, data: { accessToken: token } });
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText('Email'), '  admin@scoodle.local  ');
    await user.type(screen.getByLabelText('Пароль'), 'Admin1234');
    await user.click(screen.getByRole('button', { name: 'Войти' }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({
      data: { email: 'admin@scoodle.local', password: 'Admin1234' },
    }));
    await waitFor(() => expect(useSessionStore.getState().status).toBe('authenticated'));
    expect(useSessionStore.getState().user?.id).toBe('u-9');
  });

  it('сетевой сбой login → алерт «IdentityService недоступен»', async () => {
    mutateAsync.mockRejectedValue(new Error('down'));
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText('Email'), 'admin@scoodle.local');
    await user.type(screen.getByLabelText('Пароль'), 'Admin1234');
    await user.click(screen.getByRole('button', { name: 'Войти' }));

    expect(await screen.findByText('IdentityService недоступен')).toBeInTheDocument();
    expect(useSessionStore.getState().status).toBe('anonymous');
  });

  it('401 → показывает сообщение об ошибке входа', async () => {
    mutateAsync.mockResolvedValue({ status: 401, data: { title: 'Не удалось войти', detail: 'bad creds' } });
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText('Email'), 'admin@scoodle.local');
    await user.type(screen.getByLabelText('Пароль'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Войти' }));

    expect(await screen.findByText('Не удалось войти')).toBeInTheDocument();
    expect(useSessionStore.getState().status).toBe('anonymous');
  });
});
