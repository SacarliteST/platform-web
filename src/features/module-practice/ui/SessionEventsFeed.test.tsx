import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ModuleSessionEventResponse } from '../../../api/education/model';
import { renderWithProviders } from '../../../test/render';
import { SessionEventsFeed, sortEventsByTime } from './SessionEventsFeed';

let response: { status: number; data: ModuleSessionEventResponse[] } = { status: 200, data: [] };

vi.mock('../../../api/education/module-sessions/module-sessions', () => ({
  useGetModuleSessionEvents: () => ({
    data: response,
    isPending: false,
    isError: false,
  }),
}));

function event(overrides: Partial<ModuleSessionEventResponse>): ModuleSessionEventResponse {
  return {
    eventId: 'e',
    kind: 'sql_submit',
    occurredAt: '2026-10-18T10:00:00Z',
    payload: { isCorrect: false },
    ...overrides,
  };
}

function renderFeed() {
  return renderWithProviders(<SessionEventsFeed practicalId="p-1" sessionId="s-1" />);
}

describe('SessionEventsFeed', () => {
  beforeEach(() => {
    response = { status: 200, data: [] };
  });

  it('показывает markdown события, а JSON прячет под кнопку', async () => {
    response = {
      status: 200,
      data: [event({ eventId: 'e1', markdown: '**Попытка 1 — неверно**', payload: { isCorrect: false, rowCount: 12 } })],
    };
    renderFeed();

    expect(await screen.findByText('Попытка 1 — неверно')).toBeInTheDocument();
    expect(screen.queryByText(/"rowCount"/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Исходные данные (JSON)' }));
    expect(screen.getByText(/"rowCount": 12/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Скрыть исходные данные' }));
    expect(screen.queryByText(/"rowCount"/)).not.toBeInTheDocument();
  });

  it('без markdown — прежний вид: данные JSON видны сразу', async () => {
    response = { status: 200, data: [event({ eventId: 'e1', payload: { sql: 'SELECT 1' } })] };
    renderFeed();

    expect(await screen.findByText(/"sql": "SELECT 1"/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Исходные данные (JSON)' })).not.toBeInTheDocument();
  });

  it('пустой или пробельный markdown считается отсутствующим', async () => {
    response = { status: 200, data: [event({ eventId: 'e1', markdown: '  \n ', payload: { sql: 'SELECT 2' } })] };
    renderFeed();

    expect(await screen.findByText(/"sql": "SELECT 2"/)).toBeInTheDocument();
  });

  it('события идут по времени, итог после попыток', async () => {
    response = {
      status: 200,
      data: [
        event({ eventId: 'summary', kind: 'session_summary', occurredAt: '2026-10-18T10:05:00Z', markdown: '**Итог прохождения**' }),
        event({ eventId: 'a2', occurredAt: '2026-10-18T10:03:00Z', markdown: '**Попытка 2**' }),
        event({ eventId: 'a1', occurredAt: '2026-10-18T10:01:00Z', markdown: '**Попытка 1**' }),
      ],
    };
    const { container } = renderFeed();

    await screen.findByText('Итог прохождения');
    const text = container.textContent ?? '';
    expect(text.indexOf('Попытка 1')).toBeLessThan(text.indexOf('Попытка 2'));
    expect(text.indexOf('Попытка 2')).toBeLessThan(text.indexOf('Итог прохождения'));
  });

  it('404 — ничего не показывает', () => {
    response = { status: 404, data: [] };
    renderFeed();

    expect(screen.queryByText('Протокол попытки')).not.toBeInTheDocument();
    expect(screen.queryByText('Событий по этой попытке пока нет.')).not.toBeInTheDocument();
  });

  it('сообщение об отсутствии событий', async () => {
    renderFeed();

    expect(await screen.findByText('Событий по этой попытке пока нет.')).toBeInTheDocument();
  });
});

describe('sortEventsByTime', () => {
  it('сортирует по времени, при равенстве сохраняет серверный порядок, битую дату — в конец', () => {
    const sorted = sortEventsByTime([
      event({ eventId: 'bad', occurredAt: 'не дата' }),
      event({ eventId: 'later', occurredAt: '2026-10-18T12:00:00Z' }),
      event({ eventId: 'same-1', occurredAt: '2026-10-18T11:00:00Z' }),
      event({ eventId: 'same-2', occurredAt: '2026-10-18T11:00:00Z' }),
    ]);

    expect(sorted.map((item) => item.eventId)).toEqual(['same-1', 'same-2', 'later', 'bad']);
  });
});
