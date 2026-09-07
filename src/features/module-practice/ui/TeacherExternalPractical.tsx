import {
  Alert,
  Button,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Switch,
  Text,
} from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import { useBindPracticalModule } from '../../../api/education/practicals/practicals';
import {
  useGetEnabledPracticalModules,
  useGetPracticalModuleTasks,
} from '../../../api/education/practical-modules/practical-modules';
import type { PracticalDetailResponse } from '../../../api/education/model';
import { getEducationProblemMessage, toNumber } from '../../../shared/lib';
import { AppCard } from '../../../shared/ui';

type Props = {
  practicalId: string;
  detail: PracticalDetailResponse;
  onChanged: () => void;
};

export function TeacherExternalPractical({ practicalId, detail, onChanged }: Props) {
  const [opened, setOpened] = useState(false);
  const isExternal = detail.kind === 'external';
  const binding = detail.moduleBinding;

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
            <Button size="xs" variant="light" w="fit-content" onClick={() => setOpened(true)}>
              Изменить привязку
            </Button>
          </>
        ) : (
          <>
            <Text fw={600}>Внешний модуль</Text>
            <Text size="sm" c="dimmed">
              Практика проходится на платформе (тест и задания). Можно перевести её на
              внешний модуль — доступно только для практики без сдач студентов.
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

  const [moduleId, setModuleId] = useState<string | null>(null);
  const [taskRef, setTaskRef] = useState<string | null>(null);
  const [tries, setTries] = useState<number | string>(1);
  const [noLimit, setNoLimit] = useState(true);
  const [limit, setLimit] = useState<number | string>(120);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!opened) {
      return;
    }
    const b = detail.moduleBinding;
    setModuleId(b?.practicalModuleId ?? null);
    setTaskRef(b?.externalTaskRef ?? null);
    setTries(toNumber(detail.triesCount, 1));
    setNoLimit(detail.timeLimitMinutes == null);
    setLimit(detail.timeLimitMinutes == null ? 120 : toNumber(detail.timeLimitMinutes));
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

  const submit = async () => {
    setError(null);
    if (!moduleId || !taskRef) {
      setError('Выберите модуль и задание.');
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
          }}
          withAsterisk
        />

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
          <NumberInput label="Попыток" min={1} value={tries} onChange={setTries} />
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

        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={onClose}>
            Отмена
          </Button>
          <Button loading={bindMutation.isPending} onClick={submit}>
            Привязать
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
