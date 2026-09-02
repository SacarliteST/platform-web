export function createAuthorizationHeader(accessToken: string | null | undefined): HeadersInit {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}
