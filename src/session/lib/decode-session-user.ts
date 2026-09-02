import { jwtDecode } from 'jwt-decode';
import type { SessionUser, UserRole } from '../model';

type JwtRoleClaim = UserRole | UserRole[] | string | string[] | undefined;

type SessionJwtPayload = {
  sub?: string;
  exp?: number;
  role?: JwtRoleClaim;
  roles?: JwtRoleClaim;
  name?: string;
  email?: string;
  unique_name?: string;
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'?: string;
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'?: string;
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'?: string;
  'http://schemas.microsoft.com/ws/2008/06/identity/claims/role'?: JwtRoleClaim;
};

const knownRoles = new Set<UserRole>(['Teacher', 'Student', 'Admin']);

function normalizeRoles(roleClaim: JwtRoleClaim): UserRole[] {
  const values = Array.isArray(roleClaim) ? roleClaim : roleClaim ? [roleClaim] : [];

  return values.filter((role): role is UserRole => knownRoles.has(role as UserRole));
}

function isExpired(expiresAt?: number): boolean {
  if (!expiresAt) {
    return false;
  }

  return expiresAt * 1000 <= Date.now();
}

export function decodeSessionUser(accessToken: string): SessionUser | null {
  try {
    const payload = jwtDecode<SessionJwtPayload>(accessToken);

    if (isExpired(payload.exp)) {
      return null;
    }

    const id =
      payload.sub ??
      payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'];
    const roles = normalizeRoles(
      payload.role ??
        payload.roles ??
        payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'],
    );

    if (!id) {
      return null;
    }

    return {
      id,
      roles,
      name:
        payload.name ??
        payload.unique_name ??
        payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'],
      email:
        payload.email ??
        payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'],
    };
  } catch {
    return null;
  }
}
