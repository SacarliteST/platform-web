import type { TokenResponse } from '../../api/identity/model';
import type { SessionUser, UserRole } from '../model';
import { decodeSessionUser } from './decode-session-user';

const knownRoles = new Set<UserRole>(['Teacher', 'Student', 'Admin']);

function normalizeRoles(roles?: string[]): UserRole[] {
  return (roles ?? []).filter((role): role is UserRole => knownRoles.has(role as UserRole));
}

export function createSessionUserFromTokenResponse(response: TokenResponse): SessionUser | null {
  if (response.accessToken) {
    const userFromToken = decodeSessionUser(response.accessToken);

    if (userFromToken) {
      const responseRoles = normalizeRoles(response.roles);

      return {
        ...userFromToken,
        email: userFromToken.email ?? response.email,
        roles: userFromToken.roles.length > 0 ? userFromToken.roles : responseRoles,
      };
    }
  }

  if (!response.userId) {
    return null;
  }

  return {
    id: response.userId,
    email: response.email,
    roles: normalizeRoles(response.roles),
  };
}
