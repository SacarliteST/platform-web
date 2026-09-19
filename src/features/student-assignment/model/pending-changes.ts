/** Максимум идентификаторов в каждом из списков одного запроса на изменение — как на сервере. */
export const CHANGE_BATCH_LIMIT = 2000;

export type StudentRef = {
  id: string;
  name: string;
  /** Назначен ли студент на сервере сейчас. */
  isAssigned: boolean;
};

/** Несохранённые правки: только те студенты, чьё желаемое состояние отличается от серверного. */
export type PendingChanges = ReadonlyMap<string, { assigned: boolean; name: string }>;

export type ChangeBatch = { add: string[]; remove: string[] };

/** Ставит желаемое состояние студента; если оно совпало с серверным — правка снимается. */
export function setStudentAssigned(
  pending: PendingChanges,
  student: StudentRef,
  assigned: boolean,
): PendingChanges {
  const next = new Map(pending);
  if (assigned === student.isAssigned) {
    next.delete(student.id);
  } else {
    next.set(student.id, { assigned, name: student.name });
  }
  return next;
}

export function setStudentsAssigned(
  pending: PendingChanges,
  students: readonly StudentRef[],
  assigned: boolean,
): PendingChanges {
  return students.reduce((acc, student) => setStudentAssigned(acc, student, assigned), pending);
}

/** Желаемое состояние строки с учётом несохранённых правок. */
export function isEffectivelyAssigned(pending: PendingChanges, student: StudentRef): boolean {
  return pending.get(student.id)?.assigned ?? student.isAssigned;
}

export function countPending(pending: PendingChanges): { add: number; remove: number } {
  let add = 0;
  for (const change of pending.values()) {
    if (change.assigned) add += 1;
  }
  return { add, remove: pending.size - add };
}

/** Делит правки на запросы не больше `limit` идентификаторов в каждом списке. */
export function buildChangeBatches(
  pending: PendingChanges,
  limit: number = CHANGE_BATCH_LIMIT,
): ChangeBatch[] {
  const add: string[] = [];
  const remove: string[] = [];
  for (const [id, change] of pending) {
    (change.assigned ? add : remove).push(id);
  }

  const count = Math.max(Math.ceil(add.length / limit), Math.ceil(remove.length / limit));
  return Array.from({ length: count }, (_, index) => ({
    add: add.slice(index * limit, (index + 1) * limit),
    remove: remove.slice(index * limit, (index + 1) * limit),
  }));
}
