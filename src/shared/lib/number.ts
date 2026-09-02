/**
 * Education API (.NET 10 OpenAPI) отдаёт числовые поля как union `number | string`.
 * Нормализуем на границе api → entity, чтобы UI работал только с числами.
 */
export function toNumber(
  value: number | string | null | undefined,
  fallback = 0,
): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

export function toNullableNumber(
  value: number | string | null | undefined,
): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = toNumber(value, Number.NaN);
  return Number.isNaN(parsed) ? null : parsed;
}
