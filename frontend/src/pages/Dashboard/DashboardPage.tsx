import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CalendarCheck,
  FileText,
  HeartPulse,
  Hourglass,
  Wallet,
} from 'lucide-react';
import SummaryCard from '../../components/common/SummaryCard';
import { getDashboardSummary } from '../../services';
import type { DashboardSummary } from '../../types';

type SummaryState =
  | { status: 'loading'; data: null; error: null }
  | { status: 'error'; data: null; error: string }
  | { status: 'ready'; data: DashboardSummary | null; error: null };

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

function formatMoney(value: number | undefined): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? currencyFormatter.format(value)
    : '—';
}

function formatNumber(value: number | undefined): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? String(value)
    : '—';
}

function formatDays(value: number | undefined): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? `${value} days`
    : '—';
}

function SkeletonCard() {
  return (
    <div className="h-32 animate-pulse rounded-2xl border border-border bg-card">
      <div className="m-5 h-full rounded-xl bg-border/40" />
    </div>
  );
}

export default function DashboardPage() {
  const [state, setState] = useState<SummaryState>({
    status: 'loading',
    data: null,
    error: null,
  });

  const load = useCallback(() => {
    let cancelled = false;
    setState({ status: 'loading', data: null, error: null });

    getDashboardSummary()
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data: data ?? null, error: null });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof Error && err.message
            ? err.message
            : 'Could not load the dashboard summary.';
        setState({ status: 'error', data: null, error: message });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => load(), [load]);

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold text-text">Overview</h1>
        <p className="mt-1 text-sm text-muted">Your clinic's financial snapshot.</p>
      </header>

      {state.status === 'loading' && (
        <div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
          aria-busy="true"
          aria-label="Loading summary"
        >
          {Array.from({ length: 6 }, (_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {state.status === 'error' && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-red-500" role="alert">
            {state.error}
          </p>
          <button
            type="button"
            onClick={() => load()}
            className="mt-3 inline-flex min-h-[44px] items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground hover:opacity-90"
          >
            Retry
          </button>
        </div>
      )}

      {state.status === 'ready' && !state.data && (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm text-muted">No dashboard data yet.</p>
        </div>
      )}

      {state.status === 'ready' && state.data && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <SummaryCard
            title="Opening Cash"
            value={formatMoney(state.data.openingCash)}
            icon={Wallet}
            description="Cash available at the start of the period"
          />
          <SummaryCard
            title="Total Outstanding"
            value={formatMoney(state.data.totalOutstanding)}
            icon={FileText}
            description="Invoices not yet collected"
          />
          <SummaryCard
            title="Overdue Amount"
            value={formatMoney(state.data.overdueAmount)}
            icon={AlertTriangle}
            statusTone="danger"
            description="Past due and still unpaid"
          />
          <SummaryCard
            title="Expected Collections"
            value={formatMoney(state.data.expectedCollections)}
            icon={CalendarCheck}
            statusTone="success"
            description="Forecast incoming payments"
          />
          <SummaryCard
            title="Cash Runway"
            value={formatDays(state.data.cashRunwayDays)}
            icon={Hourglass}
            description="Days of expenses covered"
          />
          <SummaryCard
            title="Financial Health Score"
            value={formatNumber(state.data.financialHealthScore)}
            icon={HeartPulse}
            description="Overall cash-flow health"
          />
        </div>
      )}
    </section>
  );
}
