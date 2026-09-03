import { Button, SimpleGrid, Stack, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import { useGetStudentCourses } from '../../api/education/courses/courses';
import { formatCourseDate } from '../../entities';
import {
  AppCard,
  Page,
  PageBreadcrumbs,
  PageHeader,
  QueryBoundary,
} from '../../shared/ui';

export function StudentCoursesPage() {
  const coursesQuery = useGetStudentCourses({ query: { retry: false } });

  return (
    <Page>
      <PageBreadcrumbs items={[{ label: 'Главная', to: '/' }, { label: 'Студент' }, { label: 'Курсы' }]} />

      <PageHeader title="Мои курсы" description="Курсы, назначенные вам преподавателем." />

      <QueryBoundary
        isPending={coursesQuery.isPending}
        isError={coursesQuery.isError || coursesQuery.data?.status !== 200}
        data={coursesQuery.data?.status === 200 ? coursesQuery.data.data : undefined}
        errorTitle="Education API недоступен"
        emptyTitle="Курсов нет"
        emptyDescription="Вам пока не назначили ни одного курса."
        isEmpty={(rows) => rows.length === 0}
      >
        {(courses) => (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {courses.map((course) => (
              <AppCard key={course.id}>
                <Stack gap="xs" h="100%">
                  <Text fw={600}>{course.name}</Text>
                  <Text c="dimmed" size="xs">
                    {formatCourseDate(course.date)}
                  </Text>
                  <Text c="dimmed" size="sm" lineClamp={3}>
                    {course.description || 'Описание не заполнено.'}
                  </Text>
                  <Button
                    component={Link}
                    to={`/student/courses/${course.id}`}
                    size="xs"
                    mt="auto"
                  >
                    Открыть
                  </Button>
                </Stack>
              </AppCard>
            ))}
          </SimpleGrid>
        )}
      </QueryBoundary>
    </Page>
  );
}
