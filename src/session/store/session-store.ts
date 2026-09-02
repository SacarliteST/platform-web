import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { decodeSessionUser } from '../lib/decode-session-user';
import type { SessionStatus, SessionUser } from '../model';

type SetSessionPayload = {
  accessToken: string;
  user: SessionUser;
};

type SessionState = {
  accessToken: string | null;
  user: SessionUser | null;
  status: SessionStatus;
  setSession(payload: SetSessionPayload): void;
  clearSession(): void;
};

type PersistedSessionState = Pick<SessionState, 'accessToken' | 'user'>;

const restoreSessionState = (
  persistedState: unknown,
  currentState: SessionState,
): SessionState => {
  const persistedSession = persistedState as Partial<PersistedSessionState> | null;

  if (!persistedSession?.accessToken || !persistedSession.user) {
    return currentState;
  }

  const decodedUser = decodeSessionUser(persistedSession.accessToken);

  if (!decodedUser) {
    return currentState;
  }

  return {
    ...currentState,
    accessToken: persistedSession.accessToken,
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
      user: null,
      status: 'anonymous',
      setSession: ({ accessToken, user }) =>
        set({
          accessToken,
          user,
          status: 'authenticated',
        }),
      clearSession: () =>
        set({
          accessToken: null,
          user: null,
          status: 'anonymous',
        }),
    }),
    {
      name: 'platform-session',
      storage: createJSONStorage(() => localStorage),
      partialize: ({ accessToken, user }) => ({ accessToken, user }),
      merge: restoreSessionState,
    },
  ),
);
