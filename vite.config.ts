/// <reference types="vitest/config" />
import { gzipSync } from 'node:zlib';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Бюджеты бандла (gzip). Гейт в `npm run build`: превышение — фейл сборки.
 * Держим начальную загрузку в узде и не даём случайно вернуть тяжёлые чанки
 * (редактор теории) в общий граф. Правится осознанно вместе с записью `TD-002`.
 */
const BUNDLE_BUDGETS: Record<string, number> = {
  // entry + все его статические импорты — то, что тянется на любой первый заход
  'initial graph': 200 * 1024,
  // ленивый чанк редактора теории (@mantine/tiptap + @tiptap/*), грузится только
  // при редактировании теории — бюджет ловит рост самого редактора
  'tiptap chunk': 130 * 1024,
};

/**
 * Считает gzip-состав бандла, печатает начальный граф и проверяет бюджеты.
 * `ANALYZE=1 npm run build` дополнительно пишет `dist/bundle-report.json`.
 */
function bundleBudget(verbose: boolean): Plugin {
  return {
    name: 'bundle-budget',
    apply: 'build',
    generateBundle(_options, bundle) {
      const chunks = Object.values(bundle).filter(
        (item): item is Extract<typeof item, { type: 'chunk' }> => item.type === 'chunk',
      );
      const byName = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
      const gzip = (code: string) => gzipSync(Buffer.from(code)).length;

      const rows = chunks.map((chunk) => ({
        file: chunk.fileName,
        isEntry: chunk.isEntry,
        raw: chunk.code.length,
        gzip: gzip(chunk.code),
        staticImports: chunk.imports,
        dynamicImports: chunk.dynamicImports,
        modules: Object.keys(chunk.modules).length,
      }));
      const gzipOf = (file: string) => rows.find((row) => row.file === file)?.gzip ?? 0;

      const entry = rows.find((row) => row.isEntry);
      const initialGraph = new Set<string>();
      if (entry) {
        const walk = (file: string) => {
          if (initialGraph.has(file)) return;
          initialGraph.add(file);
          byName.get(file)?.imports.forEach(walk);
        };
        walk(entry.file);
      }
      const initialGzip = [...initialGraph].reduce((sum, file) => sum + gzipOf(file), 0);
      const tiptapGzip = rows
        .filter((row) => /(^|\/)tiptap-[^/]+\.js$/.test(row.file))
        .reduce((sum, row) => sum + row.gzip, 0);

      const kb = (bytes: number) => (bytes / 1024).toFixed(1) + ' kB';

      if (verbose) {
        this.emitFile({
          type: 'asset',
          fileName: 'bundle-report.json',
          source: JSON.stringify(
            { initialGraph: [...initialGraph], initialGzipBytes: initialGzip, tiptapGzipBytes: tiptapGzip, chunks: rows },
            null,
            2,
          ),
        });
        // eslint-disable-next-line no-console
        console.log('\n[bundle] initial graph (entry + static imports):');
        [...initialGraph]
          .map((file) => rows.find((row) => row.file === file)!)
          .sort((a, b) => b.gzip - a.gzip)
          .forEach((row) => console.log(`  ${kb(row.gzip).padStart(9)} gzip  ${row.file}`));
      }

      const checks: Array<[string, number]> = [
        ['initial graph', initialGzip],
        ['tiptap chunk', tiptapGzip],
      ];
      const failed: string[] = [];
      // eslint-disable-next-line no-console
      console.log('\n[bundle] бюджеты (gzip):');
      for (const [name, actual] of checks) {
        const limit = BUNDLE_BUDGETS[name];
        const ok = actual <= limit;
        if (!ok) failed.push(`${name}: ${kb(actual)} > бюджет ${kb(limit)}`);
        console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(14)} ${kb(actual).padStart(9)} / ${kb(limit)}`);
      }
      if (failed.length > 0) {
        this.error(`Бюджет бандла превышен:\n  ${failed.join('\n  ')}`);
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), bundleBudget(Boolean(process.env.ANALYZE))],
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    restoreMocks: true,
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          mantine: ['@mantine/core', '@mantine/hooks'],
          tiptap: ['@mantine/tiptap', '@tiptap/react', '@tiptap/starter-kit', '@tiptap/extension-link'],
          forms: ['react-hook-form', '@hookform/resolvers', 'zod'],
          query: ['@tanstack/react-query'],
        },
      },
    },
  },
});
