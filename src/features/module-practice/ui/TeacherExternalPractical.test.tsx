import { beforeEach, describe, expect, it, vi } from 'vitest';
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

describe('TeacherExternalPractical — authoring-link', () => {
  beforeEach(() => {
    mutateAsync.mockReset();
    vi.restoreAllMocks();
  });

  it('200 → открывает url модуля новой вкладкой с noopener', async () => {
    const user = userEvent.setup();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    mutateAsync.mockResolvedValue({
      status: 200,
      data: { url: 'http://localhost:5174/teacher/launch#access_token=T', expiresInSeconds: 900 },
    });

    renderCard();
    await user.click(screen.getByRole('button', { name: 'Открыть модуль для создания заданий' }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ practicalModuleId: 'mod-1' }));
    expect(open).toHaveBeenCalledWith(
      'http://localhost:5174/teacher/launch#access_token=T',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('409 → показывает ошибку, вкладку не открывает', async () => {
    const user = userEvent.setup();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    mutateAsync.mockResolvedValue({ status: 409, data: undefined });

    renderCard();
    await user.click(screen.getByRole('button', { name: 'Открыть модуль для создания заданий' }));

    expect(await screen.findByText('Модуль выключен — обратитесь к администратору.')).toBeInTheDocument();
    expect(open).not.toHaveBeenCalled();
  });

  it('502 → общее сообщение о недоступности', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'open').mockReturnValue(null);
    mutateAsync.mockResolvedValue({ status: 502, data: undefined });

    renderCard();
    await user.click(screen.getByRole('button', { name: 'Открыть модуль для создания заданий' }));

    expect(
      await screen.findByText('Модуль или IdentityService недоступны, попробуйте позже.'),
    ).toBeInTheDocument();
  });
});
