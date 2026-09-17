import { Button, SimpleGrid, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import { AppCard, Page, PageBreadcrumbs, PageHeader } from '../../shared/ui';

type TeacherLink = {
  title: string;
  description: string;
  to: string;
};

const teacherLinks: TeacherLink[] = [
  {
    title: 'Курсы',
    description: 'Управление учебными курсами и их наполнением.',
    to: '/teacher/courses',
  },
  {
    title: 'Практические модули',
    description: 'Наполнение внешних модулей темами, базами и заданиями — напрямую, без привязки к практике.',
    to: '/teacher/modules',
  },
];

export function TeacherHomePage() {
  return (
    <Page>
      <PageBreadcrumbs items={[{ label: 'Главная', to: '/' }, { label: 'Преподаватель' }]} />
      <PageHeader
        title="Преподаватель"
        description="Курсы, модули, теория, вопросы, практики и проверка сдач."
      />
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        {teacherLinks.map((item) => (
          <AppCard key={item.to}>
            <Text fw={600}>{item.title}</Text>
            <Text c="dimmed" mt="xs" size="sm">
              {item.description}
            </Text>
            <Button component={Link} to={item.to} mt="md" size="sm">
              Открыть
            </Button>
          </AppCard>
        ))}
      </SimpleGrid>
    </Page>
  );
}
