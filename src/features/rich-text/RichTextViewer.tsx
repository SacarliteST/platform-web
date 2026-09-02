import { TypographyStylesProvider } from '@mantine/core';

type RichTextViewerProps = {
  html: string;
};

/** Read-only просмотр форматированного HTML теории (замена legacy ReadOnlyRichText). */
export function RichTextViewer({ html }: RichTextViewerProps) {
  return (
    <TypographyStylesProvider>
      {/* Источник — доверенный контент, созданный преподавателем в редакторе. */}
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </TypographyStylesProvider>
  );
}
