import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  useConfigurePracticalQuestions,
  useCreatePracticalTask,
  useDeletePracticalTask,
  useGetPracticalDetail,
  useGetPracticalQuestionsSetup,
  useGetPracticalTasks,
  usePublishPractical,
  useUpdatePracticalTaskText,
} from '../../api/education/practicals/practicals';
import { TeacherExternalPractical } from '../../features/module-practice';
import {
  useAcceptTaskFile,
  useAddTaskFileComment,
  useGetTeacherTaskFilesByPractical,
} from '../../api/education/task-files/task-files';
import {
  useGetTeacherPracticalProtocols,
  useGetTestProtocol,
} from '../../api/education/test-results/test-results';
import { QUESTION_KIND_LABELS, questionKindFromTypeId } from '../../entities';
import { downloadEducationFile } from '../../shared/http';
import { toNumber } from '../../shared/lib';
import {
  AppCard,
  ConfirmModal,
  Page,
  PageBreadcrumbs,
  PageHeader,
  QueryBoundary,
} from '../../shared/ui';

export function TeacherPracticalPage() {
  const { courseId = '', moduleId = '', practicalId = '' } = useParams();
  const backToModule = `/teacher/courses/${courseId}/modules/${moduleId}`;

  const detailQuery = useGetPracticalDetail(practicalId, {
    query: { enabled: Boolean(practicalId), retry: false },
  });
  const detail = detailQuery.data?.status === 200 ? detailQuery.data.data : undefined;
  const isExternal = detail?.kind === 'external';

  return (
    <Page>
      <PageBreadcrumbs
        items={[
          { label: 'Главная', to: '/' },
          { label: 'Преподаватель', to: '/teacher/courses' },
          { label: 'Модуль', to: backToModule },
          { label: detail?.name ?? 'Практика' },
        ]}
      />
      <Group justify="space-between" align="flex-end" gap="md" wrap="wrap">
        <PageHeader
          title={detail?.name ?? 'Практика'}
          description={
            isExternal
              ? 'Практика проходится во внешнем модуле.'
              : 'Настройка теста, задания, сдачи и протоколы.'
          }
        />
        <Button component={Link} to={backToModule} size="sm" variant="outline">
          К модулю
        </Button>
      </Group>

      <QueryBoundary
        isPending={detailQuery.isPending}
        isError={detailQuery.isError || detailQuery.data?.status !== 200}
        data={detail}
        errorTitle="Education API недоступен"
      >
        {(data) => (
          <Stack gap="md">
            <TeacherExternalPractical
              practicalId={practicalId}
              detail={data}
              onChanged={() => void detailQuery.refetch()}
            />

            {data.kind === 'external' ? (
              <TeacherExternalProtocolsTab practicalId={practicalId} taskId={data.moduleBinding?.taskId} />
            ) : (
              <Tabs defaultValue="setup">
                <Tabs.List>
                  <Tabs.Tab value="setup">Настройка</Tabs.Tab>
                  <Tabs.Tab value="tasks">Задания</Tabs.Tab>
                  <Tabs.Tab value="submissions">Сдачи</Tabs.Tab>
                  <Tabs.Tab value="protocols">Протоколы</Tabs.Tab>
                </Tabs.List>
                <Tabs.Panel value="setup" pt="md">
                  <SetupTab practicalId={practicalId} />
                </Tabs.Panel>
                <Tabs.Panel value="tasks" pt="md">
                  <TasksTab practicalId={practicalId} />
                </Tabs.Panel>
                <Tabs.Panel value="submissions" pt="md">
                  <SubmissionsTab practicalId={practicalId} />
                </Tabs.Panel>
                <Tabs.Panel value="protocols" pt="md">
                  <ProtocolsTab practicalId={practicalId} />
                </Tabs.Panel>
              </Tabs>
            )}
          </Stack>
        )}
      </QueryBoundary>
    </Page>
  );
}

function TeacherExternalProtocolsTab({
  practicalId: _practicalId,
  taskId: _taskId,
}: {
  practicalId: string;
  taskId?: string;
}) {
  // Лента событий по попыткам — MOD-012.
  return (
    <AppCard p="md">
      <Text size="sm" c="dimmed">
        Протоколы попыток студентов появятся здесь (MOD-012).
      </Text>
    </AppCard>
  );
}

function SetupTab({ practicalId }: { practicalId: string }) {
  const setupQuery = useGetPracticalQuestionsSetup(practicalId, {
    query: { enabled: Boolean(practicalId), retry: false },
  });
  const configure = useConfigurePracticalQuestions();
  const publish = usePublishPractical();
  const setup = setupQuery.data?.status === 200 ? setupQuery.data.data : undefined;

  const [selected, setSelected] = useState<string[]>([]);
  const [tries, setTries] = useState<number | string>(1);
  const [p5, setP5] = useState<number | string>(90);
  const [p4, setP4] = useState<number | string>(75);
  const [p3, setP3] = useState<number | string>(60);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (setup) {
      setSelected(setup.questions.filter((q) => q.isSelected).map((q) => q.id));
      setTries(toNumber(setup.triesCount, 1));
      setP5(toNumber(setup.percentForFive, 90));
      setP4(toNumber(setup.percentForFour, 75));
      setP3(toNumber(setup.percentForThree, 60));
    }
  }, [setup]);

  const save = async () => {
    setNotice(null);
    const response = await configure
      .mutateAsync({
        practicalId,
        data: {
          questionIds: selected,
          triesCount: Number(tries) || 1,
          percentForFive: Number(p5),
          percentForFour: Number(p4),
          percentForThree: Number(p3),
        },
      })
      .catch(() => null);
    setNotice(response && response.status === 204 ? 'Настройки сохранены.' : 'Не удалось сохранить.');
    await setupQuery.refetch();
  };

  return (
    <QueryBoundary
      isPending={setupQuery.isPending}
      isError={setupQuery.isError || setupQuery.data?.status !== 200}
      data={setup}
      errorTitle="Education API недоступен"
    >
      {(data) => (
        <Stack gap="md">
          {notice ? (
            <Alert color="blue" variant="light" withCloseButton onClose={() => setNotice(null)}>
              {notice}
            </Alert>
          ) : null}
          <AppCard p="md">
            <Group justify="space-between">
              <Title order={3} size="h5">
                Публикация
              </Title>
              <Group gap="sm">
                <Badge color={data.isPublic ? 'green' : 'gray'} variant="light" radius="sm">
                  {data.isPublic ? 'Опубликована' : 'Черновик'}
                </Badge>
                <Button
                  size="xs"
                  disabled={data.isPublic}
                  loading={publish.isPending}
                  onClick={async () => {
                    await publish.mutateAsync({ practicalId }).catch(() => null);
                    await setupQuery.refetch();
                  }}
                >
                  Опубликовать
                </Button>
              </Group>
            </Group>
          </AppCard>

          <AppCard p="md">
            <Stack gap="sm">
              <Title order={3} size="h5">
                Пороги оценок и попытки
              </Title>
              <Group gap="md" wrap="wrap">
                <NumberInput label="Попыток" min={1} w={120} value={tries} onChange={setTries} />
                <NumberInput label="% на 5" min={0} max={100} w={120} value={p5} onChange={setP5} />
                <NumberInput label="% на 4" min={0} max={100} w={120} value={p4} onChange={setP4} />
                <NumberInput label="% на 3" min={0} max={100} w={120} value={p3} onChange={setP3} />
              </Group>
            </Stack>
          </AppCard>

          <AppCard p="md">
            <Stack gap="sm">
              <Group justify="space-between">
                <Title order={3} size="h5">
                  Вопросы теста
                </Title>
                <Button size="xs" loading={configure.isPending} onClick={save}>
                  Сохранить настройку
                </Button>
              </Group>
              {data.questions.length === 0 ? (
                <Text c="dimmed" size="sm">
                  В модуле нет вопросов. Создайте их на странице модуля.
                </Text>
              ) : (
                <Checkbox.Group value={selected} onChange={setSelected}>
                  <Stack gap="xs">
                    {data.questions.map((question) => (
                      <Checkbox
                        key={question.id}
                        value={question.id}
                        label={
                          <Group gap="xs" wrap="nowrap">
                            <Badge color="blue" radius="sm" variant="light">
                              {questionKindFromTypeId(question.type)
                                ? QUESTION_KIND_LABELS[questionKindFromTypeId(question.type)!]
                                : 'Тип'}
                            </Badge>
                            <Text size="sm" lineClamp={1}>
                              {question.text}
                            </Text>
                          </Group>
                        }
                      />
                    ))}
                  </Stack>
                </Checkbox.Group>
              )}
            </Stack>
          </AppCard>
        </Stack>
      )}
    </QueryBoundary>
  );
}

function TasksTab({ practicalId }: { practicalId: string }) {
  const tasksQuery = useGetPracticalTasks(practicalId, {
    query: { enabled: Boolean(practicalId), retry: false },
  });
  const createTask = useCreatePracticalTask();
  const updateText = useUpdatePracticalTaskText();
  const deleteTask = useDeletePracticalTask();

  const [createOpened, createModal] = useDisclosure(false);
  const [name, setName] = useState('');
  const [editTask, setEditTask] = useState<{ id: string; text: string } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  return (
    <AppCard p={0}>
      <Group justify="space-between" p="md">
        <Text fw={600}>Задания</Text>
        <Button
          size="xs"
          onClick={() => {
            setName('');
            createModal.open();
          }}
        >
          Создать задание
        </Button>
      </Group>
      <QueryBoundary
        isPending={tasksQuery.isPending}
        isError={tasksQuery.isError || tasksQuery.data?.status !== 200}
        data={tasksQuery.data?.status === 200 ? tasksQuery.data.data : undefined}
        emptyTitle="Заданий нет"
        emptyDescription="Добавьте первое задание практики."
        isEmpty={(rows) => rows.length === 0}
      >
        {(rows) => (
          <Table striped withTableBorder withColumnBorders>
            <Table.Tbody>
              {rows.map((task) => (
                <Table.Tr key={task.id}>
                  <Table.Td>
                    <Text fw={600} size="sm">
                      {task.name}
                    </Text>
                    <Text c="dimmed" size="xs" lineClamp={2}>
                      {task.text}
                    </Text>
                  </Table.Td>
                  <Table.Td w={220}>
                    <Group gap="xs" wrap="nowrap">
                      <Button
                        size="xs"
                        variant="subtle"
                        onClick={() => setEditTask({ id: task.id, text: task.text })}
                      >
                        Текст
                      </Button>
                      <Button
                        size="xs"
                        color="red"
                        variant="subtle"
                        onClick={() => setDeleteId(task.id)}
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

      <Modal opened={createOpened} onClose={createModal.close} title="Создать задание" centered>
        <Stack gap="md">
          <TextInput
            label="Название"
            withAsterisk
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={createModal.close}>
              Отмена
            </Button>
            <Button
              loading={createTask.isPending}
              onClick={async () => {
                if (!name.trim()) {
                  return;
                }
                const response = await createTask
                  .mutateAsync({ practicalId, data: { name: name.trim() } })
                  .catch(() => null);
                if (response && response.status === 200) {
                  createModal.close();
                  await tasksQuery.refetch();
                }
              }}
            >
              Создать
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={editTask !== null} onClose={() => setEditTask(null)} title="Текст задания" centered size="lg">
        <Stack gap="md">
          <Textarea
            autosize
            minRows={6}
            value={editTask?.text ?? ''}
            onChange={(event) =>
              setEditTask((current) => (current ? { ...current, text: event.currentTarget.value } : current))
            }
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setEditTask(null)}>
              Отмена
            </Button>
            <Button
              loading={updateText.isPending}
              onClick={async () => {
                if (!editTask) {
                  return;
                }
                const response = await updateText
                  .mutateAsync({ taskId: editTask.id, data: { text: editTask.text } })
                  .catch(() => null);
                if (response && response.status === 204) {
                  setEditTask(null);
                  await tasksQuery.refetch();
                }
              }}
            >
              Сохранить
            </Button>
          </Group>
        </Stack>
      </Modal>

      <ConfirmModal
        opened={deleteId !== null}
        title="Удалить задание"
        message="Задание и все его сдачи будут удалены."
        confirmLabel="Удалить"
        loading={deleteTask.isPending}
        onCancel={() => setDeleteId(null)}
        onConfirm={async () => {
          if (deleteId) {
            await deleteTask.mutateAsync({ taskId: deleteId }).catch(() => null);
            await tasksQuery.refetch();
          }
          setDeleteId(null);
        }}
      />
    </AppCard>
  );
}

function SubmissionsTab({ practicalId }: { practicalId: string }) {
  const filesQuery = useGetTeacherTaskFilesByPractical(practicalId, {
    query: { enabled: Boolean(practicalId), retry: false },
  });
  const addComment = useAddTaskFileComment();
  const accept = useAcceptTaskFile();

  const [commentTarget, setCommentTarget] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [acceptTarget, setAcceptTarget] = useState<string | null>(null);
  const [grade, setGrade] = useState<string>('5');

  return (
    <AppCard p={0}>
      <QueryBoundary
        isPending={filesQuery.isPending}
        isError={filesQuery.isError || filesQuery.data?.status !== 200}
        data={filesQuery.data?.status === 200 ? filesQuery.data.data : undefined}
        emptyTitle="Сдач нет"
        emptyDescription="Пока никто не загрузил решение."
        isEmpty={(rows) => rows.length === 0}
      >
        {(rows) => (
          <Table striped withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Студент</Table.Th>
                <Table.Th w={110}>Статус</Table.Th>
                <Table.Th w={80}>Оценка</Table.Th>
                <Table.Th w={280}>Действия</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((file) => (
                <Table.Tr key={file.id}>
                  <Table.Td>
                    <Text size="sm">{file.fullName}</Text>
                    {file.comments.length > 0 ? (
                      <Text c="dimmed" size="xs">
                        Комментариев: {file.comments.length}
                      </Text>
                    ) : null}
                  </Table.Td>
                  <Table.Td>
                    <Badge color={file.isAccepted ? 'green' : 'gray'} radius="sm" variant="light">
                      {file.isAccepted ? 'Принято' : 'На проверке'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{file.isAccepted ? toNumber(file.grade) : '—'}</Table.Td>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      <Button
                        size="xs"
                        variant="subtle"
                        onClick={() =>
                          downloadEducationFile(
                            `/api/v1/files/${encodeURIComponent(file.storageKey)}`,
                            file.name,
                          )
                        }
                      >
                        Файл
                      </Button>
                      <Button
                        size="xs"
                        variant="subtle"
                        onClick={() => {
                          setCommentText('');
                          setCommentTarget(file.id);
                        }}
                      >
                        Комментарий
                      </Button>
                      <Button
                        size="xs"
                        disabled={file.isAccepted}
                        onClick={() => {
                          setGrade('5');
                          setAcceptTarget(file.id);
                        }}
                      >
                        Принять
                      </Button>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </QueryBoundary>

      <Modal opened={commentTarget !== null} onClose={() => setCommentTarget(null)} title="Комментарий" centered>
        <Stack gap="md">
          <Textarea
            autosize
            minRows={3}
            value={commentText}
            onChange={(event) => setCommentText(event.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setCommentTarget(null)}>
              Отмена
            </Button>
            <Button
              loading={addComment.isPending}
              onClick={async () => {
                if (!commentTarget || !commentText.trim()) {
                  return;
                }
                await addComment
                  .mutateAsync({ taskFileId: commentTarget, data: { comment: commentText.trim() } })
                  .catch(() => null);
                setCommentTarget(null);
                await filesQuery.refetch();
              }}
            >
              Отправить
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={acceptTarget !== null} onClose={() => setAcceptTarget(null)} title="Принять решение" centered>
        <Stack gap="md">
          <Select
            label="Оценка"
            data={['2', '3', '4', '5']}
            value={grade}
            onChange={(value) => setGrade(value ?? '5')}
            allowDeselect={false}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setAcceptTarget(null)}>
              Отмена
            </Button>
            <Button
              loading={accept.isPending}
              onClick={async () => {
                if (!acceptTarget) {
                  return;
                }
                await accept
                  .mutateAsync({ taskFileId: acceptTarget, data: { grade: Number(grade) } })
                  .catch(() => null);
                setAcceptTarget(null);
                await filesQuery.refetch();
              }}
            >
              Принять
            </Button>
          </Group>
        </Stack>
      </Modal>
    </AppCard>
  );
}

function ProtocolsTab({ practicalId }: { practicalId: string }) {
  const protocolsQuery = useGetTeacherPracticalProtocols(practicalId, {
    query: { enabled: Boolean(practicalId), retry: false },
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const protocolQuery = useGetTestProtocol(selectedId ?? '', {
    query: { enabled: Boolean(selectedId), retry: false },
  });
  const protocol = protocolQuery.data?.status === 200 ? protocolQuery.data.data : undefined;

  return (
    <Stack gap="md">
      <AppCard p={0}>
        <QueryBoundary
          isPending={protocolsQuery.isPending}
          isError={protocolsQuery.isError || protocolsQuery.data?.status !== 200}
          data={protocolsQuery.data?.status === 200 ? protocolsQuery.data.data : undefined}
          emptyTitle="Попыток нет"
          emptyDescription="Студенты ещё не проходили тест."
          isEmpty={(rows) => rows.length === 0}
        >
          {(rows) => (
            <Table striped highlightOnHover withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Попытка</Table.Th>
                  <Table.Th w={110}>Баллы</Table.Th>
                  <Table.Th w={90}>Оценка</Table.Th>
                  <Table.Th w={120}>Действия</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((row) => (
                  <Table.Tr key={row.id}>
                    <Table.Td>#{toNumber(row.tryNumber)}</Table.Td>
                    <Table.Td>
                      {row.score === null ? '—' : `${toNumber(row.score)} / ${toNumber(row.maxScore)}`}
                    </Table.Td>
                    <Table.Td>{toNumber(row.grade)}</Table.Td>
                    <Table.Td>
                      <Button size="xs" variant="subtle" onClick={() => setSelectedId(row.id)}>
                        Разбор
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </QueryBoundary>
      </AppCard>

      {selectedId ? (
        <AppCard p="md">
          <QueryBoundary
            isPending={protocolQuery.isPending}
            isError={protocolQuery.isError || protocolQuery.data?.status !== 200}
            data={protocol}
            errorTitle="Не удалось загрузить протокол"
          >
            {(data) => (
              <Table withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Вопрос</Table.Th>
                    <Table.Th>Ответ студента</Table.Th>
                    <Table.Th w={90}>Балл</Table.Th>
                    <Table.Th w={90}>Итог</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.answers.map((answer) => (
                    <Table.Tr key={answer.questionId}>
                      <Table.Td>
                        <Text size="sm">{answer.questionText}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" lineClamp={2}>
                          {answer.userAnswer || '—'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        {toNumber(answer.questionScore)} / {toNumber(answer.questionWeight)}
                      </Table.Td>
                      <Table.Td>
                        <Badge color={answer.isCorrect ? 'green' : 'red'} radius="sm" variant="light">
                          {answer.isCorrect ? 'Верно' : 'Неверно'}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </QueryBoundary>
        </AppCard>
      ) : null}
    </Stack>
  );
}
