import { Button, SimpleGrid, Stack, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import { AdminContourTabs } from '../../features/admin-contour';
import { AppCard, Page, PageBreadcrumbs, PageHeader } from '../../shared/ui';

type AdminLink = {
  title: string;
  description: string;
  to: string;
};

const adminLinks: AdminLink[] = [
  {
    title: 'Пользователи',
    description: 'Поиск, создание, роли, блокировка — через IdentityService.',
    to: '/admin/users',
  },
  {
    title: 'Аудит',
    description: 'Журнал событий безопасности и активности пользователей.',
    to: '/admin/events',
  },
  {
    title: 'Учебные профили',
    description: 'Связывание identity-пользователей с локальными профилями платформы.',
    to: '/admin/profiles',
  },
  {
    title: 'Настройки',
    description: 'Адреса сервисов и состояние платформы.',
    to: '/admin/settings',
  },
];

export function AdminHomePage() {
  return (
    <Page>
      <PageBreadcrumbs items={[{ label: 'Главная', to: '/' }, { label: 'Администратор' }]} />

      <Stack gap="md">
        <PageHeader
          title="Администратор"
          description="Управление учётными записями, учебными профилями и состоянием платформы."
        />
        <AdminContourTabs />
      </Stack>

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        {adminLinks.map((item) => (
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
