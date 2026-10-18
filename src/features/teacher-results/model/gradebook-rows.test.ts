import { describe, expect, it } from 'vitest';
import {
  buildGradebookCsv,
  buildGradebookRows,
  cellLabel,
  filterGradebookRows,
  sortGradebookRows,
} from './gradebook-rows';
import { book } from './gradebook-fixture';

describe('gradebook-rows', () => {
  it('итог по студенту: прошёл / не прошёл / в процессе', () => {
    const rows = buildGradebookRows(book);
    expect(rows.map((row) => row.overall)).toEqual(['passed', 'failed', 'incomplete']);
  });

  it('фильтр по итогу и поиск по имени и группе', () => {
    const rows = buildGradebookRows(book);
    expect(filterGradebookRows(rows, '', 'passed').map((row) => row.studentId)).toEqual(['s1']);
    expect(filterGradebookRows(rows, 'пётр', 'all').map((row) => row.studentId)).toEqual(['s2']);
    expect(filterGradebookRows(rows, 'ис-21', 'all').map((row) => row.studentId)).toEqual(['s1']);
    expect(filterGradebookRows(rows, 'иванов', 'failed')).toEqual([]);
  });

  it('сортировка по средней: пустые в конце', () => {
    const rows = buildGradebookRows({
      ...book,
      students: [{ ...book.students[0], averageGrade: null }, book.students[1], book.students[2]],
    });
    expect(sortGradebookRows(rows, 'averageGrade', 'desc').map((row) => row.studentId)).toEqual(['s3', 's2', 's1']);
  });

  it('подписи ячеек: оценка, «нет», «—»', () => {
    const [ivanov, petrov, sidorov] = buildGradebookRows(book);
    expect(cellLabel(ivanov.cells[0])).toBe('5');
    expect(cellLabel(petrov.cells[1])).toBe('—');
    expect(cellLabel(sidorov.cells[0])).toBe('нет');
  });

  it('CSV: разделитель «;», экранирование кавычек и точек с запятой, запятая в средней', () => {
    const rows = buildGradebookRows(book);
    const lines = buildGradebookCsv(book, rows).split('\r\n');
    expect(lines[0]).toBe('Студент;Группа;Модуль А: Практика 1;"Модуль А: SQL; ""джойны""";Зачтено;Средняя');
    expect(lines[1]).toBe('Иванов Иван;ИС-21;5;4;2 из 2;4,5');
    expect(lines[2]).toBe('Петров Пётр;;2;—;0 из 1;2');
    expect(lines[3]).toBe('Сидоров Сидор;;нет;3;1 из 2;3');
  });
});
