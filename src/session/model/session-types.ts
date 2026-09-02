export type UserRole = 'Teacher' | 'Student' | 'Admin';

export type SessionStatus = 'anonymous' | 'authenticated';

export type SessionUser = {
  id: string;
  roles: UserRole[];
  name?: string;
  email?: string;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken?: string;
};
