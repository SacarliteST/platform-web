import { getRuntimeConfig } from '../../app/config/runtime-config-registry';
import { useSessionStore } from '../../session/store';
import { createAuthorizationHeader } from './auth-header';
import { executeRuntimeFetch } from './create-runtime-fetch';
import { ensureFreshAccessToken } from './refresh-session';

export async function educationFetch<TResponse>(
  url: string,
  options?: RequestInit,
): Promise<TResponse> {
  const { educationApiUrl } = getRuntimeConfig();
  await ensureFreshAccessToken();
  const { accessToken } = useSessionStore.getState();

  return executeRuntimeFetch<TResponse>(educationApiUrl, url, {
    ...options,
    headers: {
      ...createAuthorizationHeader(accessToken),
      ...options?.headers,
    },
  });
}
