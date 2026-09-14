import { beforeEach, describe, expect, it, vi } from 'vitest';
import { executeRuntimeFetch } from './create-runtime-fetch';
import { useSessionStore } from '../../session/store';
import { expiresIn, makeJwt } from '../../test/jwt';

const authedUser = { id: 'u-1', roles: ['Teacher'] as const, name: 'T', email: 't@e.edu' };

function respond(status: number, body: unknown = {}) {
  return {
    status,
    text: async () => JSON.stringify(body),
    headers: new Headers(),
  } as unknown as Response;
}

describe('executeRuntimeFetch — обработка 401 (TD-009)', () => {
  beforeEach(() => {
    useSessionStore.setState({ status: 'anonymous', accessToken: null, user: null });
  });

  it('401 при живом токене НЕ сбрасывает сессию', async () => {
    useSessionStore.setState({
      status: 'authenticated',
      accessToken: makeJwt({ sub: 'u-1', exp: expiresIn(600), role: 'Teacher' }),
      user: { ...authedUser, roles: [...authedUser.roles] },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(401, { detail: 'forbidden here' })));

    const res = await executeRuntimeFetch<{ status: number }>('', '/api/v1/admin/profiles');

    expect(res.status).toBe(401);
    expect(useSessionStore.getState().status).toBe('authenticated');
    expect(useSessionStore.getState().accessToken).not.toBeNull();
  });

  it('401 при просроченном токене сбрасывает сессию', async () => {
    useSessionStore.setState({
      status: 'authenticated',
      accessToken: makeJwt({ sub: 'u-1', exp: expiresIn(-5), role: 'Teacher' }),
      user: { ...authedUser, roles: [...authedUser.roles] },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(401)));

    await executeRuntimeFetch('', '/api/v1/courses');

    expect(useSessionStore.getState().status).toBe('anonymous');
    expect(useSessionStore.getState().accessToken).toBeNull();
  });

  it('успешный ответ парсит тело и статус', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(200, { id: 'x' })));
    const res = await executeRuntimeFetch<{ data: { id: string }; status: number }>('', '/api/v1/x');
    expect(res.status).toBe(200);
    expect(res.data).toEqual({ id: 'x' });
  });

  it('204 не пытается парсить пустое тело', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 204,
      text: async () => '',
      headers: new Headers(),
    } as unknown as Response));
    const res = await executeRuntimeFetch<{ data: unknown; status: number }>('', '/api/v1/x');
    expect(res.status).toBe(204);
    expect(res.data).toEqual({});
  });
});
