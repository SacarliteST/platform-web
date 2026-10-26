import { readReason } from '../../shared/lib';

/** Человеческий текст ошибки выдачи ссылки в банк заданий по статусу и причине ответа. */
export function trainingLinkErrorMessage(status: number, data: unknown): string {
  const reason = readReason(data);
  if (status === 409 && reason === 'ModuleDisabled') {
    return 'Модуль сейчас отключён администратором.';
  }
  if (status === 409 && reason === 'TrainingBankDisabled') {
    return 'Банк заданий этого модуля пока не включён.';
  }
  if (status === 502) {
    return 'Сервис авторизации недоступен. Попробуйте позже.';
  }
  if (status === 403) {
    return 'Банк заданий доступен только студентам.';
  }
  if (status === 404) {
    return 'Модуль не найден — возможно, его удалили.';
  }
  if (status === 400 || status === 422) {
    return 'Не удалось сформировать ссылку возврата на платформу.';
  }
  return 'Не удалось открыть банк заданий.';
}
