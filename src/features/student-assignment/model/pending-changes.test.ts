import { describe, expect, it } from 'vitest';
import {
  buildChangeBatches,
  countPending,
  isEffectivelyAssigned,
  setStudentAssigned,
  setStudentsAssigned,
  type PendingChanges,
  type StudentRef,
} from './pending-changes';

const ann: StudentRef = { id: 'a', name: 'Анна', isAssigned: false };
const bob: StudentRef = { id: 'b', name: 'Борис', isAssigned: true };
const empty: PendingChanges = new Map();

describe('pending-changes', () => {
  it('запоминает отличие от серверного состояния и снимает правку при возврате', () => {
    const added = setStudentAssigned(empty, ann, true);
    expect(added.get('a')).toEqual({ assigned: true, name: 'Анна' });

    const reverted = setStudentAssigned(added, ann, false);
    expect(reverted.size).toBe(0);
  });

  it('не мутирует исходную карту', () => {
    setStudentAssigned(empty, ann, true);
    expect(empty.size).toBe(0);
  });

  it('не создаёт правку, если состояние уже такое на сервере', () => {
    expect(setStudentAssigned(empty, bob, true).size).toBe(0);
  });

  it('учитывает правки при определении итогового состояния строки', () => {
    const pending = setStudentAssigned(setStudentAssigned(empty, ann, true), bob, false);
    expect(isEffectivelyAssigned(pending, ann)).toBe(true);
    expect(isEffectivelyAssigned(pending, bob)).toBe(false);
    expect(isEffectivelyAssigned(empty, bob)).toBe(true);
  });

  it('считает добавляемых и снимаемых', () => {
    const pending = setStudentsAssigned(empty, [ann, bob], true);
    expect(countPending(pending)).toEqual({ add: 1, remove: 0 });
    expect(countPending(setStudentsAssigned(pending, [bob], false))).toEqual({ add: 1, remove: 1 });
  });

  it('делит правки на запросы по лимиту в каждом списке', () => {
    const students: StudentRef[] = Array.from({ length: 5 }, (_, index) => ({
      id: `n${index}`,
      name: `N${index}`,
      isAssigned: false,
    }));
    const removed: StudentRef[] = Array.from({ length: 2 }, (_, index) => ({
      id: `r${index}`,
      name: `R${index}`,
      isAssigned: true,
    }));
    const pending = setStudentsAssigned(setStudentsAssigned(empty, students, true), removed, false);

    const batches = buildChangeBatches(pending, 2);

    expect(batches).toHaveLength(3);
    expect(batches.flatMap((batch) => batch.add)).toEqual(['n0', 'n1', 'n2', 'n3', 'n4']);
    expect(batches.flatMap((batch) => batch.remove)).toEqual(['r0', 'r1']);
    expect(batches.every((batch) => batch.add.length <= 2 && batch.remove.length <= 2)).toBe(true);
  });

  it('без правок запросов нет', () => {
    expect(buildChangeBatches(empty)).toEqual([]);
  });
});
