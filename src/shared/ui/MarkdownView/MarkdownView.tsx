import { Loader } from '@mantine/core';
import { lazy, Suspense } from 'react';

const MarkdownViewContent = lazy(() => import('./MarkdownViewContent'));

/** Безопасный показ markdown. react-markdown/remark подгружаются отдельным чанком — в стартовый бандл не входят. */
export function MarkdownView({ children }: { children: string }) {
  return (
    <Suspense fallback={<Loader size="xs" aria-label="Загрузка текста" />}>
      <MarkdownViewContent>{children}</MarkdownViewContent>
    </Suspense>
  );
}
