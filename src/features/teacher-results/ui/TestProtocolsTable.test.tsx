import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TestProtocolSummaryResponse } from '../../../api/education/model';
import { renderWithProviders } from '../../../test/render';
import { TestProtocolsTable } from './TestProtocolsTable';

const items: TestProtocolSummaryResponse[] = [
  { id: 'p1', userId: 'u1', score: 5, maxScore: 5, tryNumber: 1, grade: 5, studentName: 'Иванов Иван', startedAt: '2026-10-18T10:00:00Z', submittedAt: '2026-10-18T10:07:00Z', durationSeconds: 420 },
  { id: 'p2', userId: 'u2', score: 2, maxScore: 5, tryNumber: 2, grade: 2, studentName: 'Петров Пётр', startedAt: '2026-10-18T11:00:00Z', submittedAt: '2026-10-18T11:20:00Z', durationSeconds: 1200 },
];

function names(): string[] {
  return screen.getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell')[0].textContent ?? '');
}

describe('TestProtocolsTable', () => {
  it('показывает имя студента, баллы, оценку и длительность', () => {
    renderWithProviders(<TestProtocolsTable items={items} selectedId={null} onSelect={vi.fn()} />);

    const row = screen.getAllByRole('row').find((item) => within(item).queryByText('Иванов Иван'))!;
    const cells = within(row).getAllByRole('cell').map((cell) => cell.textContent);
    expect(cells[1]).toBe('#1');
    expect(cells[2]).toBe('5 / 5');
    expect(cells[3]).toBe('5');
    expect(cells[5]).toBe('7 мин 00 с');
  });

  it('новые сдачи сверху; сортировка по студенту по клику', async () => {
    renderWithProviders(<TestProtocolsTable items={items} selectedId={null} onSelect={vi.fn()} />);
    expect(names()).toEqual(['Петров Пётр', 'Иванов Иван']);

    await userEvent.click(screen.getByRole('button', { name: /Студент/ }));
    expect(names()).toEqual(['Иванов Иван', 'Петров Пётр']);
  });

  it('поиск по студенту и пустой результат со сбросом', async () => {
    renderWithProviders(<TestProtocolsTable items={items} selectedId={null} onSelect={vi.fn()} />);

    await userEvent.type(screen.getByLabelText('Поиск по студенту'), 'иванов');
    expect(names()).toEqual(['Иванов Иван']);

    await userEvent.clear(screen.getByLabelText('Поиск по студенту'));
    await userEvent.type(screen.getByLabelText('Поиск по студенту'), 'нет такого');
    expect(screen.getByText('Ничего не найдено')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Сбросить поиск' }));
    expect(names()).toHaveLength(2);
  });

  it('«Разбор» вызывает выбор протокола', async () => {
    const onSelect = vi.fn();
    renderWithProviders(<TestProtocolsTable items={items} selectedId={null} onSelect={onSelect} />);

    const row = screen.getAllByRole('row').find((item) => within(item).queryByText('Иванов Иван'))!;
    await userEvent.click(within(row).getByRole('button', { name: 'Разбор' }));

    expect(onSelect).toHaveBeenCalledWith('p1');
  });
});
