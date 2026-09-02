import type {
  HttpValidationProblemDetails,
  ProblemDetails,
} from '../../api/education/model';

export type EducationApiProblem = ProblemDetails | HttpValidationProblemDetails;

export type EducationApiProblemPresentation = {
  title: string;
  message: string;
};

export const isEducationValidationProblem = (
  problem: EducationApiProblem,
): problem is HttpValidationProblemDetails => {
  return 'errors' in problem && problem.errors !== undefined;
};

const fallbackTitleByStatus: Record<number, string> = {
  400: 'Некорректный запрос',
  401: 'Требуется вход',
  403: 'Недостаточно прав',
  404: 'Данные не найдены',
  409: 'Конфликт состояния',
  422: 'Ошибка валидации',
};

const fallbackMessageByStatus: Record<number, string> = {
  400: 'Проверьте корректность запроса.',
  401: 'Необходимо войти в систему повторно.',
  403: 'Недостаточно прав для выполнения действия.',
  404: 'Запрошенные данные не найдены.',
  409: 'Действие конфликтует с текущим состоянием данных.',
  422: 'Проверьте корректность заполнения формы.',
};

export const getEducationProblemFieldErrors = (
  problem: EducationApiProblem,
): Record<string, string[]> => {
  if (!isEducationValidationProblem(problem)) {
    return {};
  }

  return (problem.errors ?? {}) as Record<string, string[]>;
};

export const getEducationProblemErrorMessages = (
  problem: EducationApiProblem,
): string[] => {
  return Object.values(getEducationProblemFieldErrors(problem)).flatMap((messages) => messages);
};

export const getEducationProblemTitle = (
  problem: EducationApiProblem,
  fallbackStatus?: number,
): string => {
  const title = problem.title?.trim();

  if (title) {
    return title;
  }

  if (fallbackStatus && fallbackTitleByStatus[fallbackStatus]) {
    return fallbackTitleByStatus[fallbackStatus];
  }

  return 'Ошибка запроса';
};

export const getEducationProblemMessage = (
  problem: EducationApiProblem,
  fallbackStatus?: number,
): string => {
  const validationMessages = getEducationProblemErrorMessages(problem);

  if (fallbackStatus === 422 && validationMessages.length > 0) {
    return validationMessages.join('\n');
  }

  const detail = problem.detail?.trim();

  if (detail) {
    return detail;
  }

  if (validationMessages.length > 0) {
    return validationMessages.join('\n');
  }

  if (fallbackStatus && fallbackMessageByStatus[fallbackStatus]) {
    return fallbackMessageByStatus[fallbackStatus];
  }

  return 'Не удалось выполнить действие.';
};

export const getEducationProblemPresentation = (
  problem: EducationApiProblem,
  fallbackStatus?: number,
): EducationApiProblemPresentation => {
  return {
    title: getEducationProblemTitle(problem, fallbackStatus),
    message: getEducationProblemMessage(problem, fallbackStatus),
  };
};
