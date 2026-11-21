import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { getForecast } from '../../services/forecastService';
import { ApiError } from '../../services/api';
import type { ForecastResponse } from '../../types';
import { ThemedSelect } from '../../components/ui/ThemedSelect';

const SECONDARY_BTN =
  'inline-flex min-h-[44px] items-center justify-center rounded-xl border border-border bg-bg px-4 text-sm font-medium text-text transition-colors hover:bg-border/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-60';

const HORIZON_OPTIONS = [
  { value: '30', label: 'Next 30 days' },
  { value: '60', label: 'Next 60 days' },
  { value: '90', label: 'Next 90 days' },
];

const COLUMNS = ['Date', 'Likely', 'Cautious', 'What-if', 'Safety buffer', 'Zero line'];

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

function formatMoney(n: number): string {
  return currency.format(n);
}

// Parse YYYY-MM-DD as a local date so the day does not shift with timezone.
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

interface SummaryCardProps {
  label: string;
  value: string;
  tone?: 'default' | 'negative';
}

function SummaryCard({ label, value, tone = 'default' }: SummaryCardProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="text-xs uppercase tracking-wide text-text/60">{label}</div>
      <div
        className={`mt-2 text-xl font-semibold ${
          tone === 'negative' ? 'text-red-700 dark:text-red-300' : 'text-text'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

export default function ForecastPage() {
  const [horizon, setHorizon] = useState<string>('30');
  const [data, setData] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getForecast(Number(horizon))
      .then((res) => {
        if (!cancelled) setData(res);
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
  }, [horizon, reloadKey]);

  let body: ReactNode;
  if (loading) {
    body = (
      <div className="space-y-3" aria-busy="true" aria-label="Loading forecast">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-border/40" />
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
  } else if (!data || data.points.length === 0) {
    body = (
      <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-text/60">
        No forecast data for this period.
      </div>
    );
  } else {
    const net = data.expectedCollections - data.upcomingExpenses;
    body = (
      <div className="space-y-6">
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Forecast summary">
          <SummaryCard label="Expected collections" value={formatMoney(data.expectedCollections)} />
          <SummaryCard label="Upcoming expenses" value={formatMoney(data.upcomingExpenses)} />
          <SummaryCard
            label="Net cash flow"
            value={formatMoney(net)}
            tone={net < 0 ? 'negative' : 'default'}
          />
          <SummaryCard label="Shortage warnings" value={String(data.shortageWarnings.length)} />
        </section>

        {data.shortageWarnings.length > 0 && (
          <section
            aria-label="Shortage warnings"
            className="rounded-2xl border border-red-300 bg-red-50 p-5 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300"
          >
            <h2 className="font-semibold">Projected shortages</h2>
            <ul className="mt-2 space-y-2">
              {data.shortageWarnings.map((w, i) => (
                <li key={`${w.date}-${i}`}>
                  <span className="font-medium">{formatDate(w.date)}:</span> {w.message} (projected balance{' '}
                  {formatMoney(w.projectedBalance)})
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="overflow-x-auto rounded-2xl border border-border bg-card" aria-label="Forecast by day">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-text/60">
              <tr>
                {COLUMNS.map((c) => (
                  <th key={c} scope="col" className="px-4 py-3 font-semibold">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.points.map((p) => (
                <tr key={p.date} className="border-b border-border align-middle last:border-0">
                  <td className="px-4 py-3 text-text">{formatDate(p.date)}</td>
                  <td className="px-4 py-3 font-medium text-text">{formatMoney(p.likely)}</td>
                  <td className="px-4 py-3 text-text">{formatMoney(p.cautious)}</td>
                  <td className="px-4 py-3 text-text">{formatMoney(p.whatIf)}</td>
                  <td className="px-4 py-3 text-text">{formatMoney(p.safetyBuffer)}</td>
                  <td className="px-4 py-3 text-text">{formatMoney(p.zeroLine)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-text">Cash Flow Forecast</h1>
          <p className="mt-1 text-sm text-text/60">
            Projected cash position across likely, cautious and what-if collection scenarios.
          </p>
        </div>
        <div className="w-full sm:w-56">
          <ThemedSelect
            value={horizon}
            onChange={setHorizon}
            options={HORIZON_OPTIONS}
            ariaLabel="Forecast horizon"
          />
        </div>
      </header>

      {body}
    </div>
  );
}
