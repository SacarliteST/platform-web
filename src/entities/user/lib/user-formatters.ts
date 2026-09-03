import { UserRole } from '../../../api/identity/model';
import type { AppUserRole, AppUserStatus } from '../model';

const roleLabels: Record<AppUserRole, string> = {
  [UserRole.Admin]: 'Администратор',
  [UserRole.Teacher]: 'Преподаватель',
  [UserRole.Student]: 'Студент',
};

const statusLabels: Record<string, string> = {
  Active: 'Активен',
  Blocked: 'Заблокирован',
};

export const formatUserRole = (role: string): string => {
  return roleLabels[role as AppUserRole] ?? role;
};

export const formatUserRoles = (roles: string[] = []): string => {
  return roles.length > 0 ? roles.map(formatUserRole).join(', ') : 'Без ролей';
};

export const formatUserStatus = (status: AppUserStatus): string => {
  return statusLabels[status] ?? status;
};

export const getUserStatusTone = (status: AppUserStatus): 'green' | 'red' | 'gray' => {
  if (status === 'Active') {
    return 'green';
  }

  if (status === 'Blocked') {
    return 'red';
  }

  return 'gray';
};

export const formatUserDateTime = (value?: string | null): string => {
  if (!value) {
    return 'Не указано';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
};

export const getUserDisplayName = (user: {
  displayName?: string | null;
  email: string;
}): string => {
  return user.displayName?.trim() || user.email;
};

export const getUserInitials = (user: {
  displayName?: string | null;
  email: string;
}): string => {
  const displayName = getUserDisplayName(user);
  const parts = displayName.includes('@')
    ? displayName.split('@')[0].split(/[._-]/)
    : displayName.split(' ');

  return parts
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
};
