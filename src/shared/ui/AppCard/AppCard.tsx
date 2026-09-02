import { Card, type CardProps } from '@mantine/core';
import type { PropsWithChildren } from 'react';

type AppCardProps = PropsWithChildren<CardProps>;

export function AppCard({ children, ...props }: AppCardProps) {
  return (
    <Card withBorder radius="sm" shadow="sm" p="lg" {...props}>
      {children}
    </Card>
  );
}
