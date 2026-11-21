import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { exportReportCsv, getReports } from '../../services/forecastService';
import { ApiError } from '../../services/api';
import type { ReportData, ReportType } from '../../types';
import { ThemedSelect } from '../../components/ui/ThemedSelect';
import type { ThemedSelectOption } from '../../components/ui/ThemedSelect';

const SECONDARY_BTN =
  'inline-flex min-h-[44px] items-center justify-center rounded-xl border border-border bg-bg px-4 text-sm font-medium text-text transition-colors hover:bg-border/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60';
const EXPORT_BTN =
  'inline-flex min-h-[44px] items-center justify-center rounded-xl bg-teal-600 px-4 text-sm font-medium text-white transition-colors hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60 dark:bg-teal-500 dark:hover:bg-teal-400';

const REPORT_OPTIONS: ThemedSelectOption[] = [
  { value: 'collections', label: 'Collections' },
  { value: 'outstanding', label: 'Outstanding' },
  { value: 'delays', label: 'Delays' },
  { value: 'payer-reliability', label: 'Payer reliability' },
  { value: 'monthly-cashflow', label: 'Monthly cashflow' },
];

function isReportType(value: string): value is ReportType {
  return REPORT_OPTIONS.some((o) => o.value === value);
}

const numberFormat = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

function formatCell(value: string | number | undefined): string {
  if (typeof value === 'number') return numberFormat.format(value);
  return value ?? '';
}

function messageFrom(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
}

// A column is numeric only when it has rows and every value in it is a number.
function numericColumnFlags(report: ReportData): boolean[] {
  return report.columns.map(
    (_, i) => report.rows.length > 0 && report.rows.every((row) => typeof row[i] === 'number'),
  );
}

interface NumericStat {
  index: number;
  name: string;
  total: number;
  average: number;
}

function numericStats(report: ReportData, flags: boolean[]): NumericStat[] {
  return report.columns.flatMap((name, index) => {
    if (!flags[index]) return [];
    const total = report.rows.reduce((sum, row) => sum + (row[index] as number), 0);
    return [{ index, name, total, average: total / report.rows.length }];
  });
}

interface AnalyticsStripProps {
  stats: NumericStat[];
}

function AnalyticsStrip({ stats }: AnalyticsStripProps) {
  const maxAbsTotal = Math.max(0, ...stats.map((s) => Math.abs(s.total)));
  return (
    <section
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
      aria-label="Column analytics"
    >
      {stats.map((s) => {
        const pct = maxAbsTotal > 0 ? (Math.abs(s.total) / maxAbsTotal) * 100 : 0;
        return (
          <div key={s.index} className="rounded-2xl border border-border bg-card p-5">
            <div className="text-xs uppercase tracking-wide text-text/60">{s.name}</div>
            <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-xl font-semibold text-text">Total {numberFormat.format(s.total)}</span>
              <span className="text-sm text-text/60">Avg {numberFormat.format(s.average)}</span>
            </div>
            <div
              className="mt-3 h-2 w-full overflow-hidden rounded-full bg-bg"
              role="img"
              aria-label={`${s.name} total relative to largest column total: ${Math.round(pct)}%`}
            >
              <div
                className="h-full rounded-full bg-teal-600 dark:bg-teal-400"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </section>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading report">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-24 animate-pulse rounded-2xl bg-border/40" />
      ))}
    </div>
  );
}

export default function ReportsPage() {
  const [type, setType] = useState<ReportType>('collections');
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setReport(null);
    getReports(type)
      .then((res) => {
        if (!cancelled) setReport(res);
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
  }, [type, reloadKey]);

  function handleTypeChange(value: string) {
    if (!isReportType(value)) return;
    setExportError(null);
    setType(value);
  }

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      const csv = await exportReportCsv(type);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${type}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setExportError(messageFrom(err));
    } finally {
      setExporting(false);
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
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          className={SECONDARY_BTN}
        >
          Retry
        </button>
      </div>
    );
  } else if (!report || report.rows.length === 0) {
    body = (
      <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-text/60">
        No data for this report.
      </div>
    );
  } else {
    const flags = numericColumnFlags(report);
    const stats = numericStats(report, flags);
    body = (
      <div className="space-y-6">
        {stats.length > 0 && <AnalyticsStrip stats={stats} />}

        <section className="overflow-x-auto rounded-2xl border border-border bg-card" aria-label="Report table">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-text/60">
              <tr>
                {report.columns.map((c, i) => (
                  <th
                    key={`${c}-${i}`}
                    scope="col"
                    className={`px-4 py-3 font-semibold ${flags[i] ? 'text-right' : ''}`}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row, r) => (
                <tr key={r} className="border-b border-border align-middle last:border-0">
                  {report.columns.map((_, i) => (
                    <td
                      key={i}
                      className={`px-4 py-3 text-text ${flags[i] ? 'text-right tabular-nums' : ''}`}
                    >
                      {formatCell(row[i])}
                    </td>
                  ))}
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
          <h1 className="text-2xl font-semibold text-text">Reports &amp; Analytics</h1>
          <p className="mt-1 text-sm text-text/60">
            Review collections, outstanding balances, payment delays, payer reliability and monthly cash flow.
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
          <div className="w-full sm:w-56">
            <ThemedSelect
              value={type}
              onChange={handleTypeChange}
              options={REPORT_OPTIONS}
              ariaLabel="Report type"
            />
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={loading || !report || exporting}
            className={EXPORT_BTN}
          >
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </header>

      {exportError && (
        <div
          role="alert"
          className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300"
        >
          {exportError}
        </div>
      )}

      {body}
    </div>
  );
}
