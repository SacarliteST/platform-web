import { buildApiUrl } from './build-api-url';
import { useSessionStore } from '../../session/store';

function handleUnauthorizedResponse() {
  const { status, clearSession } = useSessionStore.getState();

  if (status === 'authenticated') {
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
