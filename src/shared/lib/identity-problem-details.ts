import type { ProblemDetails, ValidationProblemDetails } from '../../api/identity/model';

export type IdentityApiProblem = ProblemDetails | ValidationProblemDetails;

export type IdentityApiProblemPresentation = {
  title: string;
  message: string;
};

export const isIdentityValidationProblem = (
  problem: IdentityApiProblem,
): problem is ValidationProblemDetails => {
  return 'errors' in problem;
};

const fallbackTitleByStatus: Record<number, string> = {
  401: 'Требуется вход',
  403: 'Недостаточно прав',
  404: 'Данные не найдены',
  409: 'Конфликт состояния',
  422: 'Ошибка валидации',
};

const fallbackMessageByStatus: Record<number, string> = {
  401: 'Необходимо войти в систему повторно.',
  403: 'Недостаточно прав для выполнения действия.',
  404: 'Запрошенные данные не найдены.',
  409: 'Действие конфликтует с текущим состоянием данных.',
  422: 'Проверьте корректность заполнения формы.',
};

export const getIdentityProblemFieldErrors = (
  problem: IdentityApiProblem,
): Record<string, string[]> => {
  if (!isIdentityValidationProblem(problem)) {
    return {};
  }

  return (problem.errors ?? {}) as Record<string, string[]>;
};

export const getIdentityProblemErrorMessages = (problem: IdentityApiProblem): string[] => {
  return Object.values(getIdentityProblemFieldErrors(problem)).flatMap((messages) => messages);
};

export const getIdentityProblemMessage = (
  problem: IdentityApiProblem,
  fallbackStatus?: number,
): string => {
  const validationMessages = getIdentityProblemErrorMessages(problem);

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

export const getIdentityProblemTitle = (
  problem: IdentityApiProblem,
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

export const getIdentityProblemPresentation = (
  problem: IdentityApiProblem,
  fallbackStatus?: number,
): IdentityApiProblemPresentation => {
  return {
    title: getIdentityProblemTitle(problem, fallbackStatus),
    message: getIdentityProblemMessage(problem, fallbackStatus),
  };
};

export const getIdentityProblemStringValues = (problem: IdentityApiProblem): string[] => {
  return Object.values(problem).filter((value): value is string => typeof value === 'string');
};
