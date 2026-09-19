import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TeacherExternalPractical } from './TeacherExternalPractical';
import { renderWithProviders } from '../../../test/render';
import type { PracticalDetailResponse } from '../../../api/education/model';

// TAH-F2/F5: кнопка «Открыть модуль для создания заданий».

const mutateAsync = vi.fn();

vi.mock('../../../api/education/practical-modules/practical-modules', () => ({
  useCreatePracticalModuleAuthoringLink: () => ({ mutateAsync, isPending: false }),
  useGetEnabledPracticalModules: () => ({ data: undefined, isPending: false }),
  useGetPracticalModuleTasks: () => ({ data: undefined, isPending: false }),
}));

const detail: PracticalDetailResponse = {
  id: 'p-1',
  name: 'Практика',
  kind: 'external',
  isPublic: false,
  triesCount: 2,
  timeLimitMinutes: null,
  moduleBinding: {
    practicalModuleId: 'mod-1',
    practicalModuleSlug: 'sql',
    practicalModuleName: 'SQL',
    taskId: 't-1',
    externalTaskRef: 'sql-join-001',
  },
};

function renderCard() {
  return renderWithProviders(
    <TeacherExternalPractical practicalId="p-1" detail={detail} onChanged={vi.fn()} />,
  );
}

const BUTTON = 'Открыть задание в модуле';

describe('TeacherExternalPractical — authoring-link', () => {
  const originalLocation = window.location;
  const assign = vi.fn();

  beforeEach(() => {
    mutateAsync.mockReset();
    assign.mockReset();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { pathname: '/teacher/courses/c-1/practicals/p-1', search: '?tab=module', assign },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });

  it('200 → переходит в модуль в той же вкладке, передавая возврат и задание', async () => {
    const user = userEvent.setup();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    mutateAsync.mockResolvedValue({
      status: 200,
      data: { url: 'http://localhost:5174/teacher/launch?task=sql-join-001#access_token=T', expiresInSeconds: 900 },
    });

    renderCard();
    await user.click(screen.getByRole('button', { name: BUTTON }));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        practicalModuleId: 'mod-1',
        data: { returnPath: '/teacher/courses/c-1/practicals/p-1?tab=module', taskRef: 'sql-join-001' },
      }),
    );
    expect(assign).toHaveBeenCalledWith(
      'http://localhost:5174/teacher/launch?task=sql-join-001#access_token=T',
    );
    expect(open).not.toHaveBeenCalled();
  });

  it('409 → показывает ошибку, переход не выполняет', async () => {
    const user = userEvent.setup();
    mutateAsync.mockResolvedValue({ status: 409, data: undefined });

    renderCard();
    await user.click(screen.getByRole('button', { name: BUTTON }));

    expect(await screen.findByText('Модуль выключен — обратитесь к администратору.')).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
  });

  it('400 → просит обновить страницу, переход не выполняет', async () => {
    const user = userEvent.setup();
    mutateAsync.mockResolvedValue({ status: 400, data: {} });

    renderCard();
    await user.click(screen.getByRole('button', { name: BUTTON }));

    expect(
      await screen.findByText('Не удалось подготовить возврат на платформу, обновите страницу.'),
    ).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
  });

  it('502 → общее сообщение о недоступности', async () => {
    const user = userEvent.setup();
    mutateAsync.mockResolvedValue({ status: 502, data: undefined });

    renderCard();
    await user.click(screen.getByRole('button', { name: BUTTON }));

    expect(
      await screen.findByText('Модуль или IdentityService недоступны, попробуйте позже.'),
    ).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
  });
});
