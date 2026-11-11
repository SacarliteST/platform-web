import {
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  MultiSelect,
  NumberInput,
  Select,
  Stack,
  Text,
} from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import {
  useDeleteTaskSelectionRule,
  useGetTaskSelectionRule,
  useUpsertTaskSelectionRule,
} from '../../../api/education/task-assignments/task-assignments';
import {
  useGetEnabledPracticalModules,
  useGetPracticalModuleTasks,
} from '../../../api/education/practical-modules/practical-modules';
import type {
  ExternalModuleBindingResponse,
  TaskSelectionRuleResponse,
} from '../../../api/education/model';
import { toNumber } from '../../../shared/lib';
import { AppCard, ConfirmModal } from '../../../shared/ui';

const DIFFICULTY_OPTIONS = [
  { value: '1', label: '1 — базовая' },
  { value: '2', label: '2 — лёгкая' },
  { value: '3', label: '3 — средняя' },
  { value: '4', label: '4 — сложная' },
  { value: '5', label: '5 — экспертная' },
];

type Props = {
  practicalId: string;
  /** Привязка фиксированного режима — источник модуля по умолчанию. */
  binding: ExternalModuleBindingResponse | null;
  onChanged: () => void;
};

/** Карточка правила случайной выборки заданий: просмотр, создание/замена и удаление (преподаватель). */
export function TaskSelectionRuleCard({ practicalId, binding, onChanged }: Props) {
  const ruleQuery = useGetTaskSelectionRule(practicalId, { query: { retry: false } });
  const rule = ruleQuery.data?.status === 200 ? ruleQuery.data.data : null;

  const [formOpened, setFormOpened] = useState(false);
  const [deleteOpened, setDeleteOpened] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const deleteMutation = useDeleteTaskSelectionRule();

  const remove = async () => {
    setError(null);
    const response = await deleteMutation.mutateAsync({ practicalId }).catch(() => null);
    setDeleteOpened(false);
    if (response && response.status === 204) {
      onChanged();
      void ruleQuery.refetch();
      return;
    }
    setError(
      response && response.status === 409
        ? 'По выданным наборам уже есть сессии модуля — правило удалить нельзя.'
        : 'Не удалось удалить правило.',
    );
  };

  return (
    <AppCard p="md">
      <Stack gap="sm">
        <Group justify="space-between" wrap="wrap" gap="xs">
          <Text fw={600}>Случайная выборка заданий</Text>
          {rule ? (
            <Badge color="violet" variant="light" radius="sm">
              режим случайной выборки
            </Badge>
          ) : null}
        </Group>

        {error ? (
          <Alert color="red" variant="light" withCloseButton onClose={() => setError(null)}>
            {error}
          </Alert>
        ) : null}
        {warning ? (
          <Alert color="yellow" variant="light" withCloseButton onClose={() => setWarning(null)}>
            {warning}
          </Alert>
        ) : null}

        {rule ? (
          <>
            <Text size="sm">
              Каждому студенту на пару: <b>{toNumber(rule.taskCount)}</b> случайных заданий
              {rule.difficultyLevels.length > 0
                ? ` · сложность ${rule.difficultyLevels.join(', ')}`
                : ' · любая сложность'}
              {rule.topicRefs.length > 0 ? ` · тем: ${rule.topicRefs.length}` : ' · любые темы'}
            </Text>
            <Group gap="xs">
              <Button size="xs" variant="light" onClick={() => setFormOpened(true)}>
                Изменить правило
              </Button>
              <Button size="xs" variant="light" color="red" onClick={() => setDeleteOpened(true)}>
                Удалить правило
              </Button>
            </Group>
          </>
        ) : (
          <>
            <Text size="sm" c="dimmed">
              По умолчанию все студенты получают одно привязанное задание. Можно вместо этого
              раздавать каждому персональный случайный набор из каталога модуля — по правилу
              (количество, сложность, темы).
            </Text>
            <Button size="xs" w="fit-content" onClick={() => setFormOpened(true)}>
              Настроить случайную выборку
            </Button>
          </>
        )}
      </Stack>

      <RuleFormModal
        opened={formOpened}
        practicalId={practicalId}
        defaultModuleId={rule?.practicalModuleId ?? binding?.practicalModuleId ?? null}
        rule={rule}
        onClose={() => setFormOpened(false)}
        onDone={(emptyWarning) => {
          setFormOpened(false);
          setWarning(
            emptyWarning
              ? 'Правило сохранено, но прямо сейчас по нему в каталоге модуля нет подходящих заданий — наборы не сформируются.'
              : null,
          );
          onChanged();
          void ruleQuery.refetch();
        }}
      />

      <ConfirmModal
        opened={deleteOpened}
        title="Удалить правило"
        message="Практика вернётся в режим фиксированного задания — привязку нужно будет задать заново."
        confirmLabel="Удалить"
        loading={deleteMutation.isPending}
        onCancel={() => setDeleteOpened(false)}
        onConfirm={remove}
      />
    </AppCard>
  );
}

function RuleFormModal({
  opened,
  practicalId,
  defaultModuleId,
  rule,
  onClose,
  onDone,
}: {
  opened: boolean;
  practicalId: string;
  defaultModuleId: string | null;
  rule: TaskSelectionRuleResponse | null;
  onClose: () => void;
  onDone: (emptySelectionWarning: boolean) => void;
}) {
  const modulesQuery = useGetEnabledPracticalModules({ query: { enabled: opened, retry: false } });
  const upsertMutation = useUpsertTaskSelectionRule();

  const [moduleId, setModuleId] = useState<string | null>(null);
  const [taskCount, setTaskCount] = useState<number | string>(3);
  const [difficulty, setDifficulty] = useState<string[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!opened) {
      return;
    }
    setModuleId(rule?.practicalModuleId ?? defaultModuleId);
    setTaskCount(rule ? toNumber(rule.taskCount) : 3);
    setDifficulty(rule?.difficultyLevels.map(String) ?? []);
    setTopics(rule?.topicRefs ?? []);
    setError(null);
  }, [opened, rule, defaultModuleId]);

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
  const catalogTasks = tasksQuery.data?.status === 200 ? tasksQuery.data.data : [];

  const topicOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const task of catalogTasks) {
      if (task.topicId && !byId.has(task.topicId)) {
        byId.set(task.topicId, task.topicName ?? task.topicId);
      }
    }
    return [...byId.entries()].map(([value, label]) => ({ value, label }));
  }, [catalogTasks]);

  const submit = async () => {
    setError(null);
    if (!moduleId) {
      setError('Выберите модуль.');
      return;
    }

    const response = await upsertMutation
      .mutateAsync({
        practicalId,
        data: {
          practicalModuleId: moduleId,
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
      onDone(response.data.emptySelectionWarning);
      return;
    }
    if (response.status === 409) {
      setError(
        'Правило нельзя применить: у практики есть ручной список заданий или уже выданные наборы с сессиями студентов.',
      );
      return;
    }
    if (response.status === 404) {
      setError('Модуль не найден или отключён.');
      return;
    }
    setError('Не удалось сохранить правило.');
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Правило случайной выборки" centered>
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
            setTopics([]);
          }}
          withAsterisk
        />

        <NumberInput
          label="Заданий каждому студенту"
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

        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={onClose}>
            Отмена
          </Button>
          <Button loading={upsertMutation.isPending} onClick={submit}>
            Сохранить
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
