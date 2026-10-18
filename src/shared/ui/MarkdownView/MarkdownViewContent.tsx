import { Anchor, Code, Table, Typography } from '@mantine/core';
import { Children, isValidElement, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** Разрешены только http(s), относительные пути и якоря: javascript:/data:/vbscript: превращаются в пустую ссылку. */
export function safeUrl(url: string): string {
  return /^(https?:\/\/|\/|#|\.\/|\.\.\/)/i.test(url.trim()) ? url : '';
}

function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(textOf).join('');
  }
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return textOf(node.props.children);
  }
  return '';
}

const components: Components = {
  a: ({ href, children }) => (
    <Anchor href={href || undefined} target="_blank" rel="noopener noreferrer" size="sm">
      {children}
    </Anchor>
  ),
  // Картинки не поддерживаются: могли бы быть трекинг-пикселем или внешним контентом.
  img: () => null,
  pre: ({ children }) => (
    <Code block my="xs" style={{ fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      {textOf(Children.toArray(children)).replace(/\n$/, '')}
    </Code>
  ),
  code: ({ children }) => <Code>{children}</Code>,
  table: ({ children }) => (
    <Table.ScrollContainer minWidth={280} my="xs">
      <Table striped withTableBorder withColumnBorders fz="sm">
        {children}
      </Table>
    </Table.ScrollContainer>
  ),
  thead: ({ children }) => <Table.Thead>{children}</Table.Thead>,
  tbody: ({ children }) => <Table.Tbody>{children}</Table.Tbody>,
  tr: ({ children }) => <Table.Tr>{children}</Table.Tr>,
  th: ({ children }) => <Table.Th>{children}</Table.Th>,
  td: ({ children }) => <Table.Td>{children}</Table.Td>,
};

/** Рендер markdown от модуля (CommonMark + GFM-таблицы) без raw HTML. Тяжёлая часть — подгружается лениво. */
export default function MarkdownViewContent({ children }: { children: string }) {
  return (
    <Typography fz="sm">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} urlTransform={safeUrl}>
        {children}
      </ReactMarkdown>
    </Typography>
  );
}
