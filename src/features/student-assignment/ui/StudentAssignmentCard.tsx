import { Alert, Button, Checkbox, Group, Stack, Text } from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetCourseAssignableStudentsQueryKey,
  getGetPracticalAssignableStudentsQueryKey,
  useGetCourseAssignableStudents,
  useGetPracticalAssignableStudents,
  useSetCourseStudents,
  useSetPracticalStudents,
} from '../../../api/education/admin-profiles/admin-profiles';
import { getEducationProblemMessage } from '../../../shared/lib';
import { AppCard, QueryBoundary } from '../../../shared/ui';

type Props = {
  kind: 'course' | 'practical';
  id: string;
};

/** Преподаватель: назначение студентов на курс / практику (полный набор заменяется одним PUT). */
export function StudentAssignmentCard({ kind, id }: Props) {
  const isCourse = kind === 'course';

  const courseQuery = useGetCourseAssignableStudents(id, {
    query: { enabled: isCourse && Boolean(id), retry: false },
  });
  const practicalQuery = useGetPracticalAssignableStudents(id, {
    query: { enabled: !isCourse && Boolean(id), retry: false },
  });
  const listQuery = isCourse ? courseQuery : practicalQuery;

  const setCourse = useSetCourseStudents();
  const setPractical = useSetPracticalStudents();
  const pending = isCourse ? setCourse.isPending : setPractical.isPending;

  const queryClient = useQueryClient();
  const rows = listQuery.data?.status === 200 ? listQuery.data.data : undefined;

  const [selected, setSelected] = useState<string[]>([]);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (rows) {
      setSelected(rows.filter((row) => row.isAssigned).map((row) => row.legacyUserId));
    }
  }, [rows]);

  const dirty = useMemo(() => {
    if (!rows) {
      return false;
    }
    const before = new Set(rows.filter((row) => row.isAssigned).map((row) => row.legacyUserId));
    if (before.size !== selected.length) {
      return true;
    }
    return selected.some((current) => !before.has(current));
  }, [rows, selected]);

  const save = async () => {
    setNotice(null);
    const response = await (isCourse
      ? setCourse.mutateAsync({ courseId: id, data: { userIds: selected } })
      : setPractical.mutateAsync({ practicalId: id, data: { userIds: selected } })
    ).catch(() => null);

    if (!response) {
      setNotice({ tone: 'err', text: 'Education API недоступен.' });
      return;
    }
    if (response.status === 204) {
      setNotice({ tone: 'ok', text: 'Список студентов сохранён.' });
      await queryClient.invalidateQueries({
        queryKey: isCourse
          ? getGetCourseAssignableStudentsQueryKey(id)
          : getGetPracticalAssignableStudentsQueryKey(id),
      });
      return;
    }
    if (response.status === 403) {
      setNotice({ tone: 'err', text: 'Нет доступа — курс или практика принадлежат другому преподавателю.' });
      return;
    }
    setNotice({
      tone: 'err',
      text:
        response.data && typeof response.data === 'object'
          ? getEducationProblemMessage(response.data, response.status)
          : 'Не удалось сохранить список студентов.',
    });
  };

  return (
    <AppCard p="md">
      <Stack gap="sm">
        <Text fw={600}>Студенты</Text>

        {notice ? (
          <Alert
            color={notice.tone === 'ok' ? 'green' : 'red'}
            variant="light"
            withCloseButton
            onClose={() => setNotice(null)}
          >
            {notice.text}
          </Alert>
        ) : null}

        <QueryBoundary
          isPending={listQuery.isPending}
          isError={listQuery.isError || listQuery.data?.status !== 200}
          data={rows}
          errorTitle="Education API недоступен"
          emptyTitle="Нет учебных профилей"
          emptyDescription="Заведите профили пользователей в админке."
          isEmpty={(items) => items.length === 0}
        >
          {(items) => (
            <Checkbox.Group value={selected} onChange={setSelected}>
              <Stack gap="xs">
                {items.map((student) => (
                  <Checkbox
                    key={student.legacyUserId}
                    value={student.legacyUserId}
                    label={student.fullName?.trim() || student.legacyUserId}
                  />
                ))}
              </Stack>
            </Checkbox.Group>
          )}
        </QueryBoundary>

        <Group justify="flex-end">
          <Button size="xs" disabled={!dirty} loading={pending} onClick={() => void save()}>
            Сохранить
          </Button>
        </Group>
      </Stack>
    </AppCard>
  );
}
