import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { executeGapAction, getGapActions } from '../../services/forecastService';
import { ApiError } from '../../services/api';
import type { GapAction } from '../../types';

const SECONDARY_BTN =
  'inline-flex min-h-[44px] items-center justify-center rounded-xl border border-border bg-bg px-4 text-sm font-medium text-text transition-colors hover:bg-border/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-60';

const ACCENT_BTN =
  'inline-flex min-h-[44px] items-center justify-center rounded-xl bg-teal-600 px-4 text-sm font-medium text-white transition-colors hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-60 dark:bg-teal-400 dark:text-slate-900 dark:hover:bg-teal-300';

const EFFORT_LABEL: Record<GapAction['effort'], string> = {
  low: 'Low effort',
  medium: 'Medium effort',
  high: 'High effort',
};

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

function messageFrom(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
}

export default function FundingChainPage() {
  const [actions, setActions] = useState<GapAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getGapActions()
      .then((res) => {
        if (!cancelled) setActions(res);
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

  async function handleExecute(id: string) {
    setRunningId(id);
    setActionError(null);
    try {
      await executeGapAction(id);
      setReloadKey((k) => k + 1);
    } catch (err: unknown) {
      setActionError(messageFrom(err));
    } finally {
      setRunningId(null);
    }
  }

  let body: ReactNode;
  if (loading) {
    body = (
      <div className="space-y-3" aria-busy="true" aria-label="Loading funding chain">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-border/40" />
        ))}
      </div>
    );
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
        No funding actions available right now.
      </div>
    );
  } else {
    body = (
      <ul className="space-y-4" aria-label="Funding chain actions">
        {actions.map((action) => {
          const running = runningId === action.id;
          return (
            <li key={action.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-2">
                  <h2 className="text-base font-semibold text-text">{action.title}</h2>
                  <p className="text-sm text-text/60">{action.explanation}</p>
                  <div className="flex flex-wrap gap-2 pt-1 text-xs">
                    <span className="rounded-full border border-border px-3 py-1 text-text">
                      {EFFORT_LABEL[action.effort]}
                    </span>
                    <span className="rounded-full border border-border px-3 py-1 text-text">
                      Impact: {action.impact}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                  <div className="text-xs uppercase tracking-wide text-text/60">Estimated</div>
                  <div className="text-xl font-semibold text-text">
                    {currency.format(action.estimatedAmount)}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleExecute(action.id)}
                    disabled={runningId !== null}
                    aria-busy={running}
                    className={ACCENT_BTN}
                  >
                    {running ? 'Running…' : 'Run action'}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-text">Funding Chain</h1>
        <p className="mt-1 text-sm text-text/60">
          Actions that can close the cash gap, with estimated amounts and effort.
        </p>
      </header>

      {actionError && (
        <div
          role="alert"
          className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300"
        >
          {actionError}
        </div>
      )}

      {body}
    </div>
  );
}
