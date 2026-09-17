import { Button, SimpleGrid, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import { AppCard, Page, PageBreadcrumbs, PageHeader } from '../../shared/ui';

type StudentLink = {
  title: string;
  description: string;
  to: string;
};

const studentLinks: StudentLink[] = [
  {
    title: 'Мои курсы',
    description: 'Назначенные курсы, теория, тесты, сдача заданий и протоколы.',
    to: '/student/courses',
  },
];

export function StudentHomePage() {
  return (
    <Page>
      <PageBreadcrumbs items={[{ label: 'Главная', to: '/' }, { label: 'Студент' }]} />
      <PageHeader
        title="Студент"
        description="Назначенные курсы, теория, тесты, сдача заданий и протоколы."
      />
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        {studentLinks.map((item) => (
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
