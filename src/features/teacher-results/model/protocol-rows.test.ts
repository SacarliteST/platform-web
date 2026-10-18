import { describe, expect, it } from 'vitest';
import type { TestProtocolSummaryResponse } from '../../../api/education/model';
import { buildProtocolRows, filterProtocolRows, sortProtocolRows } from './protocol-rows';

function protocol(overrides: Partial<TestProtocolSummaryResponse>): TestProtocolSummaryResponse {
  return {
    id: 'p',
    userId: 'u1',
    score: 4,
    maxScore: 5,
    tryNumber: 1,
    grade: 4,
    studentName: 'Иванов Иван',
    startedAt: '2026-10-18T10:00:00Z',
    submittedAt: '2026-10-18T10:07:00Z',
    durationSeconds: 420,
    ...overrides,
  };
}

describe('buildProtocolRows', () => {
  it('считает процент баллов и нормализует имя', () => {
    const rows = buildProtocolRows([
      protocol({ id: 'a', score: 3, maxScore: 8 }),
      protocol({ id: 'b', studentName: '   ' }),
      protocol({ id: 'c', studentName: null }),
    ]);

    expect(rows.find((row) => row.id === 'a')?.scorePercent).toBe(37.5);
    expect(rows.find((row) => row.id === 'b')?.studentName).toBe('—');
    expect(rows.find((row) => row.id === 'c')?.studentName).toBe('—');
  });

  it('нулевой максимум и отсутствие балла не дают процента (нет деления на ноль)', () => {
    const rows = buildProtocolRows([
      protocol({ id: 'zero', score: 0, maxScore: 0 }),
      protocol({ id: 'none', score: null, maxScore: null }),
    ]);

    expect(rows.every((row) => row.scorePercent === null)).toBe(true);
  });

  it('числа-строки из API нормализуются; нет времени — null', () => {
    const rows = buildProtocolRows([
      protocol({
        score: '3.5' as unknown as number,
        maxScore: '5' as unknown as number,
        tryNumber: '2' as unknown as number,
        grade: '4' as unknown as number,
        submittedAt: null,
        durationSeconds: null,
      }),
    ]);

    expect(rows[0]).toMatchObject({ score: 3.5, maxScore: 5, tryNumber: 2, grade: 4, scorePercent: 70 });
    expect(rows[0].submittedAt).toBeNull();
    expect(rows[0].durationSeconds).toBeNull();
  });
});

describe('filter/sort', () => {
  const rows = buildProtocolRows([
    protocol({ id: '1', studentName: 'Иванов Иван', score: 5, maxScore: 5, grade: 5, submittedAt: '2026-10-18T10:00:00Z', durationSeconds: 300 }),
    protocol({ id: '2', userId: 'u2', studentName: 'Петров Пётр', score: 2, maxScore: 5, grade: 2, submittedAt: '2026-10-18T12:00:00Z', durationSeconds: 900 }),
    protocol({ id: '3', userId: 'u3', studentName: 'Алексеев Алексей', score: 4, maxScore: 5, grade: 4, submittedAt: null, durationSeconds: null }),
  ]);

  it('поиск по студенту', () => {
    expect(filterProtocolRows(rows, 'пётр').map((row) => row.id)).toEqual(['2']);
    expect(filterProtocolRows(rows, '')).toHaveLength(3);
  });

  it('по результату — по проценту, не по сырым баллам', () => {
    expect(sortProtocolRows(rows, 'scorePercent', 'desc').map((row) => row.id)).toEqual(['1', '3', '2']);
  });

  it('по времени сдачи: без времени всегда в конце', () => {
    expect(sortProtocolRows(rows, 'submittedAt', 'desc').map((row) => row.id)).toEqual(['2', '1', '3']);
    expect(sortProtocolRows(rows, 'submittedAt', 'asc').map((row) => row.id)).toEqual(['1', '2', '3']);
  });

  it('по длительности и по студенту', () => {
    expect(sortProtocolRows(rows, 'durationSeconds', 'desc').map((row) => row.id)).toEqual(['2', '1', '3']);
    expect(sortProtocolRows(rows, 'studentName', 'asc').map((row) => row.id)).toEqual(['3', '1', '2']);
  });
});
