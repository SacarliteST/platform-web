import type {
  ProblemDetails,
  ValidationProblemDetails,
} from '../../../api/identity/model';
import {
  getIdentityProblemFieldErrors,
  getIdentityProblemMessage,
  getIdentityProblemPresentation,
  getIdentityProblemTitle,
  isIdentityValidationProblem,
} from '../../../shared/lib/identity-problem-details';

export type AdminUsersApiProblem = ProblemDetails | ValidationProblemDetails;

export class AdminUsersApiError extends Error {
  readonly status: number;
  readonly problem: AdminUsersApiProblem;

  constructor(status: number, problem: AdminUsersApiProblem) {
    super(getAdminUsersErrorMessage(problem, status));
    this.name = 'AdminUsersApiError';
    this.status = status;
    this.problem = problem;
  }
}

export const isValidationProblemDetails = (
  problem: AdminUsersApiProblem,
): problem is ValidationProblemDetails => {
  return isIdentityValidationProblem(problem);
};

export const getAdminUsersErrorTitle = (
  problem: AdminUsersApiProblem,
  fallbackStatus?: number,
): string => getIdentityProblemTitle(problem, fallbackStatus);

export const getAdminUsersErrorMessage = (
  problem: AdminUsersApiProblem,
  fallbackStatus?: number,
): string => getIdentityProblemMessage(problem, fallbackStatus);

export const getAdminUsersErrorPresentation = (
  problem: AdminUsersApiProblem,
  fallbackStatus?: number,
) => getIdentityProblemPresentation(problem, fallbackStatus);

export const getAdminUsersFieldErrors = (error: unknown): Record<string, string[]> => {
  if (error instanceof AdminUsersApiError && isValidationProblemDetails(error.problem)) {
    return getIdentityProblemFieldErrors(error.problem);
  }

  return {};
};
