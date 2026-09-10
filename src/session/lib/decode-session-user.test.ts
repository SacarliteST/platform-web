import { describe, expect, it } from 'vitest';
import { decodeSessionUser } from './decode-session-user';
import { expiresIn, makeJwt } from '../../test/jwt';

const MS_ROLE = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';
const MS_NAMEID = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier';

describe('decodeSessionUser', () => {
  it('читает sub, роли, имя и email из простых claim-ов', () => {
    const token = makeJwt({
      sub: 'u-1',
      exp: expiresIn(3600),
      role: 'Teacher',
      name: 'Пётр',
      email: 'p@example.edu',
    });
    expect(decodeSessionUser(token)).toEqual({
      id: 'u-1',
      roles: ['Teacher'],
      name: 'Пётр',
      email: 'p@example.edu',
    });
  });

  it('нормализует массив ролей и отбрасывает неизвестные', () => {
    const token = makeJwt({ sub: 'u', exp: expiresIn(60), role: ['Student', 'Ghost', 'Admin'] });
    expect(decodeSessionUser(token)?.roles).toEqual(['Student', 'Admin']);
  });

  it('поддерживает ws-schema claim-ы (роль и nameidentifier)', () => {
    const token = makeJwt({ [MS_NAMEID]: 'legacy-id', exp: expiresIn(60), [MS_ROLE]: 'Admin' });
    const user = decodeSessionUser(token);
    expect(user?.id).toBe('legacy-id');
    expect(user?.roles).toEqual(['Admin']);
  });

  it('возвращает null для просроченного токена', () => {
    expect(decodeSessionUser(makeJwt({ sub: 'u', exp: expiresIn(-1), role: 'Admin' }))).toBeNull();
  });

  it('возвращает null для мусора и токена без субъекта', () => {
    expect(decodeSessionUser('not-a-jwt')).toBeNull();
    expect(decodeSessionUser(makeJwt({ exp: expiresIn(60), role: 'Admin' }))).toBeNull();
  });

  it('токен без exp считается валидным', () => {
    expect(decodeSessionUser(makeJwt({ sub: 'u', role: 'Student' }))?.id).toBe('u');
  });
});
