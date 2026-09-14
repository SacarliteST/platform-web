import { afterEach, describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';

/**
 * TD-006 — совместимость HTML: старые материалы теории созданы legacy-редактором
 * react-quill (Quill 1), новый редактор `RichTextField` = `[StarterKit, Link]`.
 * Тест фиксирует, ЧТО из типовой Quill-разметки переживает открытие и повторное
 * сохранение в TipTap (`getHTML()`), а что молча теряется. Список несовместимостей
 * — в записи `docs/tech-debt/records/TD-006-*`.
 */

let editor: Editor;

function roundTrip(html: string): string {
  editor?.destroy();
  editor = new Editor({ extensions: [StarterKit, Underline, Link], content: html });
  return editor.getHTML();
}

afterEach(() => editor?.destroy());

describe('TD-006: Quill HTML → TipTap round-trip', () => {
  it('сохраняет заголовки, базовое форматирование, подчёркивание, ссылки', () => {
    expect(roundTrip('<h2>Заголовок</h2>')).toContain('<h2>Заголовок</h2>');
    const basic = roundTrip('<p><strong>жир</strong> <em>курсив</em> <u>подч</u></p>');
    expect(basic).toContain('<strong>жир</strong>');
    expect(basic).toContain('<em>курсив</em>');
    expect(basic).toContain('<u>подч</u>');
    expect(roundTrip('<p><a href="https://ex.edu/x">ссылка</a></p>')).toContain('href="https://ex.edu/x"');
  });

  it('сохраняет списки, в т.ч. вложенные', () => {
    expect(roundTrip('<ul><li>раз</li><li>два</li></ul>')).toContain('<ul><li><p>раз</p></li>');
    const nested = roundTrip('<ul><li>a<ul><li>b</li></ul></li></ul>');
    expect(nested).toContain('<ul>');
    expect(nested.match(/<ul>/g)?.length).toBe(2);
    expect(nested).toContain('b');
  });

  it('сохраняет blockquote и code block', () => {
    expect(roundTrip('<blockquote><p>цитата</p></blockquote>')).toContain('<blockquote>');
    expect(roundTrip('<pre><code>SELECT 1;</code></pre>')).toContain('<pre><code');
  });

  // --- Известные потери (нет соответствующих extension в RichTextField) ---

  it('ТЕРЯЕТ выравнивание (text-align / ql-align-*) — нет TextAlign', () => {
    const out = roundTrip('<p style="text-align: center" class="ql-align-center">по центру</p>');
    expect(out).not.toMatch(/text-align|ql-align/);
    expect(out).toContain('по центру');
  });

  it('ТЕРЯЕТ инлайновый цвет/размер (<span style>) — нет TextStyle/Color', () => {
    const out = roundTrip('<p><span style="color:#e11">красный</span></p>');
    expect(out).not.toMatch(/color|style=/);
    expect(out).toContain('красный');
  });

  it('ТЕРЯЕТ изображения — нет Image extension', () => {
    const out = roundTrip('<p><img src="data:image/png;base64,AAAA" alt="pic"></p>');
    expect(out).not.toContain('<img');
  });
});
