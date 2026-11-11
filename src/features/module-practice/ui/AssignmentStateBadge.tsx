import { Badge } from '@mantine/core';

const STATE_LABELS: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'идёт', color: 'blue' },
  COMPLETED: { label: 'завершено', color: 'green' },
  EXPIRED: { label: 'истекла', color: 'gray' },
};

/** Бейдж состояния последней сессии по заданию набора (wire: ACTIVE/COMPLETED/EXPIRED). */
export function AssignmentStateBadge({ state }: { state: string | null }) {
  if (state === null) {
    return (
      <Badge color="gray" radius="sm" variant="outline">
        не начато
      </Badge>
    );
  }
  const meta = STATE_LABELS[state] ?? { label: state.toLowerCase(), color: 'gray' };
  return (
    <Badge color={meta.color} radius="sm" variant="light">
      {meta.label}
    </Badge>
  );
}
