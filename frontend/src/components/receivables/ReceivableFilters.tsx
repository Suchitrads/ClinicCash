import { useId } from 'react';
import type { Invoice, Payer } from '../../types';
import { ThemedSelect } from '../ui/ThemedSelect';

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
  'min-h-[44px] w-full rounded-xl border border-border bg-card px-3 text-sm text-text placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent';
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
        <ThemedSelect
          id={`${uid}-payer`}
          ariaLabel="Payer"
          value={value.payerId}
          onChange={(v) => update({ payerId: v })}
          options={[
            { value: '', label: 'All payers' },
            ...payers.map((p) => ({ value: p.id, label: p.name })),
          ]}
        />
      </div>

      <div>
        <label htmlFor={`${uid}-status`} className={LABEL}>
          Status
        </label>
        <ThemedSelect
          id={`${uid}-status`}
          ariaLabel="Status"
          value={value.status}
          onChange={(v) => update({ status: v as StatusFilter })}
          options={STATUS_OPTIONS}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={`${uid}-sort`} className={LABEL}>
            Sort by
          </label>
          <ThemedSelect
            id={`${uid}-sort`}
            ariaLabel="Sort by"
            value={value.sortBy}
            onChange={(v) => update({ sortBy: v as SortBy })}
            options={[
              { value: 'dueDate', label: 'Due date' },
              { value: 'amount', label: 'Amount' },
            ]}
          />
        </div>
        <div>
          <label htmlFor={`${uid}-dir`} className={LABEL}>
            Direction
          </label>
          <ThemedSelect
            id={`${uid}-dir`}
            ariaLabel="Direction"
            value={value.sortDir}
            onChange={(v) => update({ sortDir: v as SortDir })}
            options={[
              { value: 'asc', label: 'Ascending' },
              { value: 'desc', label: 'Descending' },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
