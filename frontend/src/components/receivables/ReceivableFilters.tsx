import { useId } from 'react';
import type { Invoice, Payer } from '../../types';

export type StatusFilter = 'all' | Invoice['status'];
export type SortBy = 'dueDate' | 'amount';
export type SortDir = 'asc' | 'desc';

export interface ReceivableFilterState {
  search: string;
  payerId: string;
  status: StatusFilter;
  sortBy: SortBy;
  sortDir: SortDir;
}

interface ReceivableFiltersProps {
  value: ReceivableFilterState;
  payers: Payer[];
  onChange: (next: ReceivableFilterState) => void;
}

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'paid', label: 'Paid' },
  { value: 'pending', label: 'Pending' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'promise_to_pay', label: 'Promise to Pay' },
];

const FIELD =
  'min-h-[44px] w-full rounded-xl border border-border bg-card px-3 text-sm text-text placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500';
const OPTION = 'bg-card text-text';
const LABEL = 'mb-1 block text-xs font-medium text-text/60';

export default function ReceivableFilters({ value, payers, onChange }: ReceivableFiltersProps) {
  const uid = useId();
  const update = (patch: Partial<ReceivableFilterState>) => onChange({ ...value, ...patch });

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      <div className="xl:col-span-2">
        <label htmlFor={`${uid}-search`} className={LABEL}>
          Search
        </label>
        <input
          id={`${uid}-search`}
          type="search"
          value={value.search}
          onChange={(e) => update({ search: e.target.value })}
          placeholder="Patient name or invoice ID"
          className={FIELD}
        />
      </div>

      <div>
        <label htmlFor={`${uid}-payer`} className={LABEL}>
          Payer
        </label>
        <select
          id={`${uid}-payer`}
          value={value.payerId}
          onChange={(e) => update({ payerId: e.target.value })}
          className={FIELD}
        >
          <option value="" className={OPTION}>All payers</option>
          {payers.map((p) => (
            <option key={p.id} value={p.id} className={OPTION}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor={`${uid}-status`} className={LABEL}>
          Status
        </label>
        <select
          id={`${uid}-status`}
          value={value.status}
          onChange={(e) => update({ status: e.target.value as StatusFilter })}
          className={FIELD}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value} className={OPTION}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={`${uid}-sort`} className={LABEL}>
            Sort by
          </label>
          <select
            id={`${uid}-sort`}
            value={value.sortBy}
            onChange={(e) => update({ sortBy: e.target.value as SortBy })}
            className={FIELD}
          >
            <option value="dueDate" className={OPTION}>Due date</option>
            <option value="amount" className={OPTION}>Amount</option>
          </select>
        </div>
        <div>
          <label htmlFor={`${uid}-dir`} className={LABEL}>
            Direction
          </label>
          <select
            id={`${uid}-dir`}
            value={value.sortDir}
            onChange={(e) => update({ sortDir: e.target.value as SortDir })}
            className={FIELD}
          >
            <option value="asc" className={OPTION}>Ascending</option>
            <option value="desc" className={OPTION}>Descending</option>
          </select>
        </div>
      </div>
    </div>
  );
}
