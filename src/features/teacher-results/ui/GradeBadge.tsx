import { Badge } from '@mantine/core';
import type { GradeStatus } from '../model/gradebook-rows';

const COLORS: Record<GradeStatus, string> = { passed: 'green', failed: 'red', incomplete: 'gray' };

/** Оценка 2–5 цветом статуса; «нет» — ещё не выполнено; «—» — не назначено. */
export function GradeBadge({ label, status }: { label: string; status: GradeStatus }) {
  if (label === '—') {
    return <>—</>;
  }
  return (
    <Badge color={COLORS[status]} variant={status === 'incomplete' ? 'light' : 'filled'} size="md">
      {label}
    </Badge>
  );
}
