import {
  Alert,
  Button,
  Group,
  Modal,
  MultiSelect,
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Text,
} from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import { useBindPracticalModule } from '../../../api/education/practicals/practicals';
import {
  useGetTaskSelectionRule,
  useUpsertTaskSelectionRule,
} from '../../../api/education/task-assignments/task-assignments';
import {
  useGetEnabledPracticalModules,
  useGetPracticalModuleTasks,
} from '../../../api/education/practical-modules/practical-modules';
import type { PracticalDetailResponse } from '../../../api/education/model';
import { getEducationProblemMessage, toNumber } from '../../../shared/lib';
import { AppCard } from '../../../shared/ui';
import { useOpenModuleAuthoring } from '../model/use-open-module-authoring';

const DIFFICULTY_OPTIONS = [
  { value: '1', label: '1 — базовая' },
  { value: '2', label: '2 — лёгкая' },
  { value: '3', label: '3 — средняя' },
  { value: '4', label: '4 — сложная' },
  { value: '5', label: '5 — экспертная' },
];

type Props = {
  practicalId: string;
  detail: PracticalDetailResponse;
  onChanged: () => void;
};

export function TeacherExternalPractical({ practicalId, detail, onChanged }: Props) {
  const [opened, setOpened] = useState(false);
  const authoring = useOpenModuleAuthoring();
  const isExternal = detail.kind === 'external';
  const binding = detail.moduleBinding;
  const ruleQuery = useGetTaskSelectionRule(practicalId, { query: { retry: false } });
  const hasRandomRule = ruleQuery.data?.status === 200;

  if (hasRandomRule) {
    return (
      <AppCard p="md">
        <Stack gap="xs">
          <Text fw={600}>Внешний модуль</Text>
          <Text size="sm" c="dimmed">
            Действует режим случайной выборки заданий — привязка фиксированного задания
            недоступна. Управление — в карточке «Случайная выборка заданий» ниже.
          </Text>
        </Stack>
      </AppCard>
    );
  }

  return (
    <AppCard p="md">
      <Stack gap="sm">
        {isExternal && binding ? (
          <>
            <Text fw={600}>Внешний модуль</Text>
            <Text size="sm">
              Модуль: <b>{binding.practicalModuleName}</b> ({binding.practicalModuleSlug})
            </Text>
            <Text size="sm" c="dimmed">
              Задание: {binding.externalTaskRef} · попыток {toNumber(detail.triesCount)} ·{' '}
              {detail.timeLimitMinutes == null
                ? 'без лимита времени'
                : `лимит ${toNumber(detail.timeLimitMinutes)} мин`}
            </Text>
            {authoring.error ? (
              <Alert color="red" variant="light" title="Не удалось открыть модуль">
                {authoring.error}
              </Alert>
            ) : null}
            <Group gap="xs">
              <Button size="xs" variant="light" onClick={() => setOpened(true)}>
                Изменить привязку
              </Button>
              <Button
                size="xs"
                variant="light"
                loading={authoring.isPending}
                onClick={() => authoring.open(binding.practicalModuleId, binding.externalTaskRef)}
              >
                Открыть задание в модуле
              </Button>
            </Group>
          </>
        ) : (
          <>
            <Text fw={600}>Внешний модуль</Text>
            <Text size="sm" c="dimmed">
              Практика проходится на платформе (тест и задания). Можно перевести её на
              внешний модуль — одно задание всем или случайный набор каждому студенту.
              Доступно только для практики без сдач студентов.
            </Text>
            <Button size="xs" w="fit-content" onClick={() => setOpened(true)}>
              Привязать внешний модуль
            </Button>
          </>
        )}
      </Stack>

      <BindModal
        opened={opened}
        practicalId={practicalId}
        detail={detail}
        onClose={() => setOpened(false)}
        onDone={() => {
          setOpened(false);
          onChanged();
        }}
      />
    </AppCard>
  );
}

function BindModal({
  opened,
  practicalId,
  detail,
  onClose,
  onDone,
}: {
  opened: boolean;
  practicalId: string;
  detail: PracticalDetailResponse;
  onClose: () => void;
  onDone: () => void;
}) {
  const modulesQuery = useGetEnabledPracticalModules({ query: { enabled: opened, retry: false } });
  const bindMutation = useBindPracticalModule();
  const upsertRuleMutation = useUpsertTaskSelectionRule();

  const [mode, setMode] = useState<'fixed' | 'random'>('fixed');
  const [moduleId, setModuleId] = useState<string | null>(null);
  const [taskRef, setTaskRef] = useState<string | null>(null);
  const [tries, setTries] = useState<number | string>(1);
  const [attemptsPerSession, setAttemptsPerSession] = useState<number | string>('');
  const [noLimit, setNoLimit] = useState(true);
  const [limit, setLimit] = useState<number | string>(120);
  const [taskCount, setTaskCount] = useState<number | string>(3);
  const [difficulty, setDifficulty] = useState<string[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!opened) {
      return;
    }
    const b = detail.moduleBinding;
    setMode('fixed');
    setModuleId(b?.practicalModuleId ?? null);
    setTaskRef(b?.externalTaskRef ?? null);
    setTries(toNumber(detail.triesCount, 1));
    setAttemptsPerSession(
      detail.attemptsPerSession == null ? '' : toNumber(detail.attemptsPerSession),
    );
    setNoLimit(detail.timeLimitMinutes == null);
    setLimit(detail.timeLimitMinutes == null ? 120 : toNumber(detail.timeLimitMinutes));
    setTaskCount(3);
    setDifficulty([]);
    setTopics([]);
    setError(null);
  }, [opened, detail]);

  const modules = useMemo(
    () =>
      modulesQuery.data?.status === 200
        ? modulesQuery.data.data.filter((module) => module.isEnabled)
        : [],
    [modulesQuery.data],
  );

  const tasksQuery = useGetPracticalModuleTasks(moduleId ?? '', {
    query: { enabled: opened && Boolean(moduleId), retry: false },
  });
  const tasks = tasksQuery.data?.status === 200 ? tasksQuery.data.data : [];

  const topicOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const task of tasks) {
      if (task.topicId && !byId.has(task.topicId)) {
        byId.set(task.topicId, task.topicName ?? task.topicId);
      }
    }
    return [...byId.entries()].map(([value, label]) => ({ value, label }));
  }, [tasks]);

  const submitRandom = async (selectedModuleId: string) => {
    const response = await upsertRuleMutation
      .mutateAsync({
        practicalId,
        data: {
          practicalModuleId: selectedModuleId,
          taskCount: Number(taskCount) || 1,
          difficultyLevels: difficulty.map(Number),
          topicRefs: topics,
        },
      })
      .catch(() => null);

    if (!response) {
      setError('Education API недоступен.');
      return;
    }
    if (response.status === 200) {
      onDone();
      return;
    }
    if (response.status === 409) {
      setError(
        'Случайную выборку нельзя включить: у практики есть ручной список заданий или уже выданные наборы с сессиями студентов.',
      );
      return;
    }
    if (response.status === 404) {
      setError('Модуль не найден или отключён.');
      return;
    }
    setError('Не удалось сохранить правило случайной выборки.');
  };

  const submit = async () => {
    setError(null);
    if (!moduleId) {
      setError('Выберите модуль.');
      return;
    }
    if (mode === 'random') {
      await submitRandom(moduleId);
      return;
    }
    if (!taskRef) {
      setError('Выберите задание модуля.');
      return;
    }

    const response = await bindMutation
      .mutateAsync({
        practicalId,
        data: {
          practicalModuleId: moduleId,
          externalTaskRef: taskRef,
          triesCount: Number(tries) || 1,
          timeLimitMinutes: noLimit ? null : Number(limit) || 1,
          attemptsPerSession: attemptsPerSession === '' ? null : Number(attemptsPerSession) || 1,
        },
      })
      .catch(() => null);

    if (!response) {
      setError('Education API недоступен.');
      return;
    }
    if (response.status === 204) {
      onDone();
      return;
    }
    if (response.status === 409) {
      setError('По практике уже есть работа студентов — создайте новую практику для модуля.');
      return;
    }
    if (response.status === 404) {
      setError('Модуль не найден или отключён.');
      return;
    }
    setError(
      response.data && typeof response.data === 'object'
        ? getEducationProblemMessage(response.data, response.status)
        : 'Не удалось привязать модуль.',
    );
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Привязка внешнего модуля" centered>
      <Stack gap="md">
        {error ? (
          <Alert color="red" variant="light" title="Не удалось">
            {error}
          </Alert>
        ) : null}

        <Select
          label="Модуль"
          placeholder={modulesQuery.isPending ? 'Загрузка…' : 'Выберите модуль'}
          data={modules.map((module) => ({ value: module.id, label: `${module.name} (${module.slug})` }))}
          value={moduleId}
          onChange={(value) => {
            setModuleId(value);
            setTaskRef(null);
            setTopics([]);
          }}
          withAsterisk
        />

        <SegmentedControl
          value={mode}
          onChange={(value) => setMode(value as 'fixed' | 'random')}
          data={[
            { value: 'fixed', label: 'Одно задание всем' },
            { value: 'random', label: 'Случайный набор каждому' },
          ]}
          fullWidth
        />

        {mode === 'fixed' ? (
          <>
            <Select
              label="Задание модуля"
              placeholder={
                !moduleId
                  ? 'Сначала выберите модуль'
                  : tasksQuery.isPending
                    ? 'Загрузка каталога…'
                    : tasksQuery.data?.status === 502
                      ? 'Модуль недоступен'
                      : 'Выберите задание'
              }
              data={tasks.map((task) => ({ value: task.ref, label: task.name }))}
              value={taskRef}
              onChange={setTaskRef}
              disabled={!moduleId || tasks.length === 0}
              withAsterisk
            />

            <Group grow align="flex-start">
              <NumberInput label="Заходов (запусков модуля)" min={1} value={tries} onChange={setTries} />
              <NumberInput
                label="Отправок решения в одном заходе"
                description="Пусто — без ограничения"
                min={1}
                value={attemptsPerSession}
                onChange={setAttemptsPerSession}
              />
              <NumberInput
                label="Лимит времени, мин"
                min={1}
                value={limit}
                onChange={setLimit}
                disabled={noLimit}
              />
            </Group>
            <Switch
              label="Без лимита времени"
              checked={noLimit}
              onChange={(event) => setNoLimit(event.currentTarget.checked)}
            />
          </>
        ) : (
          <>
            <NumberInput
              label="Заданий каждому студенту"
              description="При открытии пары каждый студент получит свой случайный набор из каталога модуля"
              min={1}
              max={10}
              value={taskCount}
              onChange={setTaskCount}
              withAsterisk
            />
            <MultiSelect
              label="Сложность"
              description="Пусто — любая сложность"
              data={DIFFICULTY_OPTIONS}
              value={difficulty}
              onChange={setDifficulty}
              clearable
            />
            <MultiSelect
              label="Темы модуля"
              description={
                !moduleId
                  ? 'Сначала выберите модуль'
                  : tasksQuery.data?.status === 502
                    ? 'Каталог модуля недоступен — темы можно задать позже'
                    : 'Пусто — любые темы'
              }
              placeholder={tasksQuery.isPending ? 'Загрузка каталога…' : 'Выберите темы'}
              data={topicOptions}
              value={topics}
              onChange={setTopics}
              disabled={!moduleId || topicOptions.length === 0}
              searchable
              clearable
            />
          </>
        )}

        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={onClose}>
            Отмена
          </Button>
          <Button
            loading={mode === 'fixed' ? bindMutation.isPending : upsertRuleMutation.isPending}
            onClick={submit}
          >
            {mode === 'fixed' ? 'Привязать' : 'Включить случайную выборку'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
