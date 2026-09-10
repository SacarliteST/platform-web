import { describe, expect, it } from 'vitest';
import { formatProtocolAnswer } from './model';

describe('formatProtocolAnswer (TD-010, временная мера)', () => {
  it('снимает JSON-массив → список через запятую', () => {
    expect(formatProtocolAnswer('["opt-a","opt-b"]')).toBe('opt-a, opt-b');
    expect(formatProtocolAnswer('["opt-mtlufh5q-15"]')).toBe('opt-mtlufh5q-15');
  });

  it('bare id SingleChoice остаётся как есть', () => {
    expect(formatProtocolAnswer('opt-mtludrcw-5')).toBe('opt-mtludrcw-5');
  });

  it('JSON-строка ShortAnswer разворачивается без кавычек', () => {
    expect(formatProtocolAnswer('"свободный ответ"')).toBe('свободный ответ');
  });

  it('пары Match → k → v; …', () => {
    expect(formatProtocolAnswer('{"left-1":"right-2","left-3":"right-4"}')).toBe(
      'left-1 → right-2; left-3 → right-4',
    );
  });

  it('скаляр/число', () => {
    expect(formatProtocolAnswer('42')).toBe('42');
  });

  it('пустое / невалидный JSON → как есть', () => {
    expect(formatProtocolAnswer('')).toBe('');
    expect(formatProtocolAnswer('   ')).toBe('');
    expect(formatProtocolAnswer('просто текст, не json')).toBe('просто текст, не json');
  });
});
