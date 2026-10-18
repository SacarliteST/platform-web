export type SortDirection = 'asc' | 'desc';

/** Сравнение для сортировки таблиц: пустые значения всегда в конце, строки — по-русски без учёта регистра. */
export function compareNullable(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
  direction: SortDirection,
): number {
  const aEmpty = a === null || a === undefined || a === '';
  const bEmpty = b === null || b === undefined || b === '';
  if (aEmpty && bEmpty) {
    return 0;
  }
  if (aEmpty) {
    return 1;
  }
  if (bEmpty) {
    return -1;
  }

  const result =
    typeof a === 'number' && typeof b === 'number'
      ? a - b
      : String(a).localeCompare(String(b), 'ru', { sensitivity: 'base' });
  return direction === 'asc' ? result : -result;
}

/** Все слова запроса должны встретиться в тексте (в любом порядке, без учёта регистра). Пустой запрос подходит всем. */
export function matchesAllWords(text: string, query: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return true;
  }
  const haystack = text.toLowerCase();
  return words.every((word) => haystack.includes(word));
}

/** Секунды → «1 ч 05 мин», «12 мин 05 с», «45 с»; нет значения → «—». */
export function formatDuration(totalSeconds: number | null | undefined): string {
  if (totalSeconds === null || totalSeconds === undefined || !Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return '—';
  }
  const seconds = Math.round(totalSeconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  if (hours > 0) {
    return `${hours} ч ${String(minutes).padStart(2, '0')} мин`;
  }
  if (minutes > 0) {
    return `${minutes} мин ${String(rest).padStart(2, '0')} с`;
  }
  return `${rest} с`;
}

/** ISO-время → локальный «дд.мм.гггг, чч:мм:сс»; нет значения → «—»; нераспознанное возвращается как есть. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('ru-RU');
}
