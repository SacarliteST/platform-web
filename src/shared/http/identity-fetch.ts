import { getRuntimeConfig } from '../../app/config/runtime-config-registry';
import { useSessionStore } from '../../session/store';
import { createAuthorizationHeader } from './auth-header';
import { executeRuntimeFetch } from './create-runtime-fetch';

export function identityFetch<TResponse>(
  url: string,
  options?: RequestInit,
): Promise<TResponse> {
  const { identityApiUrl } = getRuntimeConfig();
  const { accessToken } = useSessionStore.getState();

  if (!identityApiUrl) {
    throw new Error('identityApiUrl is not configured');
  }

  return executeRuntimeFetch<TResponse>(identityApiUrl, url, {
    ...options,
    headers: {
      ...createAuthorizationHeader(accessToken),
      ...options?.headers,
    },
  });
}
