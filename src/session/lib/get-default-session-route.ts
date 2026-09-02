import type { SessionUser } from '../model';

export function getDefaultSessionRoute(user: SessionUser | null): string {
  if (!user) {
    return '/login';
  }

  if (user.roles.includes('Admin')) {
    return '/admin';
  }

  if (user.roles.includes('Teacher')) {
    return '/teacher';
  }

  if (user.roles.includes('Student')) {
    return '/student';
  }

  return '/login';
}
