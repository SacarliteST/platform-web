import { useQuery } from '@tanstack/react-query';
import { educationFetch } from '../../../shared/http';

/**
 * Строка списка попыток внешнего модуля по практике (преподаватель).
 *
 * TODO: заменить на сгенерированный `useListPracticalModuleSessions` после
 * ре-экспорта OpenAPI (эндпоинт добавлен в Education коммитом `3d7b688`,
 * в текущем `education.swagger.json` его ещё нет).
 */
export type ModuleSessionSummary = {
  sessionId: string;
  userId: string;
  studentName: string;
  tryNumber: number;
  status: string;
  endReason: string | null;
  grade: number | null;
  startedAt: string;
  endedAt: string | null;
};

type FetchResult = {
  data: ModuleSessionSummary[] | unknown;
  status: number;
};

export function getModuleSessionsListQueryKey(practicalId: string) {
  return ['education', 'practicals', practicalId, 'module-sessions', 'list'] as const;
}

export function useModuleSessionsList(practicalId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: getModuleSessionsListQueryKey(practicalId),
    enabled: (options?.enabled ?? true) && Boolean(practicalId),
    retry: false,
    queryFn: async () => {
      const response = await educationFetch<FetchResult>(
        `/api/v1/practicals/${practicalId}/module-sessions`,
        { method: 'GET' },
      );
      return {
        status: response.status,
        rows: response.status === 200 ? (response.data as ModuleSessionSummary[]) : [],
      };
    },
  });
}
