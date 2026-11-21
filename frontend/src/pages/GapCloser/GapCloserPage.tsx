import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { executeGapAction, getGapActions } from '../../services/forecastService';
import { ApiError } from '../../services/api';
import type { GapAction } from '../../types';
import { ThemedSelect } from '../../components/ui/ThemedSelect';

const SECONDARY_BTN =
  'inline-flex min-h-[44px] items-center justify-center rounded-xl border border-border bg-bg px-4 text-sm font-medium text-text transition-colors hover:bg-border/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60';
const RUN_BTN =
  'inline-flex min-h-[44px] items-center justify-center rounded-xl bg-teal-600 px-4 text-sm font-medium text-white transition-colors hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60 dark:bg-teal-500 dark:hover:bg-teal-400';

type EffortFilter = 'all' | GapAction['effort'];
type SortKey = 'amount' | 'effort';

const EFFORT_FILTER_OPTIONS = [
  { value: 'all', label: 'All efforts' },
  { value: 'low', label: 'Low effort' },
  { value: 'medium', label: 'Medium effort' },
  { value: 'high', label: 'High effort' },
];

const SORT_OPTIONS = [
  { value: 'amount', label: 'Highest amount' },
  { value: 'effort', label: 'Lowest effort first' },
];

const EFFORT_RANK: Record<GapAction['effort'], number> = { low: 0, medium: 1, high: 2 };

const EFFORT_PILL: Record<GapAction['effort'], string> = {
  low: 'bg-teal-100 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  high: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
};

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

function formatMoney(n: number): string {
  return currency.format(n);
}

function messageFrom(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
}

interface SummaryCardProps {
  label: string;
  value: string;
}

function SummaryCard({ label, value }: SummaryCardProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="text-xs uppercase tracking-wide text-text/60">{label}</div>
      <div className="mt-2 text-xl font-semibold text-text">{value}</div>
    </div>
  );
}

interface GapActionCardProps {
  action: GapAction;
  running: boolean;
  error: string | null;
  onRun: () => void;
}

function GapActionCard({ action, running, error, onRun }: GapActionCardProps) {
  return (
    <article className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold text-text">{action.title}</h2>
          <div className="mt-1 text-lg font-semibold text-text">
            {formatMoney(action.estimatedAmount)}
          </div>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${EFFORT_PILL[action.effort]}`}
        >
          {action.effort} effort
        </span>
      </div>
      <dl className="mt-3 space-y-2 text-sm">
        <div>
          <dt className="text-xs text-text/60">Impact</dt>
          <dd className="text-text">{action.impact}</dd>
        </div>
        <div>
          <dt className="text-xs text-text/60">Explanation</dt>
          <dd className="text-text">{action.explanation}</dd>
        </div>
      </dl>
      <div className="mt-4">
        <button type="button" onClick={onRun} disabled={running} className={RUN_BTN}>
          {running ? 'Running…' : 'Run action'}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </article>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading gap actions">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-32 animate-pulse rounded-2xl bg-border/40" />
      ))}
    </div>
  );
}

export default function GapCloserPage() {
  const [actions, setActions] = useState<GapAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [effortFilter, setEffortFilter] = useState<EffortFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('amount');
  const [runningIds, setRunningIds] = useState<Set<string>>(() => new Set());
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getGapActions()
      .then((data) => {
        if (!cancelled) setActions(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(messageFrom(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const totalRecovery = actions.reduce((sum, a) => sum + a.estimatedAmount, 0);
  const lowEffortCount = actions.filter((a) => a.effort === 'low').length;

  const visibleActions = useMemo(() => {
    const filtered = effortFilter === 'all' ? actions : actions.filter((a) => a.effort === effortFilter);
    const sorted = [...filtered];
    if (sortKey === 'amount') {
      sorted.sort((a, b) => b.estimatedAmount - a.estimatedAmount);
    } else {
      sorted.sort(
        (a, b) => EFFORT_RANK[a.effort] - EFFORT_RANK[b.effort] || b.estimatedAmount - a.estimatedAmount,
      );
    }
    return sorted;
  }, [actions, effortFilter, sortKey]);

  async function handleRun(id: string) {
    setRunningIds((prev) => new Set(prev).add(id));
    setActionErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    try {
      const updated = await executeGapAction(id);
      setActions((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } catch (err: unknown) {
      setActionErrors((prev) => ({ ...prev, [id]: messageFrom(err) }));
    } finally {
      setRunningIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  let body: ReactNode;
  if (loading) {
    body = <LoadingSkeleton />;
  } else if (error) {
    body = (
      <div
        role="alert"
        className="flex flex-col gap-3 rounded-2xl border border-red-300 bg-red-50 p-5 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300 sm:flex-row sm:items-center sm:justify-between"
      >
        <p>{error}</p>
        <button type="button" onClick={() => setReloadKey((k) => k + 1)} className={SECONDARY_BTN}>
          Retry
        </button>
      </div>
    );
  } else if (actions.length === 0) {
    body = (
      <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-text/60">
        No gap-closing actions right now.
      </div>
    );
  } else {
    body = (
      <div className="space-y-6">
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3" aria-label="Gap closer summary">
          <SummaryCard label="Total estimated recovery" value={formatMoney(totalRecovery)} />
          <SummaryCard label="Actions" value={String(actions.length)} />
          <SummaryCard label="Low-effort actions" value={String(lowEffortCount)} />
        </section>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:max-w-xl">
          <ThemedSelect
            value={effortFilter}
            onChange={(v) => setEffortFilter(v as EffortFilter)}
            options={EFFORT_FILTER_OPTIONS}
            ariaLabel="Filter by effort"
          />
          <ThemedSelect
            value={sortKey}
            onChange={(v) => setSortKey(v as SortKey)}
            options={SORT_OPTIONS}
            ariaLabel="Sort gap actions"
          />
        </div>

        {visibleActions.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-text/60">
            No actions match this filter.
          </div>
        ) : (
          <section className="grid grid-cols-1 gap-4 xl:grid-cols-2" aria-label="Gap actions">
            {visibleActions.map((action) => (
              <GapActionCard
                key={action.id}
                action={action}
                running={runningIds.has(action.id)}
                error={actionErrors[action.id] ?? null}
                onRun={() => handleRun(action.id)}
              />
            ))}
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-text">Gap Closer</h1>
        <p className="mt-1 text-sm text-text/60">
          Actions that close the gap between projected cash and your safety buffer, with estimated recovery for each.
        </p>
      </header>

      {body}
    </div>
  );
}
