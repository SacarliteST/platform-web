import { beforeEach, describe, expect, it } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { screen } from '@testing-library/react';
import { RequireAuth } from './RequireAuth';
import { RequireRole } from './RequireRole';
import { useSessionStore } from '../store';
import { renderWithProviders } from '../../test/render';

const Protected = () => <div>секретная страница</div>;

beforeEach(() => {
  useSessionStore.setState({ status: 'anonymous', accessToken: null, user: null });
});

describe('RequireAuth', () => {
  it('анонимного пользователя уводит на /login', () => {
    renderWithProviders(
      <Routes>
        <Route path="/secret" element={<RequireAuth><Protected /></RequireAuth>} />
        <Route path="/login" element={<div>экран входа</div>} />
      </Routes>,
      { route: '/secret' },
    );
    expect(screen.getByText('экран входа')).toBeInTheDocument();
    expect(screen.queryByText('секретная страница')).not.toBeInTheDocument();
  });

  it('аутентифицированного пропускает', () => {
    useSessionStore.setState({ status: 'authenticated', accessToken: 't', user: { id: 'u', roles: ['Teacher'] } });
    renderWithProviders(
      <Routes>
        <Route path="/secret" element={<RequireAuth><Protected /></RequireAuth>} />
      </Routes>,
      { route: '/secret' },
    );
    expect(screen.getByText('секретная страница')).toBeInTheDocument();
  });
});

describe('RequireRole', () => {
  it('роль не в списке → «Нет доступа»', () => {
    useSessionStore.setState({ status: 'authenticated', accessToken: 't', user: { id: 'u', roles: ['Student'] } });
    renderWithProviders(<RequireRole allowedRoles={['Admin']}><Protected /></RequireRole>);
    expect(screen.getByText('Нет доступа')).toBeInTheDocument();
    expect(screen.queryByText('секретная страница')).not.toBeInTheDocument();
  });

  it('подходящая роль → контент', () => {
    useSessionStore.setState({ status: 'authenticated', accessToken: 't', user: { id: 'u', roles: ['Admin'] } });
    renderWithProviders(<RequireRole allowedRoles={['Admin', 'Teacher']}><Protected /></RequireRole>);
    expect(screen.getByText('секретная страница')).toBeInTheDocument();
  });

  it('без пользователя → «Нет доступа»', () => {
    renderWithProviders(<RequireRole allowedRoles={['Student']}><Protected /></RequireRole>);
    expect(screen.getByText('Нет доступа')).toBeInTheDocument();
  });
});
