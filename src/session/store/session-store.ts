import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { decodeSessionUser } from '../lib/decode-session-user';
import type { SessionStatus, SessionUser } from '../model';

type SetSessionPayload = {
  accessToken: string;
  refreshToken?: string | null;
  user: SessionUser;
};

type SessionState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: SessionUser | null;
  status: SessionStatus;
  setSession(payload: SetSessionPayload): void;
  setTokens(tokens: { accessToken: string; refreshToken: string }): void;
  clearSession(): void;
};

type PersistedSessionState = Pick<SessionState, 'accessToken' | 'refreshToken' | 'user'>;

const restoreSessionState = (
  persistedState: unknown,
  currentState: SessionState,
): SessionState => {
  const persistedSession = persistedState as Partial<PersistedSessionState> | null;

  if (!persistedSession?.accessToken || !persistedSession.user) {
    return currentState;
  }

  const refreshToken = persistedSession.refreshToken ?? null;
  const decodedUser = decodeSessionUser(persistedSession.accessToken);

  if (!decodedUser) {
    // Access-токен истёк, но есть refresh — сессию не теряем: первый же запрос обновит токены.
    if (refreshToken) {
      return {
        ...currentState,
        accessToken: persistedSession.accessToken,
        refreshToken,
        user: persistedSession.user,
        status: 'authenticated',
      };
    }
    return currentState;
  }

  return {
    ...currentState,
    accessToken: persistedSession.accessToken,
    refreshToken,
    user: {
      ...decodedUser,
      email: decodedUser.email ?? persistedSession.user.email,
      name: decodedUser.name ?? persistedSession.user.name,
      roles: decodedUser.roles.length > 0 ? decodedUser.roles : persistedSession.user.roles,
    },
    status: 'authenticated',
  };
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      status: 'anonymous',
      setSession: ({ accessToken, refreshToken, user }) =>
        set({
          accessToken,
          refreshToken: refreshToken ?? null,
          user,
          status: 'authenticated',
        }),
      setTokens: ({ accessToken, refreshToken }) => set({ accessToken, refreshToken }),
      clearSession: () =>
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          status: 'anonymous',
        }),
    }),
    {
      name: 'platform-session',
      storage: createJSONStorage(() => localStorage),
      partialize: ({ accessToken, refreshToken, user }) => ({ accessToken, refreshToken, user }),
      merge: restoreSessionState,
    },
  ),
);
