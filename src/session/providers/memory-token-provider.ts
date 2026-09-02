import type { AuthTokens, TokenProvider } from '../model';

export function createMemoryTokenProvider(initialTokens?: AuthTokens): TokenProvider {
  let tokens: AuthTokens | null = initialTokens ?? null;

  return {
    getAccessToken: () => tokens?.accessToken ?? null,
    getRefreshToken: () => tokens?.refreshToken ?? null,
    setTokens: (nextTokens) => {
      tokens = nextTokens;
    },
    clear: () => {
      tokens = null;
    },
  };
}
