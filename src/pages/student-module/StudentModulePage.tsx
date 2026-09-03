import { Badge, Button, Group, Table, Tabs, Text } from '@mantine/core';
import { Link, useParams } from 'react-router-dom';
import { useGetStudentCourses, useGetCourseModules } from '../../api/education/courses/courses';
import { useGetModuleTheories } from '../../api/education/modules/modules';
import { useGetModulePracticals } from '../../api/education/practicals/practicals';
import { useGetPracticalGrade } from '../../api/education/grades/grades';
import { formatGrade, normalizePracticalGrade } from '../../entities';
import {
  AppCard,
  Page,
  PageBreadcrumbs,
  PageHeader,
  QueryBoundary,
} from '../../shared/ui';

export function StudentModulePage() {
  const { courseId = '', moduleId = '' } = useParams();

  const coursesQuery = useGetStudentCourses({ query: { retry: false } });
  const modulesQuery = useGetCourseModules(courseId, {
    query: { enabled: Boolean(courseId), retry: false },
  });
  const theoriesQuery = useGetModuleTheories(moduleId, {
    query: { enabled: Boolean(moduleId), retry: false },
  });
  const practicalsQuery = useGetModulePracticals(moduleId, {
    query: { enabled: Boolean(moduleId), retry: false },
  });

  const courseTitle =
    coursesQuery.data?.status === 200
      ? coursesQuery.data.data.find((item) => item.id === courseId)?.name
      : undefined;
  const module =
    modulesQuery.data?.status === 200
      ? modulesQuery.data.data.find((item) => item.id === moduleId)
      : undefined;

  const base = `/student/courses/${courseId}/modules/${moduleId}`;

  return (
    <Page>
      <PageBreadcrumbs
        items={[
          { label: 'Главная', to: '/' },
          { label: 'Студент', to: '/student/courses' },
          { label: courseTitle ?? 'Курс', to: `/student/courses/${courseId}` },
          { label: module?.name ?? 'Модуль' },
        ]}
      />

      <Group justify="space-between" align="flex-end" gap="md" wrap="wrap">
        <PageHeader title={module?.name ?? 'Модуль'} description="Теория и практики модуля." />
        <Button component={Link} to={`/student/courses/${courseId}`} size="sm" variant="outline">
          К курсу
        </Button>
      </Group>

      <Tabs defaultValue="theory">
        <Tabs.List>
          <Tabs.Tab value="theory">Теория</Tabs.Tab>
          <Tabs.Tab value="practicals">Практики</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="theory" pt="md">
          <AppCard p={0}>
            <QueryBoundary
              isPending={theoriesQuery.isPending}
              isError={theoriesQuery.isError || theoriesQuery.data?.status !== 200}
              data={theoriesQuery.data?.status === 200 ? theoriesQuery.data.data : undefined}
              errorTitle="Education API недоступен"
              emptyTitle="Теории нет"
              emptyDescription="В этом модуле пока нет теоретических материалов."
              isEmpty={(rows) => rows.length === 0}
            >
              {(rows) => (
                <Table striped highlightOnHover withTableBorder withColumnBorders>
                  <Table.Tbody>
                    {rows.map((theory) => (
                      <Table.Tr key={theory.id}>
                        <Table.Td>
                          <Text size="sm">{theory.name}</Text>
                        </Table.Td>
                        <Table.Td w={140}>
                          <Button
                            component={Link}
                            to={`${base}/theories/${theory.id}`}
                            size="xs"
                            variant="subtle"
                          >
                            Читать
                          </Button>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}
            </QueryBoundary>
          </AppCard>
        </Tabs.Panel>

        <Tabs.Panel value="practicals" pt="md">
          <AppCard p={0}>
            <QueryBoundary
              isPending={practicalsQuery.isPending}
              isError={practicalsQuery.isError || practicalsQuery.data?.status !== 200}
              data={practicalsQuery.data?.status === 200 ? practicalsQuery.data.data : undefined}
              errorTitle="Education API недоступен"
              emptyTitle="Практик нет"
              emptyDescription="В этом модуле пока нет практик."
              isEmpty={(rows) => rows.length === 0}
            >
              {(rows) => (
                <Table striped highlightOnHover withTableBorder withColumnBorders>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Практика</Table.Th>
                      <Table.Th w={160}>Итоговая оценка</Table.Th>
                      <Table.Th w={140}>Действия</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {rows.map((practical) => (
                      <Table.Tr key={practical.id}>
                        <Table.Td>
                          <Text size="sm">{practical.name}</Text>
                        </Table.Td>
                        <Table.Td>
                          <PracticalGradeBadge practicalId={practical.id} />
                        </Table.Td>
                        <Table.Td>
                          <Button
                            component={Link}
                            to={`${base}/practicals/${practical.id}`}
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
        </Tabs.Panel>
      </Tabs>
    </Page>
  );
}

function PracticalGradeBadge({ practicalId }: { practicalId: string }) {
  const gradeQuery = useGetPracticalGrade(practicalId, {
    query: { enabled: Boolean(practicalId), retry: false },
  });

  if (gradeQuery.isPending) {
    return (
      <Text c="dimmed" size="xs">
        …
      </Text>
    );
  }
  if (gradeQuery.data?.status !== 200) {
    return (
      <Text c="dimmed" size="xs">
        —
      </Text>
    );
  }

  const grade = normalizePracticalGrade(gradeQuery.data.data);
  return (
    <Badge color={grade.grade === null ? 'gray' : 'green'} radius="sm" variant="light">
      {grade.grade === null ? 'Нет оценки' : formatGrade(grade.grade)}
    </Badge>
  );
}
