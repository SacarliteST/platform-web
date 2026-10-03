import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setRuntimeConfig } from '../../app/config/runtime-config-registry';
import { useSessionStore } from '../../session/store';
import { expiresIn, makeJwt } from '../../test/jwt';
import { executeRuntimeFetch } from './create-runtime-fetch';
import { ensureFreshAccessToken, refreshSession } from './refresh-session';

const user = { id: 'u-1', roles: ['Teacher' as const], name: 'T', email: 't@e.edu' };
const expiredJwt = () => makeJwt({ sub: 'u-1', exp: expiresIn(-5), role: 'Teacher' });
const freshJwt = () => makeJwt({ sub: 'u-1', exp: expiresIn(600), role: 'Teacher' });

function json(status: number, body: unknown = {}) {
  return { status, ok: status >= 200 && status < 300, text: async () => JSON.stringify(body), json: async () => body, headers: new Headers() } as unknown as Response;
}

const tokenResponse = (accessToken: string) => ({
  accessToken, accessExpiresAt: '', refreshToken: 'r-2', refreshExpiresAt: '', userId: 'u-1', email: 't@e.edu', roles: ['Teacher'],
});

function signIn(accessToken: string, refreshToken: string | null = 'r-1') {
  useSessionStore.setState({ status: 'authenticated', accessToken, refreshToken, user: { ...user, roles: [...user.roles] } });
}

describe('refresh-токен: тихое обновление сессии', () => {
  beforeEach(() => {
    setRuntimeConfig({ educationApiUrl: 'http://edu', identityApiUrl: 'http://id', basePath: '/' });
    useSessionStore.setState({ status: 'anonymous', accessToken: null, refreshToken: null, user: null });
  });

  it('refreshSession ротирует токены и сохраняет их в store', async () => {
    signIn(expiredJwt());
    const fresh = freshJwt();
    const fetchMock = vi.fn().mockResolvedValue(json(200, tokenResponse(fresh)));
    vi.stubGlobal('fetch', fetchMock);

    await expect(refreshSession()).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledWith('http://id/api/v1/auth/refresh', expect.objectContaining({ method: 'POST', body: JSON.stringify({ refreshToken: 'r-1' }) }));
    expect(useSessionStore.getState()).toMatchObject({ accessToken: fresh, refreshToken: 'r-2', status: 'authenticated' });
  });

  it('параллельные вызовы делят один запрос (refresh одноразовый)', async () => {
    signIn(expiredJwt());
    const fetchMock = vi.fn().mockResolvedValue(json(200, tokenResponse(freshJwt())));
    vi.stubGlobal('fetch', fetchMock);

    await Promise.all([refreshSession(), refreshSession(), refreshSession()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('отказ сервера (401) завершает сессию', async () => {
    signIn(expiredJwt());
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(401)));

    await expect(refreshSession()).resolves.toBe(false);

    expect(useSessionStore.getState()).toMatchObject({ status: 'anonymous', accessToken: null, refreshToken: null });
  });

  it('сбой сети НЕ завершает сессию — refresh-токен цел', async () => {
    signIn(expiredJwt());
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network')));

    await expect(refreshSession()).resolves.toBe(false);

    expect(useSessionStore.getState()).toMatchObject({ status: 'authenticated', refreshToken: 'r-1' });
  });

  it('ensureFreshAccessToken: живой токен не трогает, истекающий обновляет', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, tokenResponse(freshJwt())));
    vi.stubGlobal('fetch', fetchMock);

    signIn(freshJwt());
    await ensureFreshAccessToken();
    expect(fetchMock).not.toHaveBeenCalled();

    signIn(makeJwt({ sub: 'u-1', exp: expiresIn(10), role: 'Teacher' }));
    await ensureFreshAccessToken();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('401 на запрос → refresh → повтор запроса с новым токеном', async () => {
    const stale = freshJwt();
    const fresh = makeJwt({ sub: 'u-1', exp: expiresIn(900), role: 'Teacher' });
    signIn(stale);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(401))
      .mockResolvedValueOnce(json(200, tokenResponse(fresh)))
      .mockResolvedValueOnce(json(200, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await executeRuntimeFetch<{ status: number; data: unknown }>('http://edu', '/api/v1/courses', {
      headers: { Authorization: `Bearer ${stale}` },
    });

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const retryHeaders = new Headers((fetchMock.mock.calls[2][1] as RequestInit).headers);
    expect(retryHeaders.get('Authorization')).toBe(`Bearer ${fresh}`);
  });

  it('401 без refresh-токена ведёт себя как раньше (TD-009)', async () => {
    signIn(expiredJwt(), null);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(401)));

    await executeRuntimeFetch('http://edu', '/api/v1/courses', { headers: { Authorization: `Bearer ${expiredJwt()}` } });

    expect(useSessionStore.getState().status).toBe('anonymous');
  });

  it('после перезагрузки с истёкшим access, но живым refresh сессия восстанавливается', async () => {
    window.localStorage.setItem('platform-session', JSON.stringify({
      state: { accessToken: expiredJwt(), refreshToken: 'r-1', user },
      version: 0,
    }));

    await useSessionStore.persist.rehydrate();

    expect(useSessionStore.getState()).toMatchObject({ status: 'authenticated', refreshToken: 'r-1' });
  });
});
