import { Badge, Group, Stack, Text, Title } from '@mantine/core';
import type { ReactNode } from 'react';

type ContourHeaderProps = {
  title: string;
  description?: string;
  modeLabel?: string;
  actions?: ReactNode;
};

export function ContourHeader({ actions, description, modeLabel, title }: ContourHeaderProps) {
  return (
    <Group align="flex-start" justify="space-between" gap="md" wrap="wrap">
      <Stack gap={6}>
        <Group gap="xs" wrap="wrap">
          <Title order={2} size="h3">
            {title}
          </Title>
          {modeLabel ? (
            <Badge color="gray" radius="sm" variant="light">
              {modeLabel}
            </Badge>
          ) : null}
        </Group>
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
