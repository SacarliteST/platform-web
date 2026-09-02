import type { PropsWithChildren, ReactNode } from 'react';
import { EmptyState, Page } from '../../shared/ui';
import type { UserRole } from '../model';
import { useSessionStore } from '../store';

type RequireRoleProps = PropsWithChildren<{
  allowedRoles: UserRole[];
  fallback?: ReactNode;
}>;

function hasAllowedRole(userRoles: UserRole[], allowedRoles: UserRole[]): boolean {
  return userRoles.some((role) => allowedRoles.includes(role));
}

export function RequireRole({ allowedRoles, children, fallback }: RequireRoleProps) {
  const user = useSessionStore((state) => state.user);

  if (!user || !hasAllowedRole(user.roles, allowedRoles)) {
    return fallback ?? <AccessDeniedPage />;
  }

  return children;
}

export function AccessDeniedPage() {
  return (
    <Page>
      <EmptyState title="Нет доступа" description="У вашей роли нет прав для просмотра этого раздела." />
    </Page>
  );
}
