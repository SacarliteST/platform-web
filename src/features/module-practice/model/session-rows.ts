import type { ModuleSessionSummaryResponse } from '../../../api/education/model';
import { compareNullable, matchesAllWords, toNullableNumber, toNumber, type SortDirection } from '../../../shared/lib';

export type SessionSortKey =
  | 'studentName'
  | 'tryNumber'
  | 'attemptsCount'
  | 'status'
  | 'grade'
  | 'studentBestGrade'
  | 'durationSeconds'
  | 'startedAt';

export type SessionRow = {
  sessionId: string;
  userId: string;
  studentName: string;
  tryNumber: number;
  status: string;
  endReason: string | null;
  grade: number | null;
  startedAt: string;
  endedAt: string | null;
  /** Число попыток внутри сессии (присылает модуль при завершении); null — данных нет. */
  attemptsCount: number | null;
  /** Длительность по уже завершённой сессии; у идущей и без `endedAt` — null. */
  durationSeconds: number | null;
  /** Лучшая оценка этого студента среди всех его сессий по практике. */
  studentBestGrade: number | null;
};

function durationSeconds(startedAt: string, endedAt: string | null | undefined): number | null {
  if (!endedAt) {
    return null;
  }
  const start = Date.parse(startedAt);
  const end = Date.parse(endedAt);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return null;
  }
  return Math.round((end - start) / 1000);
}

export function buildSessionRows(items: readonly ModuleSessionSummaryResponse[]): SessionRow[] {
  const bestByUser = new Map<string, number>();
  for (const item of items) {
    const grade = toNullableNumber(item.grade);
    if (grade !== null) {
      bestByUser.set(item.userId, Math.max(bestByUser.get(item.userId) ?? grade, grade));
    }
  }

  return items.map((item) => ({
    sessionId: item.sessionId,
    userId: item.userId,
    studentName: item.studentName,
    tryNumber: toNumber(item.tryNumber),
    status: item.status,
    endReason: item.endReason ?? null,
    grade: toNullableNumber(item.grade),
    startedAt: item.startedAt,
    endedAt: item.endedAt ?? null,
    attemptsCount: toNullableNumber(item.attemptsCount),
    durationSeconds: durationSeconds(item.startedAt, item.endedAt),
    studentBestGrade: bestByUser.get(item.userId) ?? null,
  }));
}

export function filterSessionRows(rows: readonly SessionRow[], query: string): SessionRow[] {
  return rows.filter((row) => matchesAllWords(row.studentName, query));
}

export function sortSessionRows(
  rows: readonly SessionRow[],
  key: SessionSortKey,
  direction: SortDirection,
): SessionRow[] {
  return [...rows].sort((a, b) => {
    const aValue = key === 'startedAt' ? Date.parse(a.startedAt) : a[key];
    const bValue = key === 'startedAt' ? Date.parse(b.startedAt) : b[key];
    return compareNullable(aValue, bValue, direction);
  });
}
