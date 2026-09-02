import { getRuntimeConfig } from '../../app/config/runtime-config-registry';
import { useSessionStore } from '../../session/store';
import { buildApiUrl } from './build-api-url';
import { createAuthorizationHeader } from './auth-header';

/**
 * Скачивание защищённого файла Education API.
 *
 * Генерируемый клиент не годится для бинарного тела, а голая `<a href>` не несёт
 * Bearer-токен, поэтому качаем через fetch с Authorization и сохраняем как blob.
 */
export async function downloadEducationFile(path: string, fallbackFileName = 'file'): Promise<void> {
  const { educationApiUrl } = getRuntimeConfig();
  const { accessToken, status, clearSession } = useSessionStore.getState();

  const response = await fetch(buildApiUrl(educationApiUrl, path), {
    headers: { ...createAuthorizationHeader(accessToken) },
  });

  if (response.status === 401) {
    if (status === 'authenticated') {
      clearSession();
    }
    throw new Error('Требуется вход в систему.');
  }

  if (!response.ok) {
    throw new Error('Не удалось скачать файл.');
  }

  const blob = await response.blob();
  const fileName = parseContentDispositionFileName(response.headers.get('content-disposition')) ?? fallbackFileName;
  const objectUrl = URL.createObjectURL(blob);

  try {
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function parseContentDispositionFileName(header: string | null): string | null {
  if (!header) {
    return null;
  }

  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim());
    } catch {
      return utf8Match[1].trim();
    }
  }

  const asciiMatch = /filename="?([^";]+)"?/i.exec(header);
  return asciiMatch?.[1]?.trim() ?? null;
}
