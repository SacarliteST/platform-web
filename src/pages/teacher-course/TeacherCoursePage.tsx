import {
  Alert,
  Button,
  Group,
  Modal,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  useCreateModule,
  useDeleteModule,
} from '../../api/education/modules/modules';
import {
  useGetCourseModules,
  useGetTeacherCourses,
} from '../../api/education/courses/courses';
import { getEducationProblemMessage } from '../../shared/lib';
import {
  AppCard,
  ConfirmModal,
  FormActions,
  Page,
  PageBreadcrumbs,
  PageHeader,
  QueryBoundary,
} from '../../shared/ui';

export function TeacherCoursePage() {
  const { courseId = '' } = useParams();
  const coursesQuery = useGetTeacherCourses({ query: { retry: false } });
  const modulesQuery = useGetCourseModules(courseId, {
    query: { enabled: Boolean(courseId), retry: false },
  });
  const createMutation = useCreateModule();
  const deleteMutation = useDeleteModule();

  const [createOpened, createModal] = useDisclosure(false);
  const [name, setName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const course =
    coursesQuery.data?.status === 200
      ? coursesQuery.data.data.find((item) => item.id === courseId)
      : undefined;
  const courseTitle = course?.name ?? 'Курс';

  const submitCreate = async () => {
    setCreateError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setCreateError('Укажите название модуля.');
      return;
    }
    const response = await createMutation
      .mutateAsync({ data: { courseId, name: trimmed } })
      .catch(() => null);

    if (!response) {
      setCreateError('Education API недоступен.');
      return;
    }
    if (response.status === 200) {
      await modulesQuery.refetch();
      setName('');
      createModal.close();
      return;
    }
    setCreateError(
      response.data && typeof response.data === 'object'
        ? getEducationProblemMessage(response.data, response.status)
        : 'Не удалось создать модуль.',
    );
  };

  const confirmDelete = async () => {
    if (!deleteTarget) {
      return;
    }
    await deleteMutation.mutateAsync({ moduleId: deleteTarget.id }).catch(() => null);
    await modulesQuery.refetch();
    setDeleteTarget(null);
  };

  return (
    <Page>
      <PageBreadcrumbs
        items={[
          { label: 'Главная', to: '/' },
          { label: 'Преподаватель', to: '/teacher/courses' },
          { label: 'Курсы', to: '/teacher/courses' },
          { label: courseTitle },
        ]}
      />

      <Group justify="space-between" align="flex-end" gap="md" wrap="wrap">
        <PageHeader title={courseTitle} description={course?.description || 'Модули курса.'} />
        <Group gap="xs">
          <Button component={Link} to="/teacher/courses" size="sm" variant="outline">
            К курсам
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setName('');
              setCreateError(null);
              createModal.open();
            }}
          >
            Создать модуль
          </Button>
        </Group>
      </Group>

      <AppCard p={0}>
        <QueryBoundary
          isPending={modulesQuery.isPending}
          isError={modulesQuery.isError || modulesQuery.data?.status !== 200}
          data={modulesQuery.data?.status === 200 ? modulesQuery.data.data : undefined}
          errorTitle="Education API недоступен"
          emptyTitle="Модулей нет"
          emptyDescription="Добавьте первый модуль курса."
          isEmpty={(rows) => rows.length === 0}
        >
          {(modules) => (
            <Table striped highlightOnHover withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Модуль</Table.Th>
                  <Table.Th w={220}>Действия</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {modules.map((module) => (
                  <Table.Tr key={module.id}>
                    <Table.Td>
                      <Text size="sm">{module.name}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs" wrap="nowrap">
                        <Button
                          component={Link}
                          to={`/teacher/modules/${module.id}`}
                          size="xs"
                          variant="subtle"
                        >
                          Открыть
                        </Button>
                        <Button
                          size="xs"
                          color="red"
                          variant="subtle"
                          onClick={() => setDeleteTarget({ id: module.id, name: module.name })}
                        >
                          Удалить
                        </Button>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </QueryBoundary>
      </AppCard>

      <Modal opened={createOpened} onClose={createModal.close} title="Создать модуль" centered>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submitCreate();
          }}
        >
          <Stack gap="md">
            {createError ? (
              <Alert color="red" variant="light" title="Не удалось создать">
                {createError}
              </Alert>
            ) : null}
            <TextInput
              label="Название модуля"
              withAsterisk
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
            />
            <FormActions
              submitLabel="Создать"
              loading={createMutation.isPending}
              onCancel={createModal.close}
            />
          </Stack>
        </form>
      </Modal>

      <ConfirmModal
        opened={deleteTarget !== null}
        title="Удалить модуль"
        message={`Модуль «${deleteTarget?.name ?? ''}» и всё его содержимое будут удалены.`}
        confirmLabel="Удалить"
        loading={deleteMutation.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </Page>
  );
}
