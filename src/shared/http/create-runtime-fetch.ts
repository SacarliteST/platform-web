import { buildApiUrl } from './build-api-url';
import { isAccessTokenActive } from '../../session/lib';
import { useSessionStore } from '../../session/store';

function handleUnauthorizedResponse() {
  const { status, accessToken, clearSession } = useSessionStore.getState();

  // TD-009: сбрасываем сессию только если основной токен действительно истёк/невалиден.
  // Единичный 401 от прикладного эндпоинта (misconfig сервиса, запрет доступа) —
  // обычная ошибка запроса, валидную сессию не трогаем.
  if (status === 'authenticated' && !isAccessTokenActive(accessToken)) {
    clearSession();
  }
}

export async function executeRuntimeFetch<TResponse>(
  baseUrl: string,
  path: string,
  options?: RequestInit,
): Promise<TResponse> {
  const response = await fetch(buildApiUrl(baseUrl, path), options);

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
