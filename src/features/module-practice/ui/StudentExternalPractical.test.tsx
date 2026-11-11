import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import { StudentExternalPractical } from './StudentExternalPractical';
import { renderWithProviders } from '../../../test/render';
import type { ExternalModuleBindingResponse, ModuleSessionResponse } from '../../../api/education/model';

// Обратный отсчёт до окончания активной попытки (session.expiresAt), тикает раз в секунду.

const refetch = vi.fn();
const moduleSessionRefetch = vi.fn();
let sessionValue: ModuleSessionResponse | null;
let attemptsPerSession: number | null = null;
let submissionsCount = 0;
type SessionHttpResponse = { status: number; data: ModuleSessionResponse };
type ModuleSessionQueryState = { state: { data?: SessionHttpResponse } };
type ModuleSessionHookOptions = {
  query?: { refetchInterval?: (query: ModuleSessionQueryState) => number | false };
};
let moduleSessionResponse: SessionHttpResponse | undefined;
let moduleSessionPending = false;
let moduleSessionError = false;
let moduleSessionOptions: ModuleSessionHookOptions | undefined;

vi.mock('../../../api/education/module-sessions/module-sessions', () => ({
  useGetCurrentModuleSession: () => ({
    data: {
      status: 200,
      data: { session: sessionValue, attemptsCount: 0, triesCount: 3, bestGrade: null, attemptsPerSession, submissionsCount },
    },
    isPending: false,
    isError: false,
    refetch,
  }),
  useGetModuleSession: (
    _practicalId: string,
    _sessionId: string,
    options: ModuleSessionHookOptions,
  ) => {
    moduleSessionOptions = options;
    return {
      data: moduleSessionResponse,
      isPending: moduleSessionPending,
      isError: moduleSessionError,
      refetch: moduleSessionRefetch,
    };
  },
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

function renderCard(route = '/') {
  return renderWithProviders(
    <StudentExternalPractical practicalId="p-1" binding={binding} triesCount={3} timeLimitMinutes={30} />,
    { route },
  );
}

beforeEach(() => {
  sessionValue = null;
  attemptsPerSession = null;
  submissionsCount = 0;
  moduleSessionResponse = undefined;
  moduleSessionPending = false;
  moduleSessionError = false;
  moduleSessionOptions = undefined;
  moduleSessionRefetch.mockClear();
});

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

  it('у активной сессии показывает число отправок и лимит', () => {
    sessionValue = {
      sessionId: 's-3', status: 'ACTIVE', endReason: null, grade: null,
      expiresAt: new Date(Date.now() + 90_000).toISOString(),
    };
    attemptsPerSession = 5;
    submissionsCount = 2;
    renderCard();

    expect(screen.getByText(/Отправок решения: 2 из 5/)).toBeInTheDocument();
  });

  it('без лимита отправок пишет «без ограничения»', () => {
    sessionValue = {
      sessionId: 's-4', status: 'ACTIVE', endReason: null, grade: null,
      expiresAt: new Date(Date.now() + 90_000).toISOString(),
    };
    attemptsPerSession = null;
    submissionsCount = 1;
    renderCard();
    expect(screen.getByText(/Отправок решения: 1 [(]без ограничения[)]/)).toBeInTheDocument();
  });

  it('без активной сессии строки с отправками нет', () => {
    sessionValue = null;
    attemptsPerSession = 5;
    renderCard();
    expect(screen.queryByText(/Отправок решения/)).not.toBeInTheDocument();
  });
});

describe('StudentExternalPractical: возврат из модуля', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('ожидает ACTIVE-результат с увеличивающимся интервалом опроса', () => {
    vi.useFakeTimers();
    const startedAt = new Date('2026-11-09T12:00:00Z');
    vi.setSystemTime(startedAt);
    moduleSessionResponse = {
      status: 200,
      data: {
        sessionId: 'return-1', status: 'ACTIVE', tryNumber: 1,
        startedAt: startedAt.toISOString(), expiresAt: null, endReason: null,
        grade: null, endedAt: null,
      },
    };

    renderCard('/?session=return-1');

    expect(screen.getByText('Попытка обрабатывается…')).toBeInTheDocument();
    const interval = moduleSessionOptions?.query?.refetchInterval;
    expect(interval?.({ state: { data: moduleSessionResponse } })).toBe(1_000);

    vi.setSystemTime(new Date(startedAt.getTime() + 6_000));
    expect(interval?.({ state: { data: moduleSessionResponse } })).toBe(2_000);

    vi.setSystemTime(new Date(startedAt.getTime() + 16_000));
    expect(interval?.({ state: { data: moduleSessionResponse } })).toBe(5_000);

    vi.setSystemTime(new Date(startedAt.getTime() + 40_000));
    expect(interval?.({ state: { data: moduleSessionResponse } })).toBe(false);
  });

  it('показывает принятую оценку для COMPLETED-сессии', () => {
    moduleSessionResponse = {
      status: 200,
      data: {
        sessionId: 'return-2', status: 'COMPLETED', tryNumber: 1,
        startedAt: '2026-11-09T12:00:00Z', expiresAt: null, endReason: 'completed',
        grade: 87, endedAt: '2026-11-09T12:10:00Z',
      },
    };

    renderCard('/?session=return-2');

    expect(screen.getByText('Попытка засчитана')).toBeInTheDocument();
    expect(screen.getByText('Оценка: 87')).toBeInTheDocument();
  });

  it('объясняет терминальное EXPIRED-состояние', () => {
    moduleSessionResponse = {
      status: 200,
      data: {
        sessionId: 'return-3', status: 'EXPIRED', tryNumber: 1,
        startedAt: '2026-11-09T12:00:00Z', expiresAt: '2026-11-09T12:30:00Z',
        endReason: 'timeout', grade: null, endedAt: '2026-11-09T12:30:00Z',
      },
    };

    renderCard('/?session=return-3');

    expect(screen.getByText('Попытка не завершена')).toBeInTheDocument();
    expect(screen.getByText('Время на попытку вышло.')).toBeInTheDocument();
  });

  it('отделяет ошибку Education API от ожидания обработки', () => {
    moduleSessionError = true;

    renderCard('/?session=return-4');

    expect(screen.getByText('Не удалось проверить результат')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(moduleSessionRefetch).toHaveBeenCalledTimes(1);
  });
});
