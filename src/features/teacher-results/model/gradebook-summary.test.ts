import { describe, expect, it } from 'vitest';
import { buildGradebookRows } from './gradebook-rows';
import { book } from './gradebook-fixture';
import { buildGroupSummaryCsv, summarizeByGroup, summarizeByPractical } from './gradebook-summary';

describe('gradebook-summary', () => {
  const rows = buildGradebookRows({
    ...book,
    students: [book.students[0], { ...book.students[1], group: 'ИС-21' }, book.students[2]],
  });

  it('группирует студентов, «Без группы» в конце, общий итог отдельно', () => {
    const { groups, total } = summarizeByGroup(rows);

    expect(groups.map((item) => item.group)).toEqual(['ИС-21', 'Без группы']);
    expect(groups[0]).toMatchObject({ students: 2, passed: 1, failed: 1, inProgress: 0 });
    expect(groups[1]).toMatchObject({ students: 1, passed: 0, failed: 0, inProgress: 1, averageGrade: 3 });
    expect(total).toMatchObject({ group: 'Все студенты', students: 3, passed: 1, failed: 1, inProgress: 1 });
  });

  it('средняя и распределение считаются по выставленным оценкам', () => {
    const { groups, total } = summarizeByGroup(rows);

    // ИС-21: 5, 4 (Иванов) и 2 (Петров)
    expect(groups[0].averageGrade).toBe(3.67);
    expect(groups[0].distribution).toEqual({ 2: 1, 3: 0, 4: 1, 5: 1 });
    expect(total.distribution).toEqual({ 2: 1, 3: 1, 4: 1, 5: 1 });
  });

  it('итог по практикам учитывает только назначенных', () => {
    const totals = summarizeByPractical(book, rows);

    expect(totals[0]).toMatchObject({ practicalId: 'p1', assigned: 3, passed: 1, failed: 1, incomplete: 1, averageGrade: 3.5 });
    expect(totals[1]).toMatchObject({ practicalId: 'p2', assigned: 2, passed: 2, failed: 0, incomplete: 0, averageGrade: 3.5 });
  });

  it('CSV сводки: заголовок, группы, общий итог, запятая в средней', () => {
    const lines = buildGroupSummaryCsv(summarizeByGroup(rows)).split('\r\n');

    expect(lines[0]).toBe('Группа;Студентов;Прошли;Не прошли;В процессе;Средняя;Оценок «5»;Оценок «4»;Оценок «3»;Оценок «2»');
    expect(lines[1]).toBe('ИС-21;2;1;1;0;3,67;1;1;0;1');
    expect(lines[3]).toBe('Все студенты;3;1;1;1;3,5;1;1;1;1');
  });
});
