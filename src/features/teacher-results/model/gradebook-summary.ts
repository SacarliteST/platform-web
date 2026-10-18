import type { CourseGradebookResponse } from '../../../api/education/model';
import type { GradebookRow } from './gradebook-rows';

export const NO_GROUP_LABEL = 'Без группы';

export type GradeDistribution = { 2: number; 3: number; 4: number; 5: number };

export type GroupSummary = {
  group: string;
  students: number;
  passed: number;
  failed: number;
  inProgress: number;
  /** Средняя оценка по всем выставленным оценкам группы; нет ни одной — null. */
  averageGrade: number | null;
  /** Сколько оценок 2/3/4/5 выставлено в группе (по всем практикам). */
  distribution: GradeDistribution;
};

export type PracticalSummary = {
  practicalId: string;
  assigned: number;
  passed: number;
  failed: number;
  incomplete: number;
  averageGrade: number | null;
};

function mean(values: readonly number[]): number | null {
  return values.length === 0 ? null : Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
}

function emptyDistribution(): GradeDistribution {
  return { 2: 0, 3: 0, 4: 0, 5: 0 };
}

function summarize(group: string, rows: readonly GradebookRow[]): GroupSummary {
  const distribution = emptyDistribution();
  const grades: number[] = [];
  for (const row of rows) {
    for (const cell of row.cells) {
      if (cell.assigned && cell.grade !== null) {
        grades.push(cell.grade);
        if (cell.grade in distribution) {
          distribution[cell.grade as 2 | 3 | 4 | 5] += 1;
        }
      }
    }
  }
  return {
    group,
    students: rows.length,
    passed: rows.filter((row) => row.overall === 'passed').length,
    failed: rows.filter((row) => row.overall === 'failed').length,
    inProgress: rows.filter((row) => row.overall === 'incomplete').length,
    averageGrade: mean(grades),
    distribution,
  };
}

/** Сводка по каждой группе (по алфавиту, «Без группы» в конце) и общий итог по всем студентам. */
export function summarizeByGroup(rows: readonly GradebookRow[]): { groups: GroupSummary[]; total: GroupSummary } {
  const byGroup = new Map<string, GradebookRow[]>();
  for (const row of rows) {
    const key = row.group?.trim() ? row.group.trim() : NO_GROUP_LABEL;
    byGroup.set(key, [...(byGroup.get(key) ?? []), row]);
  }
  const groups = [...byGroup.entries()]
    .sort(([a], [b]) => {
      if (a === NO_GROUP_LABEL) return 1;
      if (b === NO_GROUP_LABEL) return -1;
      return a.localeCompare(b, 'ru', { sensitivity: 'base' });
    })
    .map(([group, items]) => summarize(group, items));
  return { groups, total: summarize('Все студенты', rows) };
}

/** Итог по каждой практике: сколько студентов зачли, не зачли, ещё не закончили, и средняя оценка. */
export function summarizeByPractical(book: CourseGradebookResponse, rows: readonly GradebookRow[]): PracticalSummary[] {
  return book.practicals.map((practical) => {
    const cells = rows
      .map((row) => row.cells.find((cell) => cell.practicalId === practical.id))
      .filter((cell) => cell?.assigned === true);
    return {
      practicalId: practical.id,
      assigned: cells.length,
      passed: cells.filter((cell) => cell?.status === 'passed').length,
      failed: cells.filter((cell) => cell?.status === 'failed').length,
      incomplete: cells.filter((cell) => cell?.status === 'incomplete').length,
      averageGrade: mean(cells.flatMap((cell) => (cell?.grade == null ? [] : [cell.grade]))),
    };
  });
}

function csvEscape(value: string): string {
  return /[";\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function formatAverage(value: number | null): string {
  return value === null ? '' : String(value).replace('.', ',');
}

/** CSV сводки по группам (для Excel: разделитель «;»). Последняя строка — общий итог. */
export function buildGroupSummaryCsv(summary: { groups: readonly GroupSummary[]; total: GroupSummary }): string {
  const header = ['Группа', 'Студентов', 'Прошли', 'Не прошли', 'В процессе', 'Средняя', 'Оценок «5»', 'Оценок «4»', 'Оценок «3»', 'Оценок «2»'];
  const line = (item: GroupSummary) => [
    item.group,
    String(item.students),
    String(item.passed),
    String(item.failed),
    String(item.inProgress),
    formatAverage(item.averageGrade),
    String(item.distribution[5]),
    String(item.distribution[4]),
    String(item.distribution[3]),
    String(item.distribution[2]),
  ];
  return [header, ...summary.groups.map(line), line(summary.total)]
    .map((cells) => cells.map(csvEscape).join(';'))
    .join('\r\n');
}
