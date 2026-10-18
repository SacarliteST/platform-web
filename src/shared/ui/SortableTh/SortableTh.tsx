import { Table, UnstyledButton } from '@mantine/core';
import type { ReactNode } from 'react';
import type { SortDirection } from '../../lib';

type Props = {
  children: ReactNode;
  active: boolean;
  direction: SortDirection;
  onSort: () => void;
  w?: number;
};

/** Заголовок столбца с сортировкой по клику; стрелка показывает направление активного столбца. */
export function SortableTh({ children, active, direction, onSort, w }: Props) {
  return (
    <Table.Th w={w} aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <UnstyledButton onClick={onSort} fw={600} fz="sm" style={{ whiteSpace: 'nowrap' }}>
        {children}
        <span aria-hidden="true" style={{ marginLeft: 4, opacity: active ? 1 : 0.25 }}>
          {active ? (direction === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </UnstyledButton>
    </Table.Th>
  );
}
