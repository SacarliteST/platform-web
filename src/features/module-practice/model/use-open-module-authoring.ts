import { useState } from 'react';
import { useCreatePracticalModuleAuthoringLink } from '../../../api/education/practical-modules/practical-modules';

const DISABLED_MESSAGE = 'Модуль выключен — обратитесь к администратору.';
const RETURN_PATH_MESSAGE = 'Не удалось подготовить возврат на платформу, обновите страницу.';
const UNAVAILABLE_MESSAGE = 'Модуль или IdentityService недоступны, попробуйте позже.';

/**
 * Переход преподавателя в контур авторинга модуля в той же вкладке — как у студента.
 * Модуль получает путь текущей страницы платформы и показывает кнопку возврата на неё;
 * `taskRef` открывает сразу конкретное задание модуля.
 */
export function useOpenModuleAuthoring() {
  const authoringLink = useCreatePracticalModuleAuthoringLink();
  const [error, setError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const open = async (practicalModuleId: string, taskRef?: string) => {
    setError(null);
    setOpeningId(practicalModuleId);
    const response = await authoringLink
      .mutateAsync({
        practicalModuleId,
        data: {
          returnPath: `${window.location.pathname}${window.location.search}`,
          taskRef: taskRef ?? null,
        },
      })
      .catch(() => null);
    setOpeningId(null);

    if (response?.status === 200) {
      // токен — только в URL-фрагменте, не логируем и не держим в state
      window.location.assign(response.data.url);
      return;
    }
    if (response?.status === 409) {
      setError(DISABLED_MESSAGE);
      return;
    }
    if (response?.status === 400) {
      setError(RETURN_PATH_MESSAGE);
      return;
    }
    setError(UNAVAILABLE_MESSAGE);
  };

  return { open, error, openingId, isPending: authoringLink.isPending };
}
