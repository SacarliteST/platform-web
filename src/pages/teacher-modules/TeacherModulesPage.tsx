import { Alert, Badge, Button, SimpleGrid, Stack, Text } from '@mantine/core';
import { useGetEnabledPracticalModules } from '../../api/education/practical-modules/practical-modules';
import { useOpenModuleAuthoring } from '../../features/module-practice/model/use-open-module-authoring';
import { AppCard, Page, PageBreadcrumbs, PageHeader, QueryBoundary } from '../../shared/ui';

export function TeacherModulesPage() {
  const modulesQuery = useGetEnabledPracticalModules({ query: { retry: false } });
  const authoring = useOpenModuleAuthoring();
  const { error, openingId } = authoring;
  const openModule = (practicalModuleId: string) => authoring.open(practicalModuleId);

  return (
    <Page>
      <PageBreadcrumbs items={[{ label: 'Главная', to: '/' }, { label: 'Преподаватель' }, { label: 'Модули' }]} />

      <PageHeader
        title="Практические модули"
        description="Откройте модуль напрямую, чтобы наполнить его темами и заданиями — без привязки к конкретной практике."
      />

      {error ? (
        <Alert color="red" variant="light" title="Не удалось открыть модуль">
          {error}
        </Alert>
      ) : null}

      <QueryBoundary
        isPending={modulesQuery.isPending}
        isError={modulesQuery.isError || modulesQuery.data?.status !== 200}
        data={modulesQuery.data?.status === 200 ? modulesQuery.data.data : undefined}
        errorTitle="Education API недоступен"
        emptyTitle="Модулей нет"
        emptyDescription="Обратитесь к администратору, чтобы зарегистрировать внешний модуль."
        isEmpty={(rows) => rows.length === 0}
      >
        {(modules) => (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {modules
              .filter((module) => module.isEnabled)
              .map((module) => (
                <AppCard key={module.id}>
                  <Stack gap="xs" h="100%">
                    <Badge radius="sm" variant="light" w="fit-content">
                      {module.slug}
                    </Badge>
                    <Text fw={600}>{module.name}</Text>
                    <Text c="dimmed" size="sm" lineClamp={3}>
                      {module.description || 'Описание не заполнено.'}
                    </Text>
                    <Button
                      size="xs"
                      mt="auto"
                      w="fit-content"
                      loading={openingId === module.id}
                      onClick={() => openModule(module.id)}
                    >
                      Открыть модуль
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
