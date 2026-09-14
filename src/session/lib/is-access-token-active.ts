import { decodeSessionUser } from './decode-session-user';

/**
 * Токен считается активным, если он есть и `decodeSessionUser` его принимает
 * (не истёк по `exp`, корректно декодируется). Используется, чтобы отличать
 * «сессия действительно закончилась» от «конкретный запрос вернул 401».
 */
export function isAccessTokenActive(accessToken: string | null | undefined): boolean {
  return Boolean(accessToken) && decodeSessionUser(accessToken as string) !== null;
}
