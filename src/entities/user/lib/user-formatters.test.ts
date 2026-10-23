import { describe, expect, it } from 'vitest';
import { getUserFullName } from './user-formatters';

describe('getUserFullName', () => {
  it('собирает «Фамилия Имя Отчество»', () => {
    expect(
      getUserFullName({ lastName: 'Сидорова', firstName: 'Анна', middleName: 'Игоревна', displayName: 'Анна Сидорова', email: 'a@x.test' }),
    ).toBe('Сидорова Анна Игоревна');
  });

  it('пропускает пустые части и пробелы', () => {
    expect(getUserFullName({ lastName: ' Петров ', firstName: '', middleName: null, email: 'p@x.test' })).toBe('Петров');
  });

  it('без структурного ФИО берёт отображаемое имя, затем email', () => {
    expect(getUserFullName({ displayName: 'Иван Петров', email: 'i@x.test' })).toBe('Иван Петров');
    expect(getUserFullName({ displayName: '  ', email: 'i@x.test' })).toBe('i@x.test');
  });
});
