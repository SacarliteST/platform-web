import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { StudentTrainingPage } from './StudentTrainingPage';
import { renderWithProviders } from '../../test/render';

// Банк заданий: список модулей, выдача ссылки, повторная выдача при ?relaunch=<slug>.

const mutateAsync = vi.fn();
let modulesResponse: { status: number; data: unknown };

vi.mock('../../api/education/practical-modules/practical-modules', () => ({
  useGetTrainingModules: () => ({
    data: modulesResponse,
    isPending: false,
    isError: false,
  }),
  useCreateTrainingLink: () => ({ mutateAsync, isPending: false }),
}));

const sql = { id: 'm-1', slug: 'sql', name: 'SQL-тренажёр', description: 'Задания по SQL' };
const assign = vi.fn();

describe('StudentTrainingPage', () => {
  beforeEach(() => {
    mutateAsync.mockReset();
    assign.mockReset();
    modulesResponse = { status: 200, data: [sql] };
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, assign },
    });
  });

  it('показывает карточку модуля и открывает банк по ссылке из ответа', async () => {
    mutateAsync.mockResolvedValue({ status: 200, data: { url: 'https://x/modules/sql/student/launch#access_token=t' } });
    renderWithProviders(<StudentTrainingPage />, { route: '/student/training' });

    expect(screen.getByText('SQL-тренажёр')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Открыть' }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://x/modules/sql/student/launch#access_token=t'));
    expect(mutateAsync).toHaveBeenCalledWith({ practicalModuleId: 'm-1', data: { returnPath: '/student/training' } });
  });

  it('без модулей с банком — пустое состояние', () => {
    modulesResponse = { status: 200, data: [] };
    renderWithProviders(<StudentTrainingPage />, { route: '/student/training' });

    expect(screen.getByText('Банк заданий пока не подключён')).toBeInTheDocument();
  });

  it('409 TrainingBankDisabled — понятный текст, перехода нет', async () => {
    mutateAsync.mockResolvedValue({ status: 409, data: { reason: 'TrainingBankDisabled' } });
    renderWithProviders(<StudentTrainingPage />, { route: '/student/training' });

    fireEvent.click(screen.getByRole('button', { name: 'Открыть' }));

    expect(await screen.findByText('Банк заданий этого модуля пока не включён.')).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
  });

  it('?relaunch=<slug> сам запрашивает ссылку один раз', async () => {
    mutateAsync.mockResolvedValue({ status: 200, data: { url: 'https://x/launch#access_token=t2' } });
    renderWithProviders(<StudentTrainingPage />, { route: '/student/training?relaunch=sql' });

    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://x/launch#access_token=t2'));
    expect(mutateAsync).toHaveBeenCalledTimes(1);
  });

  it('?relaunch с неизвестным slug ничего не запрашивает', async () => {
    renderWithProviders(<StudentTrainingPage />, { route: '/student/training?relaunch=other' });

    await waitFor(() => expect(screen.getByText('SQL-тренажёр')).toBeInTheDocument());
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
