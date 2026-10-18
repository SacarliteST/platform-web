import { describe, expect, it } from 'vitest';
import { compareNullable, formatDateTime, formatDuration, matchesAllWords } from './table';

describe('compareNullable', () => {
  it('числа по возрастанию и убыванию', () => {
    expect(compareNullable(1, 2, 'asc')).toBeLessThan(0);
    expect(compareNullable(1, 2, 'desc')).toBeGreaterThan(0);
  });

  it('пустые значения всегда в конце, в любом направлении', () => {
    expect(compareNullable(null, 5, 'asc')).toBeGreaterThan(0);
    expect(compareNullable(null, 5, 'desc')).toBeGreaterThan(0);
    expect(compareNullable(5, undefined, 'desc')).toBeLessThan(0);
    expect(compareNullable(null, undefined, 'asc')).toBe(0);
  });

  it('строки — по-русски без учёта регистра', () => {
    const sorted = ['Яковлев', 'абрамов', 'Борисов'].sort((a, b) => compareNullable(a, b, 'asc'));
    expect(sorted).toEqual(['абрамов', 'Борисов', 'Яковлев']);
  });
});

describe('matchesAllWords', () => {
  it('находит по словам в любом порядке и регистре', () => {
    expect(matchesAllWords('Иванов Пётр Сергеевич', 'пётр иванов')).toBe(true);
    expect(matchesAllWords('Иванов Пётр Сергеевич', 'ИВАН')).toBe(true);
  });

  it('все слова обязательны; пустой запрос подходит всем', () => {
    expect(matchesAllWords('Иванов Пётр', 'иванов сидоров')).toBe(false);
    expect(matchesAllWords('Иванов Пётр', '   ')).toBe(true);
  });
});

describe('formatDuration', () => {
  it('форматирует секунды, минуты и часы', () => {
    expect(formatDuration(45)).toBe('45 с');
    expect(formatDuration(725)).toBe('12 мин 05 с');
    expect(formatDuration(3900)).toBe('1 ч 05 мин');
  });

  it('нет значения или отрицательное → «—»', () => {
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(undefined)).toBe('—');
    expect(formatDuration(-1)).toBe('—');
    expect(formatDuration(Number.NaN)).toBe('—');
  });
});

describe('formatDateTime', () => {
  it('пусто → «—», мусор возвращается как есть', () => {
    expect(formatDateTime(null)).toBe('—');
    expect(formatDateTime('не дата')).toBe('не дата');
  });

  it('корректную дату форматирует локально', () => {
    expect(formatDateTime('2026-10-18T12:00:00Z')).toMatch(/2026/);
  });
});
