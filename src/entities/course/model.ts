import type { CourseResponse } from '../../api/education/model';

export type Course = CourseResponse;

const dateFormatter = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium' });

export function formatCourseDate(value: string | null | undefined): string {
  if (!value) {
    return 'Дата не указана';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}
