import type { TestProtocolSummaryResponse } from '../../../api/education/model';
import { compareNullable, matchesAllWords, toNullableNumber, toNumber, type SortDirection } from '../../../shared/lib';

export type ProtocolSortKey = 'studentName' | 'tryNumber' | 'scorePercent' | 'grade' | 'submittedAt' | 'durationSeconds';

export type ProtocolRow = {
  id: string;
  userId: string;
  studentName: string;
  tryNumber: number;
  score: number | null;
  maxScore: number | null;
  /** Доля набранных баллов (0–100) — для сортировки по результату независимо от веса теста. */
  scorePercent: number | null;
  grade: number;
  startedAt: string | null;
  submittedAt: string | null;
  durationSeconds: number | null;
};

export function buildProtocolRows(items: readonly TestProtocolSummaryResponse[]): ProtocolRow[] {
  return items.map((item) => {
    const score = toNullableNumber(item.score);
    const maxScore = toNullableNumber(item.maxScore);
    return {
      id: item.id,
      userId: item.userId,
      studentName: item.studentName?.trim() ? item.studentName : '—',
      tryNumber: toNumber(item.tryNumber),
      score,
      maxScore,
      scorePercent: score !== null && maxScore ? Math.round((score / maxScore) * 1000) / 10 : null,
      grade: toNumber(item.grade),
      startedAt: item.startedAt ?? null,
      submittedAt: item.submittedAt ?? null,
      durationSeconds: toNullableNumber(item.durationSeconds),
    };
  });
}

export function filterProtocolRows(rows: readonly ProtocolRow[], query: string): ProtocolRow[] {
  return rows.filter((row) => matchesAllWords(row.studentName, query));
}

export function sortProtocolRows(
  rows: readonly ProtocolRow[],
  key: ProtocolSortKey,
  direction: SortDirection,
): ProtocolRow[] {
  return [...rows].sort((a, b) => {
    const aValue = key === 'submittedAt' ? (a.submittedAt ? Date.parse(a.submittedAt) : null) : a[key];
    const bValue = key === 'submittedAt' ? (b.submittedAt ? Date.parse(b.submittedAt) : null) : b[key];
    return compareNullable(aValue, bValue, direction);
  });
}
