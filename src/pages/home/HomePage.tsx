import { Button, SimpleGrid, Text } from '@mantine/core';
import { Link, Navigate } from 'react-router-dom';
import { useSessionStore, type UserRole } from '../../session';
import { AppCard, EmptyState, Page, PageHeader } from '../../shared/ui';

type ContourCard = {
  role: UserRole;
  title: string;
  description: string;
  to: string;
};

const contours: ContourCard[] = [
  {
    role: 'Admin',
    title: 'Администратор',
    description: 'Управление учётными записями, ролями, учебными профилями и состоянием сервисов.',
    to: '/admin',
  },
  {
    role: 'Teacher',
    title: 'Преподаватель',
    description: 'Курсы, модули, теория, банк вопросов, практики, задания и проверка сдач.',
    to: '/teacher',
  },
  {
    role: 'Student',
    title: 'Студент',
    description: 'Назначенные курсы, теория, прохождение тестов, сдача заданий и протоколы.',
    to: '/student',
  },
];

function canOpenContour(userRoles: UserRole[], contourRole: UserRole): boolean {
  return userRoles.includes('Admin') || userRoles.includes(contourRole);
}

export function HomePage() {
  const status = useSessionStore((state) => state.status);
  const user = useSessionStore((state) => state.user);
  const availableContours = contours.filter((contour) =>
    canOpenContour(user?.roles ?? [], contour.role),
  );

  if (status !== 'authenticated') {
    // Неавторизованный визит на / — сразу форма входа, без промежуточной карточки.
    return <Navigate to="/login" replace />;
  }

  return (
    <Page>
      <PageHeader title="Scoodle" description="Выберите доступный контур работы." />

      {availableContours.length > 0 ? (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {availableContours.map((contour) => (
            <AppCard key={contour.to}>
              <Text fw={600}>{contour.title}</Text>
              <Text c="dimmed" mt="xs" size="sm">
                {contour.description}
              </Text>
              <Button component={Link} mt="md" size="sm" to={contour.to}>
                Открыть
              </Button>
            </AppCard>
          ))}
        </SimpleGrid>
      ) : (
        <AppCard>
          <EmptyState
            title="Нет доступных контуров"
            description="В токене пользователя нет роли Admin, Teacher или Student."
          />
        </AppCard>
      )}
    </Page>
  );
}
