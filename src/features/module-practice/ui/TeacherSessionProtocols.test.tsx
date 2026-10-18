import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ModuleSessionSummaryResponse } from '../../../api/education/model';
import { renderWithProviders } from '../../../test/render';
import { TeacherSessionProtocols } from './TeacherSessionProtocols';

let listResponse: { status: number; data: ModuleSessionSummaryResponse[] };

vi.mock('../../../api/education/module-sessions/module-sessions', () => ({
  useListPracticalModuleSessions: () => ({ data: listResponse, isPending: false, isError: false }),
}));
vi.mock('./SessionEventsFeed', () => ({
  SessionEventsFeed: ({ sessionId, title }: { sessionId: string; title?: string }) => (
    <div data-testid="feed">{`${title} [${sessionId}]`}</div>
  ),
}));

function session(overrides: Partial<ModuleSessionSummaryResponse>): ModuleSessionSummaryResponse {
  return {
    sessionId: 's1',
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

function studentNamesInOrder(): string[] {
  return screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0].textContent ?? '');
}

function renderTable() {
  return renderWithProviders(<TeacherSessionProtocols practicalId="p-1" />);
}

describe('TeacherSessionProtocols', () => {
  beforeEach(() => {
    listResponse = {
      status: 200,
      data: [
        session({ sessionId: 's1', userId: 'u1', studentName: 'Иванов Иван', grade: 40, tryNumber: 1, startedAt: '2026-10-18T10:00:00Z' }),
        session({ sessionId: 's2', userId: 'u1', studentName: 'Иванов Иван', grade: 90, tryNumber: 2, startedAt: '2026-10-18T11:00:00Z', endedAt: '2026-10-18T11:30:00Z' }),
        session({ sessionId: 's3', userId: 'u2', studentName: 'Петров Пётр', grade: null, status: 'ACTIVE', endReason: null, endedAt: null, attemptsCount: null, startedAt: '2026-10-18T12:00:00Z' }),
      ],
    };
  });

  it('показывает действия, длительность, лучшую оценку студента и «идёт» для активной', () => {
    renderTable();

    const rows = screen.getAllByRole('row').slice(1);
    const second = rows.find((row) => within(row).queryByText('#2'));
    expect(second).toBeDefined();
    const cells = within(second!).getAllByRole('cell').map((cell) => cell.textContent);
    expect(cells[2]).toBe('3'); // Попыток в модуле
    expect(cells[4]).toBe('90'); // Оценка
    expect(cells[5]).toBe('90'); // Лучшая у студента
    expect(cells[6]).toBe('30 мин 00 с'); // Длительность

    const active = rows.find((row) => within(row).queryByText('Петров Пётр'));
    const activeCells = within(active!).getAllByRole('cell').map((cell) => cell.textContent);
    expect(activeCells[2]).toBe('—');
    expect(activeCells[5]).toBe('—');
    expect(activeCells[6]).toBe('идёт');
  });

  it('по умолчанию новые попытки сверху; клик по столбцу сортирует, повторный клик меняет направление', async () => {
    renderTable();
    expect(studentNamesInOrder()).toEqual(['Петров Пётр', 'Иванов Иван', 'Иванов Иван']);

    await userEvent.click(screen.getByRole('button', { name: /Студент/ }));
    expect(studentNamesInOrder()).toEqual(['Иванов Иван', 'Иванов Иван', 'Петров Пётр']);

    await userEvent.click(screen.getByRole('button', { name: /Студент/ }));
    expect(studentNamesInOrder()).toEqual(['Петров Пётр', 'Иванов Иван', 'Иванов Иван']);
  });

  it('поиск по студенту фильтрует строки и показывает счётчик; сброс возвращает всё', async () => {
    renderTable();

    await userEvent.type(screen.getByLabelText('Поиск по студенту'), 'пётр');
    expect(studentNamesInOrder()).toEqual(['Петров Пётр']);
    expect(screen.getByText('Найдено: 1 из 3')).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText('Поиск по студенту'));
    await userEvent.type(screen.getByLabelText('Поиск по студенту'), 'сидоров');
    expect(screen.getByText('Ничего не найдено')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Сбросить поиск' }));
    expect(studentNamesInOrder().length).toBe(3);
  });

  it('«Разбор» открывает ленту выбранной попытки и закрывает повторным нажатием', async () => {
    renderTable();

    const row = screen.getAllByRole('row').find((item) => within(item).queryByText('#2'))!;
    await userEvent.click(within(row).getByRole('button', { name: 'Разбор' }));
    expect(screen.getByTestId('feed')).toHaveTextContent('Разбор: Иванов Иван, попытка #2 [s2]');

    await userEvent.click(within(row).getByRole('button', { name: 'Разбор' }));
    expect(screen.queryByTestId('feed')).not.toBeInTheDocument();
  });

  it('нет попыток — пустое состояние', () => {
    listResponse = { status: 200, data: [] };
    renderTable();

    expect(screen.getByText('Попыток нет')).toBeInTheDocument();
  });
});
