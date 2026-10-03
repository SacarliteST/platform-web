import { Badge, Button, Group, Text } from '@mantine/core';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { logout } from '../../api/identity/auth/auth';
import logoMark from '../../assets/branding/logo-mark.png';
import { useSessionStore } from '../../session';
import './AppLayout.css';

function canSeeAdmin(roles: string[]): boolean {
  return roles.includes('Admin');
}

function canSeeTeacher(roles: string[]): boolean {
  return roles.includes('Teacher');
}

function canSeeStudent(roles: string[]): boolean {
  return roles.includes('Student');
}

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const status = useSessionStore((state) => state.status);
  const user = useSessionStore((state) => state.user);
  const clearSession = useSessionStore((state) => state.clearSession);
  const userRoles = user?.roles ?? [];
  const navigationItems = [
    { to: '/admin', label: 'Администратор', visible: canSeeAdmin(userRoles) },
    { to: '/teacher', label: 'Преподаватель', visible: canSeeTeacher(userRoles) },
    { to: '/student', label: 'Студент', visible: canSeeStudent(userRoles) },
    { to: '/help', label: 'Справка', visible: true },
  ];
  const isLoginPage = location.pathname === '/login';

  const handleLogout = () => {
    const { refreshToken } = useSessionStore.getState();
    clearSession();
    if (refreshToken) {
      // Отзываем refresh-токен на сервере; сбой сети выходу не мешает.
      void logout({ refreshToken }).catch(() => undefined);
    }
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <div className="app-shell__header-inner">
          <Group gap="sm" wrap="nowrap">
            <img className="app-shell__logo" src={logoMark} alt="Scoodle" width={32} height={32} />
            <div>
              <h1 className="app-shell__title">Scoodle</h1>
              <Text c="gray.4" size="xs">
                Платформа обучения
              </Text>
            </div>
            {status === 'authenticated' && user ? (
              <Text className="app-shell__user-name" c="gray.4" size="sm">
                {user.name ?? user.email ?? user.id}
              </Text>
            ) : null}
          </Group>
          {status === 'authenticated' ? (
            <Group gap={6}>
              {userRoles.map((role) => (
                <Badge color="blue" key={role} radius="sm" variant="light">
                  {role}
                </Badge>
              ))}
            </Group>
          ) : null}
        </div>
        <div className="app-shell__nav-row">
          <nav className="app-shell__nav" aria-label="Primary navigation">
            {navigationItems
              .filter((item) => item.visible)
              .map((item) => (
                <NavLink key={`${item.label}:${item.to}`} to={item.to} className="app-shell__nav-link">
                  {item.label}
                </NavLink>
              ))}
          </nav>
          {status === 'authenticated' ? (
            <Button color="gray" size="xs" variant="outline" onClick={handleLogout}>
              Выйти
            </Button>
          ) : !isLoginPage ? (
            <Button color="blue" size="xs" variant="filled" onClick={() => navigate('/login')}>
              Войти
            </Button>
          ) : null}
        </div>
      </header>
      <main className="app-shell__main">
        <Outlet />
      </main>
    </div>
  );
}
