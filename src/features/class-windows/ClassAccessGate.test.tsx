import { describe, expect, it } from 'vitest';
import { formatRemaining } from './ClassAccessGate';

describe('formatRemaining', () => {
  it('минуты и секунды', () => {
    expect(formatRemaining(65_000)).toBe('01:05');
  });

  it('часы', () => {
    expect(formatRemaining(3_725_000)).toBe('1:02:05');
  });

  it('не уходит в минус', () => {
    expect(formatRemaining(-5_000)).toBe('00:00');
  });
});
