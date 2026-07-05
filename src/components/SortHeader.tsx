import type { ReactElement } from 'react';
import type { SortState } from '@/lib/tableSort';

export interface SortHeaderProps<K extends string> {
  columnKey: K;
  sort: SortState<K> | null;
  onToggle: (key: K) => void;
  label: string;
  align?: 'left' | 'right';
}

/** Clickable <th>: click sorts ascending, again descending, again clears. */
export default function SortHeader<K extends string>({
  columnKey,
  sort,
  onToggle,
  label,
  align = 'left',
}: SortHeaderProps<K>): ReactElement {
  const active = sort?.key === columnKey;
  return (
    <th
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
      className={`px-4 py-3 ${align === 'right' ? 'text-right' : ''}`}
    >
      <button
        type="button"
        onClick={() => onToggle(columnKey)}
        className={`inline-flex items-center gap-1 uppercase tracking-wide transition hover:text-zinc-200 ${
          active ? 'text-accent-soft' : ''
        }`}
      >
        {label}
        <span aria-hidden="true" className="w-3 text-[10px]">
          {active ? (sort.dir === 'asc' ? '▲' : '▼') : ''}
        </span>
      </button>
    </th>
  );
}
