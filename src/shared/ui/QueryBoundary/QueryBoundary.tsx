import { Alert, Loader, Stack } from '@mantine/core';
import type { ReactNode } from 'react';
import { EmptyState } from '../EmptyState';

type QueryBoundaryProps<TData> = {
  isPending: boolean;
  isError: boolean;
  data: TData | undefined;
  errorTitle?: string;
  errorMessage?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  isEmpty?: (data: TData) => boolean;
  children: (data: TData) => ReactNode;
};

export function QueryBoundary<TData>({
  children,
  data,
  emptyDescription,
  emptyTitle = 'Пусто',
  errorMessage = 'Проверьте, что сервис запущен и runtime config указывает на правильный адрес.',
  errorTitle = 'Не удалось загрузить данные',
  isEmpty,
  isError,
  isPending,
}: QueryBoundaryProps<TData>) {
  if (isPending) {
    return (
      <Stack align="center" py="xl">
        <Loader aria-label="Загрузка" />
      </Stack>
    );
  }

  if (isError || data === undefined) {
    return (
      <Alert color="red" title={errorTitle} variant="light">
        {errorMessage}
      </Alert>
    );
  }

  if (isEmpty?.(data)) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return <>{children(data)}</>;
}
