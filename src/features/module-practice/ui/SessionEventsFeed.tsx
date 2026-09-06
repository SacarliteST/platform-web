import { Badge, Code, Group, Loader, Spoiler, Stack, Text, Timeline } from '@mantine/core';
import { useMemo } from 'react';
import { useGetModuleSessionEvents } from '../../../api/education/module-sessions/module-sessions';
import type { ModuleSessionEventResponse } from '../../../api/education/model';
import { AppCard } from '../../../shared/ui';

type Props = {
  practicalId: string;
  sessionId: string;
  /** Заголовок карточки; по умолчанию «Протокол попытки». */
  title?: string;
};

/** Лента «цифрового следа» одной попытки внешнего модуля (события + payload). */
export function SessionEventsFeed({ practicalId, sessionId, title = 'Протокол попытки' }: Props) {
  const eventsQuery = useGetModuleSessionEvents(practicalId, sessionId, {
    query: { enabled: Boolean(practicalId && sessionId), retry: false },
  });

  const events = useMemo<ModuleSessionEventResponse[]>(
    () => (eventsQuery.data?.status === 200 ? [...eventsQuery.data.data] : []),
    [eventsQuery.data],
  );

  // 404 — сессия не относится к практике либо нет доступа: молча ничего не показываем.
  if (eventsQuery.data?.status === 404) {
    return null;
  }

  return (
    <AppCard p="md">
      <Stack gap="sm">
        <Text fw={600}>{title}</Text>

        {eventsQuery.isPending ? (
          <Group gap="sm">
            <Loader size="sm" />
            <Text size="sm" c="dimmed">
              Загрузка событий…
            </Text>
          </Group>
        ) : eventsQuery.isError || eventsQuery.data?.status !== 200 ? (
          <Text size="sm" c="dimmed">
            Не удалось загрузить протокол.
          </Text>
        ) : events.length === 0 ? (
          <Text size="sm" c="dimmed">
            Событий по этой попытке пока нет.
          </Text>
        ) : (
          <Timeline bulletSize={14} lineWidth={2}>
            {events.map((event) => (
              <Timeline.Item key={event.eventId}>
                <Group gap="xs" wrap="wrap">
                  <Badge size="sm" radius="sm" variant="light">
                    {event.kind}
                  </Badge>
                  <Text size="xs" c="dimmed">
                    {formatTimestamp(event.occurredAt)}
                  </Text>
                </Group>
                <PayloadBlock payload={event.payload} />
              </Timeline.Item>
            ))}
          </Timeline>
        )}
      </Stack>
    </AppCard>
  );
}

function PayloadBlock({ payload }: { payload: ModuleSessionEventResponse['payload'] }) {
  const text = useMemo(() => {
    try {
      const json = JSON.stringify(payload, null, 2);
      return json && json !== '{}' ? json : null;
    } catch {
      return null;
    }
  }, [payload]);

  if (!text) {
    return null;
  }

  return (
    <Spoiler maxHeight={72} showLabel="Показать данные" hideLabel="Свернуть" mt={4}>
      <Code block style={{ fontSize: 12 }}>
        {text}
      </Code>
    </Spoiler>
  );
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('ru-RU');
}
