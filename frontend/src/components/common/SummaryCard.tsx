import type { LucideIcon } from 'lucide-react';

export type SummaryStatusTone = 'neutral' | 'success' | 'warning' | 'danger';

export interface SummaryCardProps {
  title: string;
  value: string;
  description: string;
  icon: LucideIcon;
  statusTone?: SummaryStatusTone;
}

const toneDotClass: Record<SummaryStatusTone, string> = {
  neutral: 'bg-accent',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
};

export default function SummaryCard({
  title,
  value,
  description,
  icon: Icon,
  statusTone = 'neutral',
}: SummaryCardProps) {
  return (
    <div className="rounded-2xl bg-card border border-border p-5 shadow-sm hover:shadow-md transition">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-600 dark:bg-teal-950 dark:text-teal-400">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <span
          className={`mt-1 h-2 w-2 rounded-full ${toneDotClass[statusTone]}`}
          style={{ width: 8, height: 8 }}
          aria-hidden="true"
        />
      </div>
      <p className="mt-4 text-sm text-muted">{title}</p>
      <p className="mt-1 text-2xl font-semibold text-text">{value}</p>
      <p className="mt-1 text-xs text-muted">{description}</p>
    </div>
  );
}
