import type { CourseGradebookResponse } from '../../../api/education/model';
import { compareNullable, matchesAllWords, toNullableNumber, toNumber, type SortDirection } from '../../../shared/lib';

export type GradeStatus = 'passed' | 'failed' | 'incomplete';
export type GradebookFilter = 'all' | 'passed' | 'failed' | 'incomplete';
export type GradebookSortKey = 'studentName' | 'passedCount' | 'averageGrade';

export type GradebookCell = {
  practicalId: string;
  assigned: boolean;
  grade: number | null;
  status: GradeStatus;
};

export type GradebookRow = {
  studentId: string;
  studentName: string;
  group: string | null;
  cells: GradebookCell[];
  assignedCount: number;
  passedCount: number;
  averageGrade: number | null;
  /** Итог по студенту: зачтено всё назначенное / есть оценка ниже проходной / что-то ещё не сдано. */
  overall: GradeStatus;
};

function toStatus(value: string): GradeStatus {
  return value === 'passed' || value === 'failed' ? value : 'incomplete';
}

function overallOf(cells: GradebookCell[]): GradeStatus {
  const assigned = cells.filter((cell) => cell.assigned);
  if (assigned.some((cell) => cell.status === 'failed')) {
    return 'failed';
  }
  if (assigned.length > 0 && assigned.every((cell) => cell.status === 'passed')) {
    return 'passed';
  }
  return 'incomplete';
}

export function buildGradebookRows(book: CourseGradebookResponse): GradebookRow[] {
  return book.students.map((student) => {
    const cells = student.cells.map((cell) => ({
      practicalId: cell.practicalId,
      assigned: cell.assigned,
      grade: toNullableNumber(cell.grade),
      status: toStatus(cell.status),
    }));
    return {
      studentId: student.studentId,
      studentName: student.studentName?.trim() ? student.studentName : '—',
      group: student.group ?? null,
      cells,
      assignedCount: toNumber(student.assignedCount),
      passedCount: toNumber(student.passedCount),
      averageGrade: toNullableNumber(student.averageGrade),
      overall: overallOf(cells),
    };
  });
}

export function filterGradebookRows(rows: readonly GradebookRow[], query: string, filter: GradebookFilter): GradebookRow[] {
  return rows.filter(
    (row) =>
      (filter === 'all' || row.overall === filter) &&
      matchesAllWords(`${row.studentName} ${row.group ?? ''}`, query),
  );
}

export function sortGradebookRows(rows: readonly GradebookRow[], key: GradebookSortKey, direction: SortDirection): GradebookRow[] {
  return [...rows].sort((a, b) => compareNullable(a[key], b[key], direction));
}

/** Подпись ячейки: оценка, «нет» (ещё не сдано) или «—» (практика не назначена). */
export function cellLabel(cell: GradebookCell): string {
  if (!cell.assigned) {
    return '—';
  }
  return cell.grade === null ? 'нет' : String(cell.grade);
}

function csvEscape(value: string): string {
  return /[";\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** CSV для Excel: разделитель «;», первая строка — заголовки. */
export function buildGradebookCsv(book: CourseGradebookResponse, rows: readonly GradebookRow[]): string {
  const header = [
    'Студент',
    'Группа',
    ...book.practicals.map((practical) => `${practical.moduleName}: ${practical.name}`),
    'Зачтено',
    'Средняя',
  ];
  const lines = rows.map((row) => [
    row.studentName,
    row.group ?? '',
    ...book.practicals.map((practical) => {
      const cell = row.cells.find((item) => item.practicalId === practical.id);
      return cell ? cellLabel(cell) : '—';
    }),
    `${row.passedCount} из ${row.assignedCount}`,
    row.averageGrade === null ? '' : String(row.averageGrade).replace('.', ','),
  ]);
  return [header, ...lines].map((line) => line.map(csvEscape).join(';')).join('\r\n');
}
