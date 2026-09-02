import { getRuntimeConfig } from '../../app/config/runtime-config-registry';
import { useSessionStore } from '../../session/store';
import { createAuthorizationHeader } from './auth-header';
import { executeRuntimeFetch } from './create-runtime-fetch';

export function educationFetch<TResponse>(
  url: string,
  options?: RequestInit,
): Promise<TResponse> {
  const { educationApiUrl } = getRuntimeConfig();
  const { accessToken } = useSessionStore.getState();

  return executeRuntimeFetch<TResponse>(educationApiUrl, url, {
    ...options,
    headers: {
      ...createAuthorizationHeader(accessToken),
      ...options?.headers,
    },
  });
}
