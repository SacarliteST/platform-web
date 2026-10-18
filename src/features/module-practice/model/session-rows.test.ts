import { describe, expect, it } from 'vitest';
import type { ModuleSessionSummaryResponse } from '../../../api/education/model';
import { buildSessionRows, filterSessionRows, sortSessionRows } from './session-rows';

function session(overrides: Partial<ModuleSessionSummaryResponse>): ModuleSessionSummaryResponse {
  return {
    sessionId: 's',
    userId: 'u1',
    studentName: 'Иванов Иван',
    tryNumber: 1,
    status: 'COMPLETED',
    endReason: 'completed',
    grade: 80,
    startedAt: '2026-10-18T10:00:00Z',
    endedAt: '2026-10-18T10:12:05Z',
    attemptsCount: 3,
    ...overrides,
  };
}

describe('buildSessionRows', () => {
  it('считает длительность завершённой сессии и оставляет null для идущей', () => {
    const rows = buildSessionRows([
      session({ sessionId: 'done' }),
      session({ sessionId: 'active', status: 'ACTIVE', endedAt: null, grade: null, attemptsCount: null }),
    ]);

    expect(rows.find((row) => row.sessionId === 'done')?.durationSeconds).toBe(725);
    expect(rows.find((row) => row.sessionId === 'active')?.durationSeconds).toBeNull();
  });

  it('отрицательная или битая длительность → null', () => {
    const rows = buildSessionRows([
      session({ sessionId: 'neg', endedAt: '2026-10-18T09:00:00Z' }),
      session({ sessionId: 'bad', endedAt: 'не дата' }),
    ]);

    expect(rows.every((row) => row.durationSeconds === null)).toBe(true);
  });

  it('лучшая оценка студента — максимум по всем его сессиям, у других студентов — своя', () => {
    const rows = buildSessionRows([
      session({ sessionId: 'a1', userId: 'u1', grade: 40 }),
      session({ sessionId: 'a2', userId: 'u1', grade: 90, tryNumber: 2 }),
      session({ sessionId: 'a3', userId: 'u1', grade: null, status: 'EXPIRED', tryNumber: 3 }),
      session({ sessionId: 'b1', userId: 'u2', studentName: 'Петров Пётр', grade: 55 }),
      session({ sessionId: 'c1', userId: 'u3', studentName: 'Сидоров Сидор', grade: null }),
    ]);

    expect(rows.filter((row) => row.userId === 'u1').every((row) => row.studentBestGrade === 90)).toBe(true);
    expect(rows.find((row) => row.userId === 'u2')?.studentBestGrade).toBe(55);
    expect(rows.find((row) => row.userId === 'u3')?.studentBestGrade).toBeNull();
  });

  it('нормализует числа-строки из API (number | string)', () => {
    const rows = buildSessionRows([
      session({ tryNumber: '2' as unknown as number, grade: '75' as unknown as number, attemptsCount: '4' as unknown as number }),
    ]);

    expect(rows[0]).toMatchObject({ tryNumber: 2, grade: 75, attemptsCount: 4 });
  });
});

describe('filterSessionRows / sortSessionRows', () => {
  const rows = buildSessionRows([
    session({ sessionId: '1', studentName: 'Иванов Иван', grade: 50, attemptsCount: 5, startedAt: '2026-10-18T10:00:00Z' }),
    session({ sessionId: '2', userId: 'u2', studentName: 'Петров Пётр', grade: 100, attemptsCount: null, startedAt: '2026-10-18T11:00:00Z' }),
    session({ sessionId: '3', userId: 'u3', studentName: 'Алексеев Алексей', grade: null, attemptsCount: 2, startedAt: '2026-10-18T09:00:00Z' }),
  ]);

  it('поиск по студенту — по словам в любом порядке и регистре', () => {
    expect(filterSessionRows(rows, 'пётр петров').map((row) => row.sessionId)).toEqual(['2']);
    expect(filterSessionRows(rows, '').length).toBe(3);
    expect(filterSessionRows(rows, 'несуществующий')).toEqual([]);
  });

  it('сортировка по студенту по алфавиту', () => {
    expect(sortSessionRows(rows, 'studentName', 'asc').map((row) => row.sessionId)).toEqual(['3', '1', '2']);
  });

  it('сортировка по оценке: пустые всегда в конце в любом направлении', () => {
    expect(sortSessionRows(rows, 'grade', 'desc').map((row) => row.sessionId)).toEqual(['2', '1', '3']);
    expect(sortSessionRows(rows, 'grade', 'asc').map((row) => row.sessionId)).toEqual(['1', '2', '3']);
  });

  it('сортировка по времени старта', () => {
    expect(sortSessionRows(rows, 'startedAt', 'desc').map((row) => row.sessionId)).toEqual(['2', '1', '3']);
  });

  it('исходный массив не мутируется', () => {
    const before = rows.map((row) => row.sessionId);
    sortSessionRows(rows, 'studentName', 'desc');
    expect(rows.map((row) => row.sessionId)).toEqual(before);
  });
});
