/** Скачивает CSV с BOM, чтобы Excel правильно прочитал кириллицу. */
export function downloadCsv(content: string, fileName: string) {
  const blob = new Blob(['﻿', content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
