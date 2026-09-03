import { Button, SimpleGrid, Stack, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import { AdminContourTabs } from '../../features/admin-contour';
import { AppCard, Page, PageBreadcrumbs, PageHeader } from '../../shared/ui';

type AdminLink = {
  title: string;
  description: string;
  to: string;
  ready: boolean;
};

const adminLinks: AdminLink[] = [
  {
    title: 'Пользователи',
    description: 'Поиск, создание, роли, блокировка — через IdentityService.',
    to: '/admin/users',
    ready: true,
  },
  {
    title: 'Аудит',
    description: 'Журнал событий безопасности и активности пользователей.',
    to: '/admin/events',
    ready: false,
  },
  {
    title: 'Учебные профили',
    description: 'Связывание identity-пользователей с локальными профилями платформы.',
    to: '/admin/profiles',
    ready: false,
  },
  {
    title: 'Настройки',
    description: 'Адреса сервисов и состояние платформы.',
    to: '/admin/settings',
    ready: false,
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
            <Button
              component={Link}
              to={item.to}
              mt="md"
              size="sm"
              variant={item.ready ? 'filled' : 'default'}
            >
              {item.ready ? 'Открыть' : 'В разработке'}
            </Button>
          </AppCard>
        ))}
      </SimpleGrid>
    </Page>
  );
}
