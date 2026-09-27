import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen } from '@testing-library/react';
import { StudentExternalPractical } from './StudentExternalPractical';
import { renderWithProviders } from '../../../test/render';
import type { ExternalModuleBindingResponse, ModuleSessionResponse } from '../../../api/education/model';

// Обратный отсчёт до окончания активной попытки (session.expiresAt), тикает раз в секунду.

const refetch = vi.fn();
let sessionValue: ModuleSessionResponse | null;

vi.mock('../../../api/education/module-sessions/module-sessions', () => ({
  useGetCurrentModuleSession: () => ({
    data: {
      status: 200,
      data: { session: sessionValue, attemptsCount: 0, triesCount: 3, bestGrade: null },
    },
    isPending: false,
    isError: false,
    refetch,
  }),
  useGetModuleSession: () => ({ data: undefined, isPending: false }),
  useStartModuleSession: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAbandonModuleSession: () => ({ mutateAsync: vi.fn(), isPending: false }),
  getGetCurrentModuleSessionQueryKey: () => ['current-module-session'],
}));

vi.mock('./SessionEventsFeed', () => ({ SessionEventsFeed: () => null }));

const binding: ExternalModuleBindingResponse = {
  practicalModuleId: 'mod-1',
  practicalModuleSlug: 'sql',
  practicalModuleName: 'SQL',
  taskId: 't-1',
  externalTaskRef: 'sql-task-1',
};

function renderCard() {
  return renderWithProviders(
    <StudentExternalPractical practicalId="p-1" binding={binding} triesCount={3} timeLimitMinutes={30} />,
  );
}

describe('StudentExternalPractical: обратный отсчёт активной попытки', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    refetch.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('без активной сессии показывает только статичный лимит, без отсчёта', () => {
    sessionValue = null;
    renderCard();

    expect(screen.getByText(/лимит 30 мин/)).toBeInTheDocument();
    expect(screen.queryByText(/Осталось:/)).not.toBeInTheDocument();
  });

  it('при активной попытке считает время до expiresAt и обновляет каждую секунду', () => {
    sessionValue = {
      sessionId: 's-1', status: 'ACTIVE', endReason: null, grade: null,
      expiresAt: new Date(Date.now() + 90_000).toISOString(),
    };
    renderCard();

    expect(screen.getByText('Осталось: 1:30')).toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(31_000); });
    expect(screen.getByText('Осталось: 0:59')).toBeInTheDocument();
  });

  it('по истечении времени один раз вызывает обновление гейта', () => {
    sessionValue = {
      sessionId: 's-2', status: 'ACTIVE', endReason: null, grade: null,
      expiresAt: new Date(Date.now() + 2000).toISOString(),
    };
    renderCard();

    act(() => { vi.advanceTimersByTime(2100); });
    expect(screen.getByText('Время вышло, обновляем…')).toBeInTheDocument();
    expect(refetch).toHaveBeenCalledTimes(1);

    // дальнейшие тики не зовут refetch повторно
    act(() => { vi.advanceTimersByTime(3000); });
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
