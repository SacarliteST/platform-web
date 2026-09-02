import { Stack } from '@mantine/core';
import type { PropsWithChildren } from 'react';

type PageProps = PropsWithChildren<{
  gap?: number | string;
}>;

export function Page({ children, gap = 'lg' }: PageProps) {
  return (
    <Stack gap={gap} w="100%">
      {children}
    </Stack>
  );
}
