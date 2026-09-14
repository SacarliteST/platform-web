import { describe, expect, it } from 'vitest';
import { isAccessTokenActive } from './is-access-token-active';
import { expiresIn, makeJwt } from '../../test/jwt';

describe('isAccessTokenActive', () => {
  it('true для валидного не просроченного токена', () => {
    expect(isAccessTokenActive(makeJwt({ sub: 'u', exp: expiresIn(600), role: 'Student' }))).toBe(true);
  });

  it('false для просроченного токена', () => {
    expect(isAccessTokenActive(makeJwt({ sub: 'u', exp: expiresIn(-10), role: 'Student' }))).toBe(false);
  });

  it('false для null / пустой строки / мусора', () => {
    expect(isAccessTokenActive(null)).toBe(false);
    expect(isAccessTokenActive(undefined)).toBe(false);
    expect(isAccessTokenActive('')).toBe(false);
    expect(isAccessTokenActive('garbage')).toBe(false);
  });
});
