import { Badge, Button, Group, Modal, Select, Stack, Table, Tabs, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useGetModule, useGetModuleTheories } from '../../api/education/modules/modules';
import {
  useCreateTheory,
  useDeleteTheory,
} from '../../api/education/theories/theories';
import {
  useCreatePractical,
  useDeletePractical,
  useGetModulePracticals,
} from '../../api/education/practicals/practicals';
import {
  useCreateQuestion,
  useDeleteQuestion,
  useGetModuleQuestions,
  useUpdateQuestion,
} from '../../api/education/questions/questions';
import {
  QUESTION_KIND_LABELS,
  QUESTION_KIND_OPTIONS,
  normalizeQuestion,
  type Question,
  type QuestionKind,
} from '../../entities';
import { ModuleSubList } from '../../features/module-content';
import { QuestionEditor, questionToFormValues } from '../../features/questions';
import { getEducationProblemMessage } from '../../shared/lib';
import {
  AppCard,
  ConfirmModal,
  Page,
  PageBreadcrumbs,
  PageHeader,
  QueryBoundary,
} from '../../shared/ui';

function problemText(data: unknown, status: number, fallback: string): string {
  return data && typeof data === 'object'
    ? getEducationProblemMessage(data as never, status)
    : fallback;
}

export function TeacherModulePage() {
  const { courseId = '', moduleId = '' } = useParams();

  const moduleQuery = useGetModule(moduleId, {
    query: { enabled: Boolean(moduleId), retry: false },
  });
  const module = moduleQuery.data?.status === 200 ? moduleQuery.data.data : undefined;

  const theoriesQuery = useGetModuleTheories(moduleId, {
    query: { enabled: Boolean(moduleId), retry: false },
  });
  const createTheory = useCreateTheory();
  const deleteTheory = useDeleteTheory();

  const practicalsQuery = useGetModulePracticals(moduleId, {
    query: { enabled: Boolean(moduleId), retry: false },
  });
  const createPractical = useCreatePractical();
  const deletePractical = useDeletePractical();

  const questionsQuery = useGetModuleQuestions(moduleId, {
    query: { enabled: Boolean(moduleId), retry: false },
  });
  const createQuestion = useCreateQuestion();
  const updateQuestion = useUpdateQuestion();
  const deleteQuestion = useDeleteQuestion();

  const [questionModalOpened, questionModal] = useDisclosure(false);
  const [questionKind, setQuestionKind] = useState<QuestionKind>('SingleChoice');
  const [editQuestion, setEditQuestion] = useState<Question | null>(null);
  const [deleteQuestionTarget, setDeleteQuestionTarget] = useState<string | null>(null);

  const base = `/teacher/courses/${courseId}/modules/${moduleId}`;
  const questions =
    questionsQuery.data?.status === 200
      ? questionsQuery.data.data.map(normalizeQuestion)
      : [];

  return (
    <Page>
      <PageBreadcrumbs
        items={[
          { label: 'Главная', to: '/' },
          { label: 'Преподаватель', to: '/teacher/courses' },
          { label: 'Курсы', to: '/teacher/courses' },
          { label: 'Курс', to: `/teacher/courses/${courseId}` },
          { label: module?.name ?? 'Модуль' },
        ]}
      />

      <Group justify="space-between" align="flex-end" gap="md" wrap="wrap">
        <PageHeader title={module?.name ?? 'Модуль'} description="Теория, вопросы и практики модуля." />
        <Button component={Link} to={`/teacher/courses/${courseId}`} size="sm" variant="outline">
          К курсу
        </Button>
      </Group>

      <Tabs defaultValue="theory">
        <Tabs.List>
          <Tabs.Tab value="theory">Теория</Tabs.Tab>
          <Tabs.Tab value="questions">Вопросы</Tabs.Tab>
          <Tabs.Tab value="practicals">Практики</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="theory" pt="md">
          <ModuleSubList
            title="Теоретические материалы"
            addLabel="Создать материал"
            namePlaceholder="Например: Оконные функции"
            isPending={theoriesQuery.isPending}
            isError={theoriesQuery.isError || theoriesQuery.data?.status !== 200}
            items={theoriesQuery.data?.status === 200 ? theoriesQuery.data.data : undefined}
            emptyDescription="Добавьте первый теоретический материал."
            creating={createTheory.isPending}
            deleting={deleteTheory.isPending}
            onCreate={async (name) => {
              const response = await createTheory
                .mutateAsync({ data: { moduleId, name } })
                .catch(() => null);
              if (!response) return 'Education API недоступен.';
              if (response.status === 200) {
                await theoriesQuery.refetch();
                return null;
              }
              return problemText(response.data, response.status, 'Не удалось создать материал.');
            }}
            onDelete={async (id) => {
              await deleteTheory.mutateAsync({ theoryId: id }).catch(() => null);
              await theoriesQuery.refetch();
            }}
            renderActions={(item) => (
              <Button
                component={Link}
                to={`${base}/theories/${item.id}`}
                size="xs"
                variant="subtle"
              >
                Редактировать
              </Button>
            )}
          />
        </Tabs.Panel>

        <Tabs.Panel value="questions" pt="md">
          <AppCard p={0}>
            <Group justify="space-between" p="md" gap="md" wrap="wrap">
              <Text fw={600}>Банк вопросов</Text>
              <Button size="xs" onClick={questionModal.open}>
                Создать вопрос
              </Button>
            </Group>
            <QueryBoundary
              isPending={questionsQuery.isPending}
              isError={questionsQuery.isError || questionsQuery.data?.status !== 200}
              data={questionsQuery.data?.status === 200 ? questions : undefined}
              errorTitle="Education API недоступен"
              emptyTitle="Вопросов нет"
              emptyDescription="Создайте первый вопрос модуля."
              isEmpty={(rows) => rows.length === 0}
            >
              {(rows) => (
                <Table striped highlightOnHover withTableBorder withColumnBorders>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Вопрос</Table.Th>
                      <Table.Th w={160}>Тип</Table.Th>
                      <Table.Th w={90}>Вес</Table.Th>
                      <Table.Th w={120}>Действия</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {rows.map((question) => (
                      <Table.Tr key={question.id}>
                        <Table.Td>
                          <Text size="sm" lineClamp={2}>
                            {question.text}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge color="blue" radius="sm" variant="light">
                            {question.kind ? QUESTION_KIND_LABELS[question.kind] : 'Неизвестно'}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{question.weight}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs" wrap="nowrap">
                            <Button
                              size="xs"
                              variant="subtle"
                              disabled={question.kind === null}
                              onClick={() => setEditQuestion(question)}
                            >
                              Изменить
                            </Button>
                            <Button
                              size="xs"
                              color="red"
                              variant="subtle"
                              onClick={() => setDeleteQuestionTarget(question.id)}
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
        </Tabs.Panel>

        <Tabs.Panel value="practicals" pt="md">
          <ModuleSubList
            title="Практики"
            addLabel="Создать практику"
            namePlaceholder="Например: Практика 1"
            isPending={practicalsQuery.isPending}
            isError={practicalsQuery.isError || practicalsQuery.data?.status !== 200}
            items={practicalsQuery.data?.status === 200 ? practicalsQuery.data.data : undefined}
            emptyDescription="Добавьте первую практику модуля."
            creating={createPractical.isPending}
            deleting={deletePractical.isPending}
            onCreate={async (name) => {
              const response = await createPractical
                .mutateAsync({ data: { moduleId, name } })
                .catch(() => null);
              if (!response) return 'Education API недоступен.';
              if (response.status === 200) {
                await practicalsQuery.refetch();
                return null;
              }
              return problemText(response.data, response.status, 'Не удалось создать практику.');
            }}
            onDelete={async (id) => {
              await deletePractical.mutateAsync({ practicalId: id }).catch(() => null);
              await practicalsQuery.refetch();
            }}
            renderActions={(item) => (
              <Button
                component={Link}
                to={`${base}/practicals/${item.id}`}
                size="xs"
                variant="subtle"
              >
                Настроить
              </Button>
            )}
          />
        </Tabs.Panel>
      </Tabs>

      <Modal
        opened={questionModalOpened}
        onClose={questionModal.close}
        title="Создать вопрос"
        centered
        size="lg"
      >
        <Stack gap="md">
          <Select
            label="Тип вопроса"
            data={QUESTION_KIND_OPTIONS}
            value={questionKind}
            onChange={(value) => setQuestionKind((value ?? 'SingleChoice') as QuestionKind)}
            allowDeselect={false}
          />
          <QuestionEditor
            key={questionKind}
            kind={questionKind}
            submitting={createQuestion.isPending}
            submitLabel="Создать вопрос"
            onCancel={questionModal.close}
            onSubmit={async (payload) => {
              const response = await createQuestion
                .mutateAsync({ data: { moduleId, ...payload } })
                .catch(() => null);
              if (response && response.status === 200) {
                await questionsQuery.refetch();
                questionModal.close();
              }
            }}
          />
        </Stack>
      </Modal>

      <Modal
        opened={editQuestion !== null}
        onClose={() => setEditQuestion(null)}
        title="Изменить вопрос"
        centered
        size="lg"
      >
        {editQuestion && editQuestion.kind ? (
          <QuestionEditor
            key={editQuestion.id}
            kind={editQuestion.kind}
            initialValues={questionToFormValues(editQuestion) ?? undefined}
            submitting={updateQuestion.isPending}
            submitLabel="Сохранить"
            onCancel={() => setEditQuestion(null)}
            onSubmit={async (payload) => {
              const response = await updateQuestion
                .mutateAsync({ questionId: editQuestion.id, data: payload })
                .catch(() => null);
              if (response && response.status === 204) {
                await questionsQuery.refetch();
                setEditQuestion(null);
              }
            }}
          />
        ) : null}
      </Modal>

      <ConfirmModal
        opened={deleteQuestionTarget !== null}
        title="Удалить вопрос"
        message="Вопрос будет удалён из банка вопросов модуля."
        confirmLabel="Удалить"
        loading={deleteQuestion.isPending}
        onCancel={() => setDeleteQuestionTarget(null)}
        onConfirm={async () => {
          if (deleteQuestionTarget) {
            await deleteQuestion.mutateAsync({ questionId: deleteQuestionTarget }).catch(() => null);
            await questionsQuery.refetch();
          }
          setDeleteQuestionTarget(null);
        }}
      />
    </Page>
  );
}
