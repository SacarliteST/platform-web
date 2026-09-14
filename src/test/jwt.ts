/** Собирает JWT-подобную строку для тестов декодера (подпись не проверяется). */
export function makeJwt(payload: Record<string, unknown>): string {
  const b64 = (obj: unknown) => Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64(payload)}.sig`;
}

/** exp через N секунд от now (в секундах, как в JWT). */
export const expiresIn = (seconds: number) => Math.floor(Date.now() / 1000) + seconds;
