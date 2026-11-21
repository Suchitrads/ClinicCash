import type { Invoice } from '../../types';

type Status = Invoice['status'];

const LABELS: Record<Status, string> = {
  paid: 'Paid',
  pending: 'Pending',
  overdue: 'Overdue',
  promise_to_pay: 'Promise to Pay',
};

const STYLES: Record<Status, { badge: string; dot: string }> = {
  paid: {
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  pending: {
    badge: 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300',
    dot: 'bg-slate-400',
  },
  overdue: {
    badge: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
    dot: 'bg-red-500',
  },
  promise_to_pay: {
    badge: 'bg-teal-100 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300',
    dot: 'bg-teal-500',
  },
};

interface ReceivableStatusBadgeProps {
  status: Status;
}

export default function ReceivableStatusBadge({ status }: ReceivableStatusBadgeProps) {
  const style = STYLES[status];
  return (
    <span
      className={`inline-flex min-h-[24px] items-center gap-1.5 rounded-full px-2.5 text-xs font-medium ${style.badge}`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {LABELS[status]}
    </span>
  );
}
