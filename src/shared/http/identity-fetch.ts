import { getRuntimeConfig } from '../../app/config/runtime-config-registry';
import { useSessionStore } from '../../session/store';
import { createAuthorizationHeader } from './auth-header';
import { executeRuntimeFetch } from './create-runtime-fetch';
import { ensureFreshAccessToken } from './refresh-session';

export async function identityFetch<TResponse>(
  url: string,
  options?: RequestInit,
): Promise<TResponse> {
  const { identityApiUrl } = getRuntimeConfig();
  if (!identityApiUrl) {
    throw new Error('identityApiUrl is not configured');
  }

  await ensureFreshAccessToken();
  const { accessToken } = useSessionStore.getState();

  return executeRuntimeFetch<TResponse>(identityApiUrl, url, {
    ...options,
    headers: {
      ...createAuthorizationHeader(accessToken),
      ...options?.headers,
    },
  });
}
