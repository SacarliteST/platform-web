import { Button, Group } from '@mantine/core';
import { Link, useParams } from 'react-router-dom';
import { useGetTeacherCourses } from '../../api/education/courses/courses';
import { useGetCourseGradebook } from '../../api/education/grades/grades';
import { GradebookTable } from '../../features/teacher-results';
import { AppCard, Page, PageBreadcrumbs, PageHeader, QueryBoundary } from '../../shared/ui';

export function TeacherGradebookPage() {
  const { courseId = '' } = useParams();
  const coursesQuery = useGetTeacherCourses({ query: { retry: false } });
  const bookQuery = useGetCourseGradebook(courseId, { query: { enabled: Boolean(courseId), retry: false } });
  const course =
    coursesQuery.data?.status === 200 ? coursesQuery.data.data.find((item) => item.id === courseId) : undefined;
  const courseTitle = course?.name ?? 'Курс';

  return (
    <Page>
      <PageBreadcrumbs
        items={[
          { label: 'Главная', to: '/' },
          { label: 'Преподаватель', to: '/teacher/courses' },
          { label: 'Курсы', to: '/teacher/courses' },
          { label: courseTitle, to: `/teacher/courses/${courseId}` },
          { label: 'Ведомость' },
        ]}
      />
      <Group justify="space-between" align="flex-end" gap="md" wrap="wrap">
        <PageHeader title="Ведомость курса" description={`${courseTitle}: кто прошёл практики и какие получил оценки.`} />
        <Button component={Link} to={`/teacher/courses/${courseId}`} size="sm" variant="outline">
          К курсу
        </Button>
      </Group>
      <AppCard p={0}>
        <QueryBoundary
          isPending={bookQuery.isPending}
          isError={bookQuery.isError || bookQuery.data?.status !== 200}
          data={bookQuery.data?.status === 200 ? bookQuery.data.data : undefined}
          errorTitle="Не удалось загрузить ведомость"
          emptyTitle="Студентов нет"
          emptyDescription="Назначьте студентов на курс или его практики."
          isEmpty={(book) => book.students.length === 0 || book.practicals.length === 0}
        >
          {(book) => <GradebookTable book={book} fileName={`gradebook-${courseTitle}.csv`} />}
        </QueryBoundary>
      </AppCard>
    </Page>
  );
}
