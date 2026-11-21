import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowRight, CheckCircle2, AlertTriangle, ShieldCheck, DollarSign } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getBillFundingChain } from '../../services/billService';
import { ApiError } from '../../services/api';
import type { BillFundingChain } from '../../types';

const SECONDARY_BTN =
  'inline-flex min-h-[44px] items-center justify-center rounded-xl border border-border bg-bg px-4 text-sm font-medium text-text transition-colors hover:bg-border/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-60';

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

function formatMoney(n: number): string {
  return currency.format(n);
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function messageFrom(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
}

export default function FundingChainPage() {
  const [chain, setChain] = useState<BillFundingChain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getBillFundingChain()
      .then((res) => {
        if (!cancelled) setChain(res);
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

  let body: ReactNode;
  if (loading) {
    body = (
      <div className="space-y-4" aria-busy="true" aria-label="Loading funding chain">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-36 animate-pulse rounded-2xl bg-border/40" />
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
  } else if (chain.length === 0) {
    body = (
      <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-text/60">
        No active bills found. Create bills to generate real-time funding chains.
      </div>
    );
  } else {
    const totalBills = chain.reduce((acc, c) => acc + c.amount, 0);
    const fullyCoveredCount = chain.filter((c) => c.status === 'fully_covered').length;
    const totalGap = chain.reduce((acc, c) => acc + c.gapAmount, 0);
    const gapCount = chain.filter((c) => c.gapAmount > 0).length;

    body = (
      <div className="space-y-6">
        {/* KPI metrics */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="text-xs uppercase tracking-wide text-text/60">Upcoming Bills</div>
            <div className="mt-2 text-2xl font-bold text-text">{formatMoney(totalBills)}</div>
            <div className="mt-1 text-xs text-text/60">{chain.length} upcoming obligations</div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="text-xs uppercase tracking-wide text-text/60">Fully Covered</div>
            <div className="mt-2 text-2xl font-bold text-teal-600 dark:text-teal-400">
              {fullyCoveredCount} of {chain.length}
            </div>
            <div className="mt-1 text-xs text-text/60">Covered by opening cash & receipts</div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="text-xs uppercase tracking-wide text-text/60">Funding Gaps</div>
            <div className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">
              {gapCount} bills
            </div>
            <div className="mt-1 text-xs text-text/60">Require early collection or deferral</div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="text-xs uppercase tracking-wide text-text/60">Total Deficit Gap</div>
            <div className="mt-2 text-2xl font-bold text-red-600 dark:text-red-400">
              {formatMoney(totalGap)}
            </div>
            <div className="mt-1 text-xs text-text/60">Rupee amount to bridge</div>
          </div>
        </section>

        {/* Funding chain cards */}
        <section className="space-y-4" aria-label="Bill funding chain list">
          {chain.map((item) => {
            const isCovered = item.status === 'fully_covered';
            const pct = Math.min(100, Math.round((item.fundedAmount / item.amount) * 100));

            return (
              <article
                key={item.billId}
                className="overflow-hidden rounded-2xl border border-border bg-card transition-shadow hover:shadow-md"
              >
                <div className="p-5 sm:p-6">
                  {/* Title and status */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-text">{item.billName}</h2>
                        <span className="rounded-md bg-border/50 px-2 py-0.5 text-xs text-text/70">
                          {item.dueInDays === 0
                            ? 'Due today'
                            : `Due in ${item.dueInDays} days (${formatDate(item.dueDate)})`}
                        </span>
                      </div>
                      <div className="mt-1 text-2xl font-semibold text-text">
                        {formatMoney(item.amount)}
                      </div>
                    </div>

                    <div>
                      {isCovered ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-100 px-3.5 py-1 text-xs font-semibold text-teal-800 dark:bg-teal-500/20 dark:text-teal-300">
                          <CheckCircle2 className="h-4 w-4" />
                          Fully Covered (gap ₹0)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                          <AlertTriangle className="h-4 w-4" />
                          Gap: {formatMoney(item.gapAmount)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Narrative Banner - Key differentiator */}
                  <div
                    className={`mt-4 rounded-xl border p-4 ${
                      isCovered
                        ? 'border-teal-500/30 bg-teal-500/10 text-teal-950 dark:bg-teal-500/15 dark:text-teal-100'
                        : 'border-amber-500/30 bg-amber-500/10 text-amber-950 dark:bg-amber-500/15 dark:text-amber-100'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 shrink-0">
                        {isCovered ? (
                          <ShieldCheck className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                        ) : (
                          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold leading-relaxed">{item.narrative}</p>
                        {item.recommendation && (
                          <p className="mt-1 text-xs opacity-90">{item.recommendation}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Funding progress */}
                  <div className="mt-4 space-y-1.5">
                    <div className="flex justify-between text-xs text-text/70">
                      <span>Funded: {formatMoney(item.fundedAmount)}</span>
                      <span>{pct}% allocated</span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-border/40">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isCovered ? 'bg-teal-500' : 'bg-amber-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Inflow Sources Breakdown */}
                  {item.sources.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-border/60">
                      <div className="text-xs font-medium uppercase tracking-wide text-text/60 mb-2">
                        Allocated Funding Sources
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {item.sources.map((s, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg/80 px-2.5 py-1 text-xs font-medium text-text"
                          >
                            <DollarSign className="h-3 w-3 text-teal-600 dark:text-teal-400" />
                            {s.name}:{' '}
                            <span className="font-semibold text-text">
                              {formatMoney(s.amount)}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Link for gaps */}
                  {!isCovered && (
                    <div className="mt-4 flex justify-end">
                      <Link
                        to="/dashboard/gap-closer"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600"
                      >
                        Bridge Gap in Gap Closer
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-text">Bill Funding Chain</h1>
          <p className="mt-1 text-sm text-text/60">
            Automated intelligence that pairs every upcoming expense with the exact expected
            collections that fund it, alerting you to exact cash gaps before they happen.
          </p>
        </div>
      </header>

      {body}
    </div>
  );
}
