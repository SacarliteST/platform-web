import {
  Alert,
  Badge,
  Button,
  FileButton,
  Group,
  List,
  Stack,
  Table,
  Tabs,
  Text,
  Title,
} from '@mantine/core';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useGetPracticalDetail } from '../../api/education/practicals/practicals';
import { useGetPracticalTasks } from '../../api/education/practicals/practicals';
import { useGetPracticalGrade } from '../../api/education/grades/grades';
import { StudentExternalPractical } from '../../features/module-practice';
import {
  useGetStudentTaskFile,
  useUploadStudentTaskFile,
} from '../../api/education/task-files/task-files';
import {
  useGetStudentPracticalProtocols,
  useGetTestProtocol,
  useGetTestQuestions,
  useGetTestStatus,
  useStartTest,
  useSubmitTest,
} from '../../api/education/test-results/test-results';
import {
  formatGrade,
  normalizePracticalGrade,
  normalizeTestStatus,
  questionKindFromTypeId,
} from '../../entities';
import { QuestionAnswerInput } from '../../features/questions';
import { toNumber } from '../../shared/lib';
import {
  AppCard,
  Page,
  PageBreadcrumbs,
  PageHeader,
  QueryBoundary,
} from '../../shared/ui';

export function StudentPracticalPage() {
  const { courseId = '', moduleId = '', practicalId = '' } = useParams();
  const backToModule = `/student/courses/${courseId}/modules/${moduleId}`;

  const detailQuery = useGetPracticalDetail(practicalId, {
    query: { enabled: Boolean(practicalId), retry: false },
  });
  const detail = detailQuery.data?.status === 200 ? detailQuery.data.data : undefined;
  const practicalName = detail?.name;
  const isExternal = detail?.kind === 'external';

  return (
    <Page>
      <PageBreadcrumbs
        items={[
          { label: 'Главная', to: '/' },
          { label: 'Студент', to: '/student/courses' },
          { label: 'Модуль', to: backToModule },
          { label: practicalName ?? 'Практика' },
        ]}
      />
      <Group justify="space-between" align="flex-end" gap="md" wrap="wrap">
        <PageHeader
          title={practicalName ?? 'Практика'}
          description={isExternal ? 'Практика в подключённом модуле.' : 'Тест, задания, протоколы и оценка.'}
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
        {(data) =>
          data.kind === 'external' ? (
            <StudentExternalPractical
              practicalId={practicalId}
              binding={data.moduleBinding}
              triesCount={toNumber(data.triesCount)}
              timeLimitMinutes={
                data.timeLimitMinutes == null ? null : toNumber(data.timeLimitMinutes)
              }
            />
          ) : (
            <Tabs defaultValue="test">
              <Tabs.List>
                <Tabs.Tab value="test">Тест</Tabs.Tab>
                <Tabs.Tab value="tasks">Задания</Tabs.Tab>
                <Tabs.Tab value="protocols">Протоколы</Tabs.Tab>
                <Tabs.Tab value="grade">Оценка</Tabs.Tab>
              </Tabs.List>
              <Tabs.Panel value="test" pt="md">
                <TestTab practicalId={practicalId} />
              </Tabs.Panel>
              <Tabs.Panel value="tasks" pt="md">
                <TasksTab practicalId={practicalId} />
              </Tabs.Panel>
              <Tabs.Panel value="protocols" pt="md">
                <ProtocolsTab practicalId={practicalId} />
              </Tabs.Panel>
              <Tabs.Panel value="grade" pt="md">
                <GradeTab practicalId={practicalId} />
              </Tabs.Panel>
            </Tabs>
          )
        }
      </QueryBoundary>
    </Page>
  );
}

function TestTab({ practicalId }: { practicalId: string }) {
  const statusQuery = useGetTestStatus(practicalId, {
    query: { enabled: Boolean(practicalId), retry: false },
  });
  const status =
    statusQuery.data?.status === 200 ? normalizeTestStatus(statusQuery.data.data) : undefined;

  const questionsQuery = useGetTestQuestions(practicalId, {
    query: { enabled: Boolean(practicalId) && status?.isStarted === true, retry: false },
  });
  const startTest = useStartTest();
  const submitTest = useSubmitTest();

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const questionsData =
    questionsQuery.data?.status === 200 ? questionsQuery.data.data : undefined;

  const beginTest = async () => {
    setNotice(null);
    const response = await startTest.mutateAsync({ practicalId }).catch(() => null);
    if (response && response.status === 200) {
      setAnswers({});
      setSubmitted(false);
      await statusQuery.refetch();
      await questionsQuery.refetch();
      return;
    }
    setNotice('Не удалось начать тест. Возможно, попытки исчерпаны.');
  };

  const submit = async () => {
    if (!questionsData || submitTest.isPending || submitted) {
      return;
    }
    setNotice(null);
    const payload = {
      answers: questionsData.questions.map((question) => ({
        id: question.id,
        answer: answers[question.id] ?? '',
      })),
    };
    const response = await submitTest
      .mutateAsync({ practicalId, data: payload })
      .catch(() => null);
    if (response && response.status === 200) {
      setSubmitted(true);
      setNotice(
        `Тест отправлен. Оценка: ${toNumber(response.data.grade)} (${toNumber(response.data.score ?? 0)} из ${toNumber(response.data.maxScore ?? 0)} баллов).`,
      );
      await statusQuery.refetch();
      await questionsQuery.refetch();
      return;
    }
    setNotice('Не удалось отправить тест.');
  };

  return (
    <QueryBoundary
      isPending={statusQuery.isPending}
      isError={statusQuery.isError || statusQuery.data?.status !== 200}
      data={status}
      errorTitle="Education API недоступен"
    >
      {(currentStatus) => (
        <Stack gap="md">
          {notice ? (
            <Alert color="blue" variant="light" withCloseButton onClose={() => setNotice(null)}>
              {notice}
            </Alert>
          ) : null}

          {!currentStatus.isStarted ? (
            <AppCard p="md">
              <Stack gap="sm">
                <Text size="sm">
                  Тест ещё не начат
                  {currentStatus.tryNumber ? ` (попытка ${currentStatus.tryNumber})` : ''}.
                </Text>
                <Button onClick={beginTest} loading={startTest.isPending} w="fit-content">
                  Начать тест
                </Button>
              </Stack>
            </AppCard>
          ) : (
            <QueryBoundary
              isPending={questionsQuery.isPending}
              isError={questionsQuery.isError || questionsQuery.data?.status !== 200}
              data={questionsData}
              errorTitle="Не удалось загрузить вопросы"
            >
              {(data) =>
                data.isCompleted || submitted ? (
                  <AppCard p="md">
                    <Stack gap="xs">
                      <Text fw={600}>Тест завершён</Text>
                      <Text c="dimmed" size="sm">
                        Результаты доступны на вкладке «Протоколы».
                      </Text>
                    </Stack>
                  </AppCard>
                ) : (
                  <Stack gap="md">
                    {data.questions.map((question, index) => {
                      const kind = questionKindFromTypeId(question.type);
                      return (
                        <AppCard key={question.id} p="md">
                          <Stack gap="sm">
                            <Text fw={600}>
                              {index + 1}. {question.text}
                            </Text>
                            {kind ? (
                              <QuestionAnswerInput
                                kind={kind}
                                body={question.body}
                                value={answers[question.id] ?? ''}
                                onChange={(next) =>
                                  setAnswers((current) => ({ ...current, [question.id]: next }))
                                }
                              />
                            ) : (
                              <Text c="dimmed" size="sm">
                                Неизвестный тип вопроса.
                              </Text>
                            )}
                          </Stack>
                        </AppCard>
                      );
                    })}
                    <Group>
                      <Button
                        onClick={submit}
                        loading={submitTest.isPending}
                        disabled={submitted}
                      >
                        Отправить ответы
                      </Button>
                    </Group>
                  </Stack>
                )
              }
            </QueryBoundary>
          )}
        </Stack>
      )}
    </QueryBoundary>
  );
}

function TasksTab({ practicalId }: { practicalId: string }) {
  const tasksQuery = useGetPracticalTasks(practicalId, {
    query: { enabled: Boolean(practicalId), retry: false },
  });

  return (
    <QueryBoundary
      isPending={tasksQuery.isPending}
      isError={tasksQuery.isError || tasksQuery.data?.status !== 200}
      data={tasksQuery.data?.status === 200 ? tasksQuery.data.data : undefined}
      errorTitle="Education API недоступен"
      emptyTitle="Заданий нет"
      emptyDescription="В этой практике нет заданий для сдачи."
      isEmpty={(rows) => rows.length === 0}
    >
      {(rows) => (
        <Stack gap="md">
          {rows.map((task) => (
            <StudentTaskCard key={task.id} taskId={task.id} name={task.name} text={task.text} />
          ))}
        </Stack>
      )}
    </QueryBoundary>
  );
}

function StudentTaskCard({
  taskId,
  name,
  text,
}: {
  taskId: string;
  name: string;
  text: string;
}) {
  const fileQuery = useGetStudentTaskFile(taskId, {
    query: { enabled: Boolean(taskId), retry: false },
  });
  const upload = useUploadStudentTaskFile();
  const [error, setError] = useState<string | null>(null);

  const file = fileQuery.data?.status === 200 ? fileQuery.data.data : undefined;
  const isAccepted = file?.isAccepted ?? false;

  const handleUpload = async (picked: File | null) => {
    if (!picked) {
      return;
    }
    setError(null);
    const response = await upload
      .mutateAsync({ taskId, data: { file: picked } })
      .catch(() => null);
    if (response && response.status === 200) {
      await fileQuery.refetch();
      return;
    }
    setError('Не удалось загрузить файл.');
  };

  return (
    <AppCard p="md">
      <Stack gap="sm">
        <Text fw={600}>{name}</Text>
        <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
          {text || 'Текст задания не заполнен.'}
        </Text>

        {error ? (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        ) : null}

        {fileQuery.isPending ? (
          <Text c="dimmed" size="sm">
            Загрузка состояния сдачи…
          </Text>
        ) : file ? (
          <Stack gap={4}>
            <Group gap="xs">
              <Text size="sm">Загружено: {file.name}</Text>
              <Badge color={isAccepted ? 'green' : 'gray'} radius="sm" variant="light">
                {isAccepted ? `Принято (оценка ${toNumber(file.grade)})` : 'На проверке'}
              </Badge>
            </Group>
            {file.comments.length > 0 ? (
              <List size="sm" spacing={2}>
                {file.comments.map((comment) => (
                  <List.Item key={comment.id}>
                    <Text component="span" c={comment.isGenerated ? 'dimmed' : undefined}>
                      {comment.text}
                    </Text>
                  </List.Item>
                ))}
              </List>
            ) : null}
          </Stack>
        ) : (
          <Text c="dimmed" size="sm">
            Файл решения не загружен.
          </Text>
        )}

        {!isAccepted ? (
          <FileButton onChange={handleUpload}>
            {(props) => (
              <Button {...props} size="xs" w="fit-content" loading={upload.isPending}>
                {file ? 'Заменить файл' : 'Загрузить файл'}
              </Button>
            )}
          </FileButton>
        ) : null}
      </Stack>
    </AppCard>
  );
}

function ProtocolsTab({ practicalId }: { practicalId: string }) {
  const protocolsQuery = useGetStudentPracticalProtocols(practicalId, {
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
          emptyDescription="Вы ещё не проходили этот тест."
          isEmpty={(rows) => rows.length === 0}
        >
          {(rows) => (
            <Table striped highlightOnHover withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Попытка</Table.Th>
                  <Table.Th w={130}>Баллы</Table.Th>
                  <Table.Th w={90}>Оценка</Table.Th>
                  <Table.Th w={120}>Действия</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((row) => (
                  <Table.Tr key={row.id}>
                    <Table.Td>#{toNumber(row.tryNumber)}</Table.Td>
                    <Table.Td>
                      {row.score === null
                        ? '—'
                        : `${toNumber(row.score)} / ${toNumber(row.maxScore)}`}
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
                    <Table.Th>Ваш ответ</Table.Th>
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
                        <Badge
                          color={answer.isCorrect ? 'green' : 'red'}
                          radius="sm"
                          variant="light"
                        >
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

function GradeTab({ practicalId }: { practicalId: string }) {
  const gradeQuery = useGetPracticalGrade(practicalId, {
    query: { enabled: Boolean(practicalId), retry: false },
  });
  const grade =
    gradeQuery.data?.status === 200 ? normalizePracticalGrade(gradeQuery.data.data) : undefined;

  return (
    <QueryBoundary
      isPending={gradeQuery.isPending}
      isError={gradeQuery.isError || gradeQuery.data?.status !== 200}
      data={grade}
      errorTitle="Education API недоступен"
    >
      {(data) => (
        <AppCard p="md">
          <Stack gap="sm">
            <Title order={3} size="h5">
              Итоговая оценка
            </Title>
            <Badge
              size="lg"
              color={data.grade === null ? 'gray' : 'green'}
              radius="sm"
              variant="light"
            >
              {data.grade === null ? 'Ещё не выставлена' : formatGrade(data.grade)}
            </Badge>
            {data.messages.length > 0 ? (
              <Stack gap={4}>
                <Text size="sm" fw={500}>
                  Что нужно для получения оценки:
                </Text>
                <List size="sm" spacing={2}>
                  {data.messages.map((message, index) => (
                    <List.Item key={index}>{message}</List.Item>
                  ))}
                </List>
              </Stack>
            ) : null}
          </Stack>
        </AppCard>
      )}
    </QueryBoundary>
  );
}
