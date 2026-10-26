import { Alert, Button, SimpleGrid, Stack, Text } from '@mantine/core';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useCreateTrainingLink,
  useGetTrainingModules,
} from '../../api/education/practical-modules/practical-modules';
import type { TrainingModuleResponse } from '../../api/education/model';
import { trainingLinkErrorMessage } from '../../features/training-bank';
import { AppCard, Page, PageBreadcrumbs, PageHeader, QueryBoundary } from '../../shared/ui';

/** Куда модуль вернёт студента кнопкой «На платформу». */
const RETURN_PATH = '/student/training';

export function StudentTrainingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const modulesQuery = useGetTrainingModules({ query: { retry: false } });
  const createLink = useCreateTrainingLink();
  const [error, setError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const relaunchHandled = useRef(false);

  const modules = modulesQuery.data?.status === 200 ? modulesQuery.data.data : undefined;

  const open = async (module: TrainingModuleResponse) => {
    setError(null);
    setOpeningId(module.id);
    const response = await createLink
      .mutateAsync({ practicalModuleId: module.id, data: { returnPath: RETURN_PATH } })
      .catch(() => null);

    if (!response) {
      setError('Education API недоступен. Попробуйте позже.');
      setOpeningId(null);
      return;
    }
    if (response.status === 200) {
      // Не window.open: после асинхронного запроса браузер блокирует всплывающие окна.
      window.location.assign(response.data.url);
      return;
    }
    setError(trainingLinkErrorMessage(response.status, response.data));
    setOpeningId(null);
  };

  // Модуль при просроченном токене присылает студента с ?relaunch=<slug>: один раз выдаём ссылку заново.
  useEffect(() => {
    const slug = searchParams.get('relaunch');
    if (!slug || !modules || relaunchHandled.current) {
      return;
    }
    relaunchHandled.current = true;
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.delete('relaunch');
      return next;
    }, { replace: true });
    const module = modules.find((item) => item.slug === slug);
    if (module) {
      void open(module);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modules, searchParams]);

  return (
    <Page>
      <PageBreadcrumbs
        items={[
          { label: 'Главная', to: '/' },
          { label: 'Студент', to: '/student' },
          { label: 'Банк заданий' },
        ]}
      />
      <PageHeader
        title="Банк заданий"
        description="Самостоятельная тренировка: решайте любые задания из открытого банка. Результаты не влияют на оценки курса."
      />

      {error ? (
        <Alert color="red" variant="light" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : null}

      <QueryBoundary
        isPending={modulesQuery.isPending}
        isError={modulesQuery.isError || modulesQuery.data?.status !== 200}
        data={modules}
        errorTitle="Education API недоступен"
        emptyTitle="Банк заданий пока не подключён"
        emptyDescription="Когда преподаватели откроют задания, здесь появится вход в банк."
        isEmpty={(rows) => rows.length === 0}
      >
        {(rows) => (
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            {rows.map((module) => (
              <AppCard key={module.id}>
                <Stack gap="xs" h="100%">
                  <Text fw={600}>{module.name}</Text>
                  <Text c="dimmed" size="sm" lineClamp={3}>
                    {module.description || 'Описание не заполнено.'}
                  </Text>
                  <Button
                    mt="auto"
                    size="sm"
                    onClick={() => void open(module)}
                    loading={openingId === module.id}
                    disabled={openingId !== null && openingId !== module.id}
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
