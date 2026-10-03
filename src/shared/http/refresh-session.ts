import { jwtDecode } from 'jwt-decode';
import type { TokenResponse } from '../../api/identity/model';
import { getRuntimeConfig } from '../../app/config/runtime-config-registry';
import { createSessionUserFromTokenResponse } from '../../session/lib';
import { useSessionStore } from '../../session/store';
import { buildApiUrl } from './build-api-url';

// Путь совпадает с getRefreshUrl() из сгенерированного клиента; сам клиент не импортируем:
// он тянет identityFetch → create-runtime-fetch → этот модуль (цикл).
const REFRESH_PATH = '/api/v1/auth/refresh';
const LOCK_NAME = 'platform-web-refresh-session';
const EXPIRY_LEEWAY_SECONDS = 30;

let inFlight: Promise<boolean> | null = null;

export function accessTokenExpiresWithin(
  accessToken: string | null | undefined,
  seconds: number,
): boolean {
  if (!accessToken) {
    return true;
  }
  try {
    const { exp } = jwtDecode<{ exp?: number }>(accessToken);
    return exp !== undefined && exp * 1000 - Date.now() <= seconds * 1000;
  } catch {
    return true;
  }
}

async function performRefresh(staleAccessToken: string | null): Promise<boolean> {
  // Refresh-токен одноразовый (сервер отзывает все сессии при повторном использовании),
  // а localStorage общий для вкладок: под локом сверяемся с тем, что уже записала другая вкладка.
  await useSessionStore.persist.rehydrate();

  const state = useSessionStore.getState();
  if (
    state.status === 'authenticated' &&
    state.accessToken !== staleAccessToken &&
    !accessTokenExpiresWithin(state.accessToken, EXPIRY_LEEWAY_SECONDS)
  ) {
    return true;
  }
  if (!state.refreshToken) {
    return false;
  }

  const { identityApiUrl } = getRuntimeConfig();
  if (!identityApiUrl) {
    return false;
  }
  let response: Response;
  try {
    response = await fetch(buildApiUrl(identityApiUrl, REFRESH_PATH), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: state.refreshToken }),
    });
  } catch {
    // Сеть недоступна — refresh-токен цел, сессию не трогаем.
    return false;
  }

  if (response.status === 401 || response.status === 422) {
    state.clearSession();
    return false;
  }
  if (!response.ok) {
    return false;
  }

  const body = (await response.json().catch(() => null)) as TokenResponse | null;
  if (!body?.accessToken || !body.refreshToken) {
    return false;
  }

  const user = createSessionUserFromTokenResponse(body);
  if (user) {
    state.setSession({ accessToken: body.accessToken, refreshToken: body.refreshToken, user });
  } else {
    state.setTokens({ accessToken: body.accessToken, refreshToken: body.refreshToken });
  }
  return true;
}

/** Обновляет токены по refresh-токену. Параллельные вызовы делят один запрос; между вкладками — Web Locks. */
export function refreshSession(staleAccessToken?: string | null): Promise<boolean> {
  if (!inFlight) {
    const stale = staleAccessToken === undefined ? useSessionStore.getState().accessToken : staleAccessToken;
    const run = async (): Promise<boolean> =>
      navigator.locks
        ? await navigator.locks.request(LOCK_NAME, () => performRefresh(stale))
        : await performRefresh(stale);
    inFlight = run().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

/** Перед запросом: если access-токен истёк или вот-вот истечёт — тихо обновляем его. */
export async function ensureFreshAccessToken(): Promise<void> {
  const { status, accessToken, refreshToken } = useSessionStore.getState();
  if (status === 'authenticated' && refreshToken && accessTokenExpiresWithin(accessToken, EXPIRY_LEEWAY_SECONDS)) {
    await refreshSession();
  }
}
