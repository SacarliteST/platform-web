/** Причина отказа из тела ответа Education (`{ reason: "..." }`) или `undefined`. */
export function readReason(data: unknown): string | undefined {
  if (data && typeof data === 'object' && 'reason' in data) {
    const reason = (data as { reason?: unknown }).reason;
    return typeof reason === 'string' ? reason : undefined;
  }
  return undefined;
}
