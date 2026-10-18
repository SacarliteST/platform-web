import { beforeAll, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { MarkdownView } from './MarkdownView';
import { safeUrl } from './MarkdownViewContent';
import { renderWithProviders } from '../../../test/render';

describe('MarkdownView', () => {
  beforeAll(async () => {
    await import('./MarkdownViewContent');
  });

  it('рендерит жирный текст, список и таблицу GFM', async () => {
    const { container } = renderWithProviders(
      <MarkdownView>{'**Попытка 1 — верно**\n\n- пункт\n\n| Критерий | Баллы |\n|---|---|\n| Результат | 60 / 60 |'}</MarkdownView>,
    );

    expect(await screen.findByText('Попытка 1 — верно')).toBeInTheDocument();
    expect(container.querySelector('strong')).not.toBeNull();
    expect(container.querySelector('li')).toHaveTextContent('пункт');
    expect(container.querySelector('table')).not.toBeNull();
    expect(screen.getByText('60 / 60')).toBeInTheDocument();
  });

  it('SQL в код-блоке показывается как текст, а не как разметка', async () => {
    const { container } = renderWithProviders(
      <MarkdownView>{'```sql\nSELECT * FROM t WHERE a < 5 AND b > <b>1</b>\n```'}</MarkdownView>,
    );

    await screen.findByText(/SELECT \* FROM t/);
    expect(container.querySelector('pre')).toHaveTextContent('b > <b>1</b>');
    expect(container.querySelector('pre b')).toBeNull();
  });

  it('сырой HTML не исполняется и не создаёт элементов', async () => {
    const { container } = renderWithProviders(
      <MarkdownView>{'до\n\n<script>window.__pwned = 1</script>\n\n<img src=x onerror="window.__pwned = 1">\n\n<b>жирный?</b>\n\nпосле'}</MarkdownView>,
    );

    await screen.findByText('после');
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined();
  });

  it('изображения markdown не отображаются', async () => {
    const { container } = renderWithProviders(
      <MarkdownView>{'![трекер](https://evil.example/pixel.png)\n\nтекст'}</MarkdownView>,
    );

    await screen.findByText('текст');
    expect(container.querySelector('img')).toBeNull();
  });

  it('ссылки http(s) открываются в новой вкладке без opener', async () => {
    renderWithProviders(<MarkdownView>{'[документация](https://example.com/docs)'}</MarkdownView>);

    const link = await screen.findByRole('link', { name: 'документация' });
    expect(link).toHaveAttribute('href', 'https://example.com/docs');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(link.getAttribute('rel')).toContain('noreferrer');
  });

  it('javascript:-ссылка теряет href', async () => {
    renderWithProviders(<MarkdownView>{'[клик](javascript:alert(1))'}</MarkdownView>);

    await screen.findByText('клик');
    const element = screen.getByText('клик').closest('a');
    expect(element?.getAttribute('href') ?? null).toBeNull();
  });
});

describe('safeUrl', () => {
  it.each([
    ['https://example.com', true],
    ['http://example.com/a?b=1', true],
    ['/relative/path', true],
    ['#anchor', true],
    ['./rel', true],
    ['javascript:alert(1)', false],
    ['  JaVaScRiPt:alert(1)', false],
    ['data:text/html;base64,AAAA', false],
    ['vbscript:msgbox(1)', false],
    ['mailto:a@b.c', false],
    ['', false],
  ])('%s → %s', (url, allowed) => {
    expect(safeUrl(url) !== '').toBe(allowed);
  });
});
