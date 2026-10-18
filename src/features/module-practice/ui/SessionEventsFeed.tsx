import { Badge, Button, Code, Group, Loader, Spoiler, Stack, Text, Timeline } from '@mantine/core';
import { useMemo, useState } from 'react';
import { useGetModuleSessionEvents } from '../../../api/education/module-sessions/module-sessions';
import type { ModuleSessionEventResponse } from '../../../api/education/model';
import { formatDateTime } from '../../../shared/lib';
import { AppCard, MarkdownView } from '../../../shared/ui';

type Props = {
  practicalId: string;
  sessionId: string;
  /** Заголовок карточки; по умолчанию «Протокол попытки». */
  title?: string;
};

/**
 * Названия известных видов событий. Платформа модуль-агностична: незнакомый `kind` (другой модуль)
 * показывается как есть. Итог — это локальная финализация модуля, а не подтверждение оценки Education
 * (оценка приходит отдельным HTTP-каналом и показана в таблице), поэтому подпись явно говорит «по данным модуля».
 */
const KIND_META: Record<string, { label: string; color: string }> = {
  sql_submit: { label: 'Попытка', color: 'blue' },
  session_summary: { label: 'Итог по данным модуля', color: 'grape' },
};

export function describeEventKind(kind: string): { label: string; color: string } {
  return KIND_META[kind] ?? { label: kind, color: 'gray' };
}

/** События по времени; при одинаковом времени сохраняется порядок, в котором их отдал сервер. */
export function sortEventsByTime(events: readonly ModuleSessionEventResponse[]): ModuleSessionEventResponse[] {
  return events
    .map((event, index) => ({ event, index, time: Date.parse(event.occurredAt) }))
    .sort((a, b) => {
      const aTime = Number.isNaN(a.time) ? Number.POSITIVE_INFINITY : a.time;
      const bTime = Number.isNaN(b.time) ? Number.POSITIVE_INFINITY : b.time;
      return aTime - bTime || a.index - b.index;
    })
    .map(({ event }) => event);
}

/**
 * Лента «цифрового следа» одной попытки внешнего модуля. Если модуль прислал готовый разбор (markdown) —
 * показываем его, а сырые данные (JSON) прячем под кнопку; иначе — прежний вид с JSON.
 */
export function SessionEventsFeed({ practicalId, sessionId, title = 'Протокол попытки' }: Props) {
  const eventsQuery = useGetModuleSessionEvents(practicalId, sessionId, {
    query: { enabled: Boolean(practicalId && sessionId), retry: false },
  });

  const events = useMemo<ModuleSessionEventResponse[]>(
    () => (eventsQuery.data?.status === 200 ? sortEventsByTime(eventsQuery.data.data) : []),
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
            {events.map((event) => {
              const meta = describeEventKind(event.kind);
              return (
                <Timeline.Item key={event.eventId} color={meta.color} data-kind={event.kind}>
                  <Group gap="xs" wrap="wrap">
                    <Badge size="sm" radius="sm" variant="light" color={meta.color}>
                      {meta.label}
                    </Badge>
                    <Text size="xs" c="dimmed">
                      {formatDateTime(event.occurredAt)}
                    </Text>
                  </Group>
                  <EventBody event={event} />
                </Timeline.Item>
              );
            })}
          </Timeline>
        )}
      </Stack>
    </AppCard>
  );
}

function EventBody({ event }: { event: ModuleSessionEventResponse }) {
  const markdown = event.markdown?.trim() ? event.markdown : null;
  const json = useMemo(() => payloadText(event.payload), [event.payload]);

  if (markdown) {
    return (
      <Stack gap={4} mt={4}>
        <MarkdownView>{markdown}</MarkdownView>
        {json ? <RawData text={json} /> : null}
      </Stack>
    );
  }

  if (!json) {
    return null;
  }

  return (
    <Spoiler maxHeight={72} showLabel="Показать данные" hideLabel="Свернуть" mt={4}>
      <Code block style={{ fontSize: 12 }}>
        {json}
      </Code>
    </Spoiler>
  );
}

/** Исходные данные события (JSON модуля) — свёрнуты, пока преподаватель не раскроет. */
function RawData({ text }: { text: string }) {
  const [opened, setOpened] = useState(false);

  return (
    <Stack gap={4}>
      <Button size="compact-xs" variant="subtle" w="fit-content" onClick={() => setOpened((value) => !value)}>
        {opened ? 'Скрыть исходные данные' : 'Исходные данные (JSON)'}
      </Button>
      {opened ? (
        <Code block style={{ fontSize: 12 }}>
          {text}
        </Code>
      ) : null}
    </Stack>
  );
}

function payloadText(payload: ModuleSessionEventResponse['payload']): string | null {
  try {
    const json = JSON.stringify(payload, null, 2);
    return json && json !== '{}' ? json : null;
  } catch {
    return null;
  }
}
