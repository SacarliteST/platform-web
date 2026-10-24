import { Alert, Text } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  getGetCourseClassAccessQueryKey,
  useGetCourseClassAccess,
} from '../../api/education/class-windows/class-windows';

type ClassAccess = {
  /** Практика и тесты сейчас закрыты режимом «только на парах». */
  locked: boolean;
};

const ClassAccessContext = createContext<ClassAccess>({ locked: false });

/** Закрыты ли сейчас тесты и практика курса (вне провайдера — всегда открыто). */
export function useClassLock(): boolean {
  return useContext(ClassAccessContext).locked;
}

/** Оставшееся время вида «мм:сс» или «ч:мм:сс». */
export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Состояние пары для студента: баннер сверху и признак блокировки практики для потомков.
 * Теория и результаты остаются открытыми — блокируются только запуск тестов, практики и сдача файлов.
 */
export function ClassAccessGate({ courseId, children }: { courseId: string; children: ReactNode }) {
  const queryClient = useQueryClient();
  const query = useGetCourseClassAccess(courseId, {
    query: { enabled: Boolean(courseId), retry: false, refetchInterval: 15_000 },
  });
  const access = query.data?.status === 200 ? query.data.data : undefined;
  const endsAt = access?.endsAt ? new Date(access.endsAt).getTime() : null;

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!access?.isOpen || endsAt === null) {
      return;
    }
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [access?.isOpen, endsAt]);

  const expired = Boolean(access?.isOpen && endsAt !== null && now >= endsAt);
  useEffect(() => {
    if (expired) {
      void queryClient.invalidateQueries({ queryKey: getGetCourseClassAccessQueryKey(courseId) });
    }
  }, [expired, queryClient, courseId]);

  const locked = Boolean(access?.practiceOnlyDuringClass && (!access.isOpen || expired));
  const value = useMemo(() => ({ locked }), [locked]);

  return (
    <ClassAccessContext.Provider value={value}>
      {access?.practiceOnlyDuringClass ? (
        locked ? (
          <Alert color="yellow" variant="light" title="Практика и тесты закрыты">
            <Text size="sm">
              Они доступны только во время пары — когда преподаватель начнёт её для вашей группы.
              Теория и результаты открыты всегда.
            </Text>
          </Alert>
        ) : (
          <Alert color="green" variant="light" title="Идёт пара">
            <Text size="sm">
              Практика и тесты открыты
              {endsAt !== null ? `. Осталось ${formatRemaining(endsAt - now)}` : ''}.
            </Text>
          </Alert>
        )
      ) : null}
      {children}
    </ClassAccessContext.Provider>
  );
}
