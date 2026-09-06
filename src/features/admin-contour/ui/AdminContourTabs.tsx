import { NavLink, useLocation } from 'react-router-dom';
import './AdminContourTabs.css';

const adminTabs = [
  { value: 'overview', label: 'Обзор', to: '/admin' },
  { value: 'users', label: 'Пользователи', to: '/admin/users' },
  { value: 'events', label: 'Аудит', to: '/admin/events' },
  { value: 'profiles', label: 'Учебные профили', to: '/admin/profiles' },
  { value: 'modules', label: 'Модули', to: '/admin/modules' },
  { value: 'settings', label: 'Настройки', to: '/admin/settings' },
] as const;

function getActiveTab(pathname: string) {
  if (pathname.startsWith('/admin/users')) {
    return 'users';
  }

  if (pathname.startsWith('/admin/events')) {
    return 'events';
  }

  if (pathname.startsWith('/admin/profiles')) {
    return 'profiles';
  }

  if (pathname.startsWith('/admin/modules')) {
    return 'modules';
  }

  if (pathname.startsWith('/admin/settings')) {
    return 'settings';
  }

  return 'overview';
}

export function AdminContourTabs() {
  const location = useLocation();
  const activeTab = getActiveTab(location.pathname);

  return (
    <nav className="admin-contour-tabs" aria-label="Навигация администратора">
      {adminTabs.map((tab) => (
        <NavLink
          key={tab.value}
          to={tab.to}
          className={
            tab.value === activeTab
              ? 'admin-contour-tabs__item admin-contour-tabs__item--active'
              : 'admin-contour-tabs__item'
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
