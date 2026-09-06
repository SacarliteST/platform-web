import { Alert, Badge, Button, Group, Loader, Stack, Text } from '@mantine/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  getGetCurrentModuleSessionQueryKey,
  useAbandonModuleSession,
  useGetCurrentModuleSession,
  useGetModuleSession,
  useStartModuleSession,
} from '../../../api/education/module-sessions/module-sessions';
import type {
  ExternalModuleBindingResponse,
  ModuleSessionResponse,
} from '../../../api/education/model';
import { toNumber } from '../../../shared/lib';
import { AppCard, ConfirmModal, QueryBoundary } from '../../../shared/ui';
import { useQueryClient } from '@tanstack/react-query';

/** ~40 с ожидания оценки после возврата, дальше — ручное обновление. */
const RETURN_POLL_TIMEOUT_MS = 40_000;
const RETURN_POLL_INTERVAL_MS = 2_000;

type Props = {
  practicalId: string;
  binding: ExternalModuleBindingResponse | null;
  triesCount: number;
  timeLimitMinutes: number | null;
};

export function StudentExternalPractical({
  practicalId,
  binding,
  triesCount,
  timeLimitMinutes,
}: Props) {
  const [searchParams] = useSearchParams();
  const returnSessionId = searchParams.get('session');

  if (!binding) {
    return (
      <Alert color="yellow" variant="light" title="Практика ещё не настроена">
        Преподаватель не привязал к этой практике задание модуля.
      </Alert>
    );
  }

  return (
    <Stack gap="md">
      {returnSessionId ? (
        <ReturnStatus practicalId={practicalId} sessionId={returnSessionId} />
      ) : null}
      <Gate
        practicalId={practicalId}
        taskId={binding.taskId}
        moduleName={binding.practicalModuleName}
        triesCount={triesCount}
        timeLimitMinutes={timeLimitMinutes}
      />
    </Stack>
  );
}

function isActive(session: ModuleSessionResponse | null | undefined): boolean {
  if (!session || session.status !== 'ACTIVE') {
    return false;
  }
  if (session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()) {
    return false;
  }
  return true;
}

function Gate({
  practicalId,
  taskId,
  moduleName,
  triesCount,
  timeLimitMinutes,
}: {
  practicalId: string;
  taskId: string;
  moduleName: string;
  triesCount: number;
  timeLimitMinutes: number | null;
}) {
  const queryClient = useQueryClient();
  const currentQuery = useGetCurrentModuleSession(
    practicalId,
    { taskId },
    { query: { enabled: Boolean(taskId), retry: false } },
  );
  const startMutation = useStartModuleSession();
  const abandonMutation = useAbandonModuleSession();

  const [error, setError] = useState<string | null>(null);
  const [abandonOpened, setAbandonOpened] = useState(false);

  const gate = currentQuery.data?.status === 200 ? currentQuery.data.data : undefined;
  const session = gate?.session ?? null;
  const attemptsCount = gate ? toNumber(gate.attemptsCount) : 0;
  const bestGrade = gate?.bestGrade == null ? null : toNumber(gate.bestGrade);

  const canStartNew = !isActive(session) && attemptsCount < triesCount;
  const canResume = isActive(session);
  const exhausted = !isActive(session) && attemptsCount >= triesCount;

  const launch = async () => {
    setError(null);
    const response = await startMutation
      .mutateAsync({ practicalId, data: { taskId } })
      .catch(() => null);

    if (!response) {
      setError('Не удалось запустить — Education API недоступен.');
      return;
    }
    if (response.status === 200) {
      window.location.assign(response.data.launchUrl);
      return;
    }
    if (response.status === 409) {
      setError('Попытки исчерпаны.');
      void currentQuery.refetch();
      return;
    }
    if (response.status === 502) {
      setError('Модуль сейчас недоступен. Попробуйте позже.');
      return;
    }
    setError('Не удалось запустить попытку.');
  };

  const abandon = async () => {
    if (!session) {
      return;
    }
    await abandonMutation
      .mutateAsync({ practicalId, sessionId: session.sessionId })
      .catch(() => null);
    setAbandonOpened(false);
    await queryClient.invalidateQueries({
      queryKey: getGetCurrentModuleSessionQueryKey(practicalId, { taskId }),
    });
  };

  return (
    <QueryBoundary
      isPending={currentQuery.isPending}
      isError={currentQuery.isError || currentQuery.data?.status !== 200}
      data={gate}
      errorTitle="Education API недоступен"
    >
      {() => (
        <AppCard p="md">
          <Stack gap="sm">
            <Group justify="space-between" wrap="wrap" gap="xs">
              <Text fw={600}>Практика в модуле «{moduleName}»</Text>
              <Text size="sm" c="dimmed">
                Попытка {Math.min(attemptsCount + (canResume ? 0 : 1), triesCount)} из {triesCount}
                {timeLimitMinutes ? ` · лимит ${timeLimitMinutes} мин` : ' · без лимита'}
              </Text>
            </Group>

            {bestGrade !== null ? (
              <Badge color="green" radius="sm" variant="light" w="fit-content">
                Лучшая оценка: {bestGrade}
              </Badge>
            ) : null}

            {error ? (
              <Alert color="red" variant="light" withCloseButton onClose={() => setError(null)}>
                {error}
              </Alert>
            ) : null}

            {canResume ? (
              <Group gap="sm">
                <Button onClick={launch} loading={startMutation.isPending}>
                  Продолжить
                </Button>
                <Button
                  variant="outline"
                  color="red"
                  onClick={() => setAbandonOpened(true)}
                  loading={abandonMutation.isPending}
                >
                  Прервать попытку
                </Button>
              </Group>
            ) : canStartNew ? (
              <Button onClick={launch} loading={startMutation.isPending} w="fit-content">
                Начать
              </Button>
            ) : exhausted ? (
              <Text size="sm" c="dimmed">
                Все попытки использованы.
              </Text>
            ) : null}
          </Stack>

          <ConfirmModal
            opened={abandonOpened}
            title="Прервать попытку"
            message="Попытка будет засчитана как использованная. Прервать?"
            confirmLabel="Прервать"
            loading={abandonMutation.isPending}
            onCancel={() => setAbandonOpened(false)}
            onConfirm={abandon}
          />
        </AppCard>
      )}
    </QueryBoundary>
  );
}

function ReturnStatus({ practicalId, sessionId }: { practicalId: string; sessionId: string }) {
  const [slow, setSlow] = useState(false);
  const startedAt = useRef(Date.now());

  const sessionQuery = useGetModuleSession(practicalId, sessionId, {
    query: {
      enabled: Boolean(sessionId),
      retry: false,
      refetchInterval: (query) => {
        const status =
          query.state.data?.status === 200 ? query.state.data.data.status : undefined;
        if (status !== 'ACTIVE' || slow) {
          return false;
        }
        return RETURN_POLL_INTERVAL_MS;
      },
    },
  });

  const session = sessionQuery.data?.status === 200 ? sessionQuery.data.data : undefined;
  const status = session?.status;

  useEffect(() => {
    if (status !== 'ACTIVE') {
      return;
    }
    const remaining = RETURN_POLL_TIMEOUT_MS - (Date.now() - startedAt.current);
    const timer = setTimeout(() => setSlow(true), Math.max(0, remaining));
    return () => clearTimeout(timer);
  }, [status]);

  const endReasonText = useMemo(() => {
    switch (session?.endReason) {
      case 'timeout':
        return 'Время на попытку вышло.';
      case 'abandoned':
        return 'Вы прервали попытку.';
      default:
        return 'Попытка завершена.';
    }
  }, [session?.endReason]);

  if (sessionQuery.data?.status === 404) {
    return null;
  }

  return (
    <AppCard p="md">
      <Stack gap="sm">
        {status === 'COMPLETED' ? (
          <>
            <Group gap="xs">
              <Text fw={600}>Попытка засчитана</Text>
              <Badge color="green" radius="sm" variant="light">
                Оценка: {session?.grade == null ? '—' : toNumber(session.grade)}
              </Badge>
            </Group>
            <Text size="sm" c="dimmed">
              Разбор действий — на вкладке «Протокол».
            </Text>
          </>
        ) : status === 'EXPIRED' ? (
          <>
            <Text fw={600}>Попытка не завершена</Text>
            <Text size="sm" c="dimmed">
              {endReasonText}
            </Text>
          </>
        ) : (
          <Group gap="sm">
            <Loader size="sm" />
            <Stack gap={2}>
              <Text size="sm">
                {slow ? 'Оценка обрабатывается дольше обычного.' : 'Попытка обрабатывается…'}
              </Text>
              {slow ? (
                <Button
                  size="xs"
                  variant="subtle"
                  w="fit-content"
                  onClick={() => {
                    startedAt.current = Date.now();
                    setSlow(false);
                    void sessionQuery.refetch();
                  }}
                >
                  Обновить
                </Button>
              ) : null}
            </Stack>
          </Group>
        )}
      </Stack>
    </AppCard>
  );
}
