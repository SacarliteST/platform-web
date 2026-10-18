import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../test/render';
import { book } from '../model/gradebook-fixture';
import { GradebookTable } from './GradebookTable';

function names(): string[] {
  return screen
    .getAllByRole('row')
    .slice(1, -1) // без заголовка и итоговой строки
    .map((row) => within(row).getAllByRole('cell')[0].textContent ?? '');
}

describe('GradebookTable', () => {
  it('показывает оценки, «нет», «—» и счётчик зачтённых', () => {
    renderWithProviders(<GradebookTable book={book} />);

    const row = (name: string) => screen.getAllByRole('row').find((item) => within(item).queryByText(name))!;
    const cells = (name: string) => within(row(name)).getAllByRole('cell').map((cell) => cell.textContent);

    expect(cells('Иванов Иван').slice(1)).toEqual(['5', '4', '2 из 2', '4.50']);
    expect(cells('Петров Пётр').slice(1)).toEqual(['2', '—', '0 из 1', '2.00']);
    expect(cells('Сидоров Сидор').slice(1)).toEqual(['нет', '3', '1 из 2', '3.00']);
  });

  it('фильтр «Прошли» оставляет только тех, кто сдал всё назначенное', async () => {
    renderWithProviders(<GradebookTable book={book} />);
    expect(names()).toHaveLength(3);

    await userEvent.click(screen.getByText('Прошли'));
    expect(names()).toEqual(['Иванов Иван' + 'ИС-21']);

    await userEvent.click(screen.getByText('Не прошли'));
    expect(names()).toEqual(['Петров Пётр']);
  });

  it('итоговая строка: зачтено и средняя по каждой практике', () => {
    renderWithProviders(<GradebookTable book={book} />);

    const footer = screen.getAllByRole('row').at(-1)!;
    expect(within(footer).getAllByRole('cell').map((cell) => cell.textContent).slice(0, 2)).toEqual(['1 из 33.50', '2 из 23.50']);
  });

  it('вкладка «Сводка по группам» показывает группы и общий итог', async () => {
    renderWithProviders(<GradebookTable book={book} />);

    await userEvent.click(screen.getByRole('tab', { name: 'Сводка по группам' }));

    expect(await screen.findByText('Все студенты')).toBeInTheDocument();
    expect(screen.getByText('ИС-21')).toBeInTheDocument();
    expect(screen.getByText('Без группы')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Скачать сводку CSV' })).toBeInTheDocument();
  });

  it('поиск без результата показывает сброс', async () => {
    renderWithProviders(<GradebookTable book={book} />);

    await userEvent.type(screen.getByLabelText('Поиск по студенту'), 'нетакого');
    expect(screen.getByText('Ничего не найдено')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Сбросить' }));
    expect(names()).toHaveLength(3);
  });
});
