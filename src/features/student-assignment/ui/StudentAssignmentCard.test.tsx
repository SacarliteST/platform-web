import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StudentAssignmentCard } from './StudentAssignmentCard';
import { renderWithProviders } from '../../../test/render';
import type { StudentAssignmentPageResponse } from '../../../api/education/model';

const changeCourse = vi.fn();
const fetchCoursePage = vi.fn();
let pageData: StudentAssignmentPageResponse;

vi.mock('../../../api/education/admin-profiles/admin-profiles', () => ({
  getCourseStudentAssignments: (...args: unknown[]) => fetchCoursePage(...args),
  getPracticalStudentAssignments: vi.fn(),
  getGetCourseStudentAssignmentsQueryKey: (id: string) => ['course-students', id],
  getGetPracticalStudentAssignmentsQueryKey: (id: string) => ['practical-students', id],
  useGetCourseStudentAssignments: () => ({
    data: { status: 200, data: pageData },
    isPending: false,
    isError: false,
  }),
  useGetPracticalStudentAssignments: () => ({ data: undefined, isPending: false, isError: false }),
  useChangeCourseStudents: () => ({ mutateAsync: changeCourse, isPending: false }),
  useChangePracticalStudents: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const ann = { legacyUserId: 'a', fullName: 'Иванова Анна ', login: 'ivanova', isAssigned: true };
const bob = { legacyUserId: 'b', fullName: 'Петров Борис ', login: 'petrov', isAssigned: false };

function page(overrides: Partial<StudentAssignmentPageResponse> = {}): StudentAssignmentPageResponse {
  return { items: [ann, bob], totalCount: 2, assignedCount: 1, page: 1, pageSize: 20, ...overrides };
}

describe('StudentAssignmentCard', () => {
  beforeEach(() => {
    changeCourse.mockReset();
    fetchCoursePage.mockReset();
    pageData = page();
  });

  it('показывает студентов с логином и счётчиком назначенных', () => {
    renderWithProviders(<StudentAssignmentCard kind="course" id="c-1" />);

    expect(screen.getByText('Иванова Анна')).toBeInTheDocument();
    expect(screen.getByText('petrov')).toBeInTheDocument();
    expect(screen.getByText('Назначено: 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
  });

  it('копит правки и отправляет их одним запросом «добавить / убрать»', async () => {
    changeCourse.mockResolvedValue({ status: 204, data: undefined });
    const user = userEvent.setup();
    renderWithProviders(<StudentAssignmentCard kind="course" id="c-1" />);

    await user.click(screen.getByLabelText('Назначить: Петров Борис'));
    await user.click(screen.getByLabelText('Назначить: Иванова Анна'));

    expect(screen.getByText('Изменения: назначить 1, снять 1')).toBeInTheDocument();
    expect(screen.getByText('Назначено: 1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() =>
      expect(changeCourse).toHaveBeenCalledWith({ courseId: 'c-1', data: { add: ['b'], remove: ['a'] } }),
    );
    expect(await screen.findByText('Список студентов сохранён.')).toBeInTheDocument();
    expect(screen.getByText('Изменений нет')).toBeInTheDocument();
  });

  it('«Сбросить» отменяет несохранённые правки', async () => {
    const user = userEvent.setup();
    renderWithProviders(<StudentAssignmentCard kind="course" id="c-1" />);

    await user.click(screen.getByLabelText('Назначить: Петров Борис'));
    await user.click(screen.getByRole('button', { name: 'Сбросить' }));

    expect(screen.getByText('Изменений нет')).toBeInTheDocument();
    expect(changeCourse).not.toHaveBeenCalled();
  });

  it('«Назначить всех найденных» собирает все страницы и просит подтверждение', async () => {
    pageData = page({ items: [bob], totalCount: 250, assignedCount: 0 });
    fetchCoursePage
      .mockResolvedValueOnce({
        status: 200,
        data: page({
          items: Array.from({ length: 200 }, (_, index) => ({
            legacyUserId: `s${index}`, fullName: `Студент ${index}`, login: `s${index}`, isAssigned: false,
          })),
          totalCount: 250,
        }),
      })
      .mockResolvedValueOnce({
        status: 200,
        data: page({
          items: Array.from({ length: 50 }, (_, index) => ({
            legacyUserId: `t${index}`, fullName: `Студент t${index}`, login: `t${index}`, isAssigned: false,
          })),
          totalCount: 250,
        }),
      });
    const user = userEvent.setup();
    renderWithProviders(<StudentAssignmentCard kind="course" id="c-1" />);

    await user.click(screen.getByRole('button', { name: /Назначить всех найденных/ }));

    expect(await screen.findByText(/Будут назначены 250 студентов/)).toBeInTheDocument();
    expect(fetchCoursePage).toHaveBeenCalledTimes(2);

    await user.click(screen.getByRole('button', { name: 'Назначить' }));
    expect(screen.getByText('Изменения: назначить 250, снять 0')).toBeInTheDocument();
  });

  it('показывает ошибку, если сервер отказал в сохранении', async () => {
    changeCourse.mockResolvedValue({ status: 403, data: undefined });
    const user = userEvent.setup();
    renderWithProviders(<StudentAssignmentCard kind="course" id="c-1" />);

    await user.click(screen.getByLabelText('Назначить: Петров Борис'));
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(await screen.findByText(/принадлежат другому преподавателю/)).toBeInTheDocument();
    // правки не потеряны — их можно повторить
    expect(screen.getByText('Изменения: назначить 1, снять 0')).toBeInTheDocument();
  });
});
