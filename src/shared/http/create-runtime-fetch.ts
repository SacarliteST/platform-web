import { buildApiUrl } from './build-api-url';
import { refreshSession } from './refresh-session';
import { isAccessTokenActive } from '../../session/lib';
import { useSessionStore } from '../../session/store';

function handleUnauthorizedResponse() {
  const { status, accessToken, refreshToken, clearSession } = useSessionStore.getState();

  // Есть refresh-токен — судьбу сессии решает refreshSession (сбрасывает только при отказе сервера).
  if (refreshToken) {
    return;
  }

  // TD-009: сбрасываем сессию только если основной токен действительно истёк/невалиден.
  // Единичный 401 от прикладного эндпоинта (misconfig сервиса, запрет доступа) —
  // обычная ошибка запроса, валидную сессию не трогаем.
  if (status === 'authenticated' && !isAccessTokenActive(accessToken)) {
    clearSession();
  }
}

function readBearer(options?: RequestInit): string | null {
  const value = new Headers(options?.headers).get('Authorization');
  return value?.startsWith('Bearer ') ? value.slice('Bearer '.length) : null;
}

async function fetchWithRefresh(url: string, options?: RequestInit): Promise<Response> {
  const response = await fetch(url, options);

  const sentToken = readBearer(options);
  if (response.status !== 401 || !sentToken || !useSessionStore.getState().refreshToken) {
    return response;
  }

  // Другой запрос мог уже обновить токен — тогда просто повторяем с новым.
  const refreshed =
    useSessionStore.getState().accessToken !== sentToken || (await refreshSession(sentToken));
  if (!refreshed) {
    return response;
  }

  const headers = new Headers(options?.headers);
  headers.set('Authorization', `Bearer ${useSessionStore.getState().accessToken}`);
  return fetch(url, { ...options, headers });
}

export async function executeRuntimeFetch<TResponse>(
  baseUrl: string,
  path: string,
  options?: RequestInit,
): Promise<TResponse> {
  const response = await fetchWithRefresh(buildApiUrl(baseUrl, path), options);

  if (response.status === 401) {
    handleUnauthorizedResponse();
  }

  const responseBody = [204, 205, 304].includes(response.status) ? null : await response.text();
  const data = responseBody ? JSON.parse(responseBody) : {};

  return {
    data,
    status: response.status,
    headers: response.headers,
  } as TResponse;
}
