import { Group, Stack, Text, Title } from '@mantine/core';
import type { ReactNode } from 'react';

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function PageHeader({ actions, description, title }: PageHeaderProps) {
  return (
    <Group align="flex-start" justify="space-between" gap="md" wrap="wrap">
      <Stack gap={4}>
        <Title order={2} size="h3">
          {title}
        </Title>
        {description ? (
          <Text c="dimmed" size="sm">
            {description}
          </Text>
        ) : null}
      </Stack>
      {actions ? <Group gap="sm">{actions}</Group> : null}
    </Group>
  );
}
