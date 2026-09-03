import { Button, Group, Table, Text } from '@mantine/core';
import { Link, useParams } from 'react-router-dom';
import {
  useGetCourseModules,
  useGetStudentCourses,
} from '../../api/education/courses/courses';
import {
  AppCard,
  Page,
  PageBreadcrumbs,
  PageHeader,
  QueryBoundary,
} from '../../shared/ui';

export function StudentCoursePage() {
  const { courseId = '' } = useParams();
  const coursesQuery = useGetStudentCourses({ query: { retry: false } });
  const modulesQuery = useGetCourseModules(courseId, {
    query: { enabled: Boolean(courseId), retry: false },
  });

  const course =
    coursesQuery.data?.status === 200
      ? coursesQuery.data.data.find((item) => item.id === courseId)
      : undefined;
  const courseTitle = course?.name ?? 'Курс';

  return (
    <Page>
      <PageBreadcrumbs
        items={[
          { label: 'Главная', to: '/' },
          { label: 'Студент', to: '/student/courses' },
          { label: 'Курсы', to: '/student/courses' },
          { label: courseTitle },
        ]}
      />

      <Group justify="space-between" align="flex-end" gap="md" wrap="wrap">
        <PageHeader title={courseTitle} description={course?.description || 'Модули курса.'} />
        <Button component={Link} to="/student/courses" size="sm" variant="outline">
          К курсам
        </Button>
      </Group>

      <AppCard p={0}>
        <QueryBoundary
          isPending={modulesQuery.isPending}
          isError={modulesQuery.isError || modulesQuery.data?.status !== 200}
          data={modulesQuery.data?.status === 200 ? modulesQuery.data.data : undefined}
          errorTitle="Education API недоступен"
          emptyTitle="Модулей нет"
          emptyDescription="В этом курсе пока нет модулей."
          isEmpty={(rows) => rows.length === 0}
        >
          {(modules) => (
            <Table striped highlightOnHover withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Модуль</Table.Th>
                  <Table.Th w={160}>Действия</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {modules.map((module) => (
                  <Table.Tr key={module.id}>
                    <Table.Td>
                      <Text size="sm">{module.name}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Button
                        component={Link}
                        to={`/student/courses/${courseId}/modules/${module.id}`}
                        size="xs"
                        variant="subtle"
                      >
                        Открыть
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </QueryBoundary>
      </AppCard>
    </Page>
  );
}
