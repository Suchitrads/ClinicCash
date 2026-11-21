import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { CalendarClock, Eye, Pencil, Plus } from 'lucide-react';
import { listInvoices } from '../../services';
import { ApiError } from '../../services/api';
import type { Invoice, Payer } from '../../types';
import InvoiceDetailsModal from '../../components/receivables/InvoiceDetailsModal';
import InvoiceFormModal from '../../components/receivables/InvoiceFormModal';
import PromiseToPayModal from '../../components/receivables/PromiseToPayModal';
import ReceivableFilters from '../../components/receivables/ReceivableFilters';
import type { ReceivableFilterState } from '../../components/receivables/ReceivableFilters';
import ReceivableStatusBadge from '../../components/receivables/ReceivableStatusBadge';

const BASE =
  'inline-flex min-h-[44px] items-center justify-center rounded-xl px-4 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-60';
const SECONDARY_BTN = `${BASE} border border-border bg-bg text-text hover:bg-border/40`;
const ICON_BTN =
  'inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg transition-colors hover:bg-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-60';
const NEW_BTN =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 text-sm font-medium text-white transition-colors hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-60 dark:bg-teal-500 dark:hover:bg-teal-400';

const COLUMNS = [
  'Invoice / Patient',
  'Payer',
  'Amount',
  'Due date',
  'Overdue',
  'Status',
  'Next action',
  'Actions',
];

const INITIAL_FILTERS: ReceivableFilterState = {
  search: '',
  payerId: '',
  status: 'all',
  sortBy: 'dueDate',
  sortDir: 'asc',
};

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

function overdueLabel(days: number): string {
  return days > 0 ? `${days} days overdue` : '—';
}

function messageFrom(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
}

type FormState = { mode: 'create' } | { mode: 'edit'; invoice: Invoice };

interface InvoiceActionsProps {
  invoice: Invoice;
  onView: () => void;
  onEdit: () => void;
  onPromise: () => void;
}

function InvoiceActions({ invoice, onView, onEdit, onPromise }: InvoiceActionsProps) {
  const isPaid = invoice.status === 'paid';
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onView}
        className={`${ICON_BTN} text-muted`}
        aria-label="View invoice"
        title="View"
      >
        <Eye className="h-5 w-5" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onEdit}
        className={`${ICON_BTN} text-teal-600 dark:text-teal-400`}
        aria-label="Edit invoice"
        title="Edit"
      >
        <Pencil className="h-5 w-5" aria-hidden="true" />
      </button>
      {!isPaid && (
        <button
          type="button"
          onClick={onPromise}
          className={`${ICON_BTN} text-teal-600 dark:text-teal-400`}
          aria-label="Promise to pay"
          title="Promise to pay"
        >
          <CalendarClock className="h-5 w-5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading invoices">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-2xl bg-border/40" />
      ))}
    </div>
  );
}

export default function ReceivablesPage() {
  const [filters, setFilters] = useState<ReceivableFilterState>(INITIAL_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payers, setPayers] = useState<Payer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [detailsInvoice, setDetailsInvoice] = useState<Invoice | null>(null);
  const [promiseInvoice, setPromiseInvoice] = useState<Invoice | null>(null);
  const [formState, setFormState] = useState<FormState | null>(null);

  // Debounce the search box before it reaches the API.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search.trim()), 300);
    return () => clearTimeout(timer);
  }, [filters.search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listInvoices({
      search: debouncedSearch || undefined,
      payer: filters.payerId || undefined,
      status: filters.status === 'all' ? undefined : filters.status,
      sortBy: filters.sortBy,
      sortDir: filters.sortDir,
    })
      .then((data) => {
        if (!cancelled) setInvoices(data);
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
  }, [debouncedSearch, filters.payerId, filters.status, filters.sortBy, filters.sortDir, reloadKey]);

  // Keep every payer seen so far in the dropdown, even while a payer filter narrows the list.
  useEffect(() => {
    setPayers((prev) => {
      const byId = new Map(prev.map((p) => [p.id, p] as const));
      invoices.forEach((inv) => byId.set(inv.payer.id, inv.payer));
      return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
    });
  }, [invoices]);

  const hasActiveFilters =
    filters.search.trim() !== '' || filters.payerId !== '' || filters.status !== 'all';

  function handleChanged() {
    setDetailsInvoice(null);
    setPromiseInvoice(null);
    setReloadKey((k) => k + 1);
  }

  function handleFormSaved() {
    setFormState(null);
    setReloadKey((k) => k + 1);
  }

  function retry() {
    setReloadKey((k) => k + 1);
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
        <button type="button" onClick={retry} className={SECONDARY_BTN}>
          Retry
        </button>
      </div>
    );
  } else if (invoices.length === 0) {
    body = (
      <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-text/60">
        {hasActiveFilters ? 'No invoices match these filters.' : 'No invoices yet.'}
      </div>
    );
  } else {
    body = (
      <>
        <div className="hidden overflow-x-auto rounded-2xl border border-border bg-card md:block">
          <table className="w-full min-w-[960px] text-left text-sm">
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
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-border align-middle last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium text-text">{inv.id}</div>
                    <div className="text-xs text-text/60">{inv.patientName}</div>
                  </td>
                  <td className="px-4 py-3 text-text">{inv.payer.name}</td>
                  <td className="px-4 py-3">
                    {inv.paidAmount > 0 ? (
                      <div>
                        <div className="font-semibold text-text">
                          {formatMoney(Math.max(0, inv.amount - inv.paidAmount))}
                        </div>
                        <div className="text-xs text-text/60">
                          Total: {formatMoney(inv.amount)} •{' '}
                          <span className="text-teal-600 font-medium dark:text-teal-400">
                            Paid: {formatMoney(inv.paidAmount)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <span className="font-medium text-text">{formatMoney(inv.amount)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-text">{formatDate(inv.dueDate)}</td>
                  <td className="px-4 py-3 text-text">{overdueLabel(inv.overdueDays)}</td>
                  <td className="px-4 py-3">
                    <ReceivableStatusBadge status={inv.status} />
                  </td>
                  <td className="px-4 py-3 text-text">{inv.nextAction}</td>
                  <td className="px-4 py-3">
                    <InvoiceActions
                      invoice={inv}
                      onView={() => setDetailsInvoice(inv)}
                      onEdit={() => setFormState({ mode: 'edit', invoice: inv })}
                      onPromise={() => setPromiseInvoice(inv)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 md:hidden">
          {invoices.map((inv) => (
            <article key={inv.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-text">{inv.id}</div>
                  <div className="text-xs text-text/60">{inv.patientName}</div>
                </div>
                <ReceivableStatusBadge status={inv.status} />
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <div>
                  <dt className="text-xs text-text/60">Payer</dt>
                  <dd className="text-text">{inv.payer.name}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text/60">Amount / Balance</dt>
                  <dd className="font-medium text-text">
                    {inv.paidAmount > 0 ? (
                      <div>
                        <div className="font-semibold text-text">
                          {formatMoney(Math.max(0, inv.amount - inv.paidAmount))}
                        </div>
                        <div className="text-xs text-text/60">
                          Total {formatMoney(inv.amount)} • Paid {formatMoney(inv.paidAmount)}
                        </div>
                      </div>
                    ) : (
                      formatMoney(inv.amount)
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-text/60">Due date</dt>
                  <dd className="text-text">{formatDate(inv.dueDate)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text/60">Overdue</dt>
                  <dd className="text-text">{overdueLabel(inv.overdueDays)}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-text/60">Next action</dt>
                  <dd className="text-text">{inv.nextAction}</dd>
                </div>
              </dl>
              <div className="mt-4">
                <InvoiceActions
                  invoice={inv}
                  onView={() => setDetailsInvoice(inv)}
                  onEdit={() => setFormState({ mode: 'edit', invoice: inv })}
                  onPromise={() => setPromiseInvoice(inv)}
                />
              </div>
            </article>
          ))}
        </div>
      </>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-text">Receivables</h1>
          <p className="mt-1 text-sm text-text/60">
            Track what patients and payers owe, and follow up on each invoice.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormState({ mode: 'create' })}
          className={NEW_BTN}
          aria-label="New invoice"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          New invoice
        </button>
      </header>

      <ReceivableFilters value={filters} payers={payers} onChange={setFilters} />

      {body}

      {detailsInvoice && (
        <InvoiceDetailsModal
          invoice={detailsInvoice}
          onClose={() => setDetailsInvoice(null)}
          onChanged={handleChanged}
        />
      )}

      {promiseInvoice && (
        <PromiseToPayModal
          invoice={promiseInvoice}
          onClose={() => setPromiseInvoice(null)}
          onSaved={handleChanged}
        />
      )}

      {formState && (
        <InvoiceFormModal
          mode={formState.mode}
          invoice={formState.mode === 'edit' ? formState.invoice : undefined}
          onClose={() => setFormState(null)}
          onSaved={handleFormSaved}
        />
      )}
    </div>
  );
}
