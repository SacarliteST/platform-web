import {
  Alert,
  Button,
  Group,
  Modal,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import {
  useCreateCourse,
  useDeleteCourse,
  useGetTeacherCourses,
} from '../../api/education/courses/courses';
import { formatCourseDate } from '../../entities';
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

const courseSchema = z.object({
  name: z.string().trim().min(1, 'Укажите название курса').max(200),
  description: z.string().trim().max(2000).optional(),
});

type CourseFormValues = z.infer<typeof courseSchema>;

export function TeacherCoursesPage() {
  const coursesQuery = useGetTeacherCourses({ query: { retry: false } });
  const createMutation = useCreateCourse();
  const deleteMutation = useDeleteCourse();

  const [createOpened, createModal] = useDisclosure(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const form = useForm<CourseFormValues>({
    resolver: zodResolver(courseSchema),
    defaultValues: { name: '', description: '' },
  });

  const submitCreate = form.handleSubmit(async (values) => {
    setCreateError(null);
    const response = await createMutation
      .mutateAsync({
        data: {
          name: values.name.trim(),
          description: values.description?.trim() ?? '',
          date: new Date().toISOString(),
        },
      })
      .catch(() => null);

    if (!response) {
      setCreateError('Education API недоступен.');
      return;
    }
    if (response.status === 200) {
      await coursesQuery.refetch();
      form.reset();
      createModal.close();
      return;
    }
    setCreateError(
      response.data && typeof response.data === 'object'
        ? getEducationProblemMessage(response.data, response.status)
        : 'Не удалось создать курс.',
    );
  });

  const confirmDelete = async () => {
    if (!deleteTarget) {
      return;
    }
    await deleteMutation.mutateAsync({ courseId: deleteTarget.id }).catch(() => null);
    await coursesQuery.refetch();
    setDeleteTarget(null);
  };

  return (
    <Page>
      <PageBreadcrumbs items={[{ label: 'Главная', to: '/' }, { label: 'Преподаватель' }, { label: 'Курсы' }]} />

      <Group justify="space-between" align="flex-end" gap="md" wrap="wrap">
        <PageHeader title="Курсы" description="Учебные курсы, созданные вами." />
        <Button
          size="sm"
          onClick={() => {
            form.reset();
            setCreateError(null);
            createModal.open();
          }}
        >
          Создать курс
        </Button>
      </Group>

      <QueryBoundary
        isPending={coursesQuery.isPending}
        isError={coursesQuery.isError || coursesQuery.data?.status !== 200}
        data={coursesQuery.data?.status === 200 ? coursesQuery.data.data : undefined}
        errorTitle="Education API недоступен"
        emptyTitle="Курсов пока нет"
        emptyDescription="Создайте первый курс."
        isEmpty={(rows) => rows.length === 0}
      >
        {(courses) => (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {courses.map((course) => (
              <AppCard key={course.id}>
                <Stack gap="xs" h="100%">
                  <Text fw={600}>{course.name}</Text>
                  <Text c="dimmed" size="xs">
                    {formatCourseDate(course.date)}
                  </Text>
                  <Text c="dimmed" size="sm" lineClamp={3}>
                    {course.description || 'Описание не заполнено.'}
                  </Text>
                  <Group gap="xs" mt="auto" pt="sm">
                    <Button component={Link} to={`/teacher/courses/${course.id}`} size="xs">
                      Открыть
                    </Button>
                    <Button
                      size="xs"
                      color="red"
                      variant="subtle"
                      onClick={() => setDeleteTarget({ id: course.id, name: course.name })}
                    >
                      Удалить
                    </Button>
                  </Group>
                </Stack>
              </AppCard>
            ))}
          </SimpleGrid>
        )}
      </QueryBoundary>

      <Modal opened={createOpened} onClose={createModal.close} title="Создать курс" centered>
        <form onSubmit={submitCreate}>
          <Stack gap="md">
            {createError ? (
              <Alert color="red" variant="light" title="Не удалось создать">
                {createError}
              </Alert>
            ) : null}
            <TextInput
              label="Название"
              withAsterisk
              error={form.formState.errors.name?.message}
              {...form.register('name')}
            />
            <Textarea
              label="Описание"
              autosize
              minRows={3}
              error={form.formState.errors.description?.message}
              {...form.register('description')}
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
        title="Удалить курс"
        message={`Курс «${deleteTarget?.name ?? ''}» и всё его содержимое будут удалены.`}
        confirmLabel="Удалить"
        loading={deleteMutation.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </Page>
  );
}
