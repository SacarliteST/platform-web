import { Stack, Text, Title } from '@mantine/core';
import type { ReactNode } from 'react';

type EmptyStateProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function EmptyState({ actions, description, title }: EmptyStateProps) {
  return (
    <Stack align="center" gap="xs" py="xl" ta="center">
      <Title order={3} size="h4">
        {title}
      </Title>
      {description ? (
        <Text c="dimmed" maw={560} size="sm">
          {description}
        </Text>
      ) : null}
      {actions}
    </Stack>
  );
}
