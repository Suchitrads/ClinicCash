import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import { deleteInvoice, listInvoices } from '../../services';
import { ApiError } from '../../services/api';
import type { Invoice } from '../../types';
import InvoiceDetailsModal from '../../components/receivables/InvoiceDetailsModal';
import InvoiceFormModal from '../../components/receivables/InvoiceFormModal';
import ReceivableStatusBadge from '../../components/receivables/ReceivableStatusBadge';

const BASE =
  'inline-flex min-h-[44px] items-center justify-center rounded-xl px-4 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-60';
const SECONDARY_BTN = `${BASE} border border-border bg-bg text-text hover:bg-border/40`;
const ICON_BTN =
  'inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg transition-colors hover:bg-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-60';
const NEW_BTN =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 text-sm font-medium text-white transition-colors hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-60 dark:bg-teal-500 dark:hover:bg-teal-400';

const COLUMNS = [
  'Invoice ID',
  'Payer / Patient',
  'Service details',
  'Amount',
  'Due date',
  'Claim stage',
  'Status',
  'Actions',
];

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

type ModalState =
  | { mode: 'create' }
  | { mode: 'edit'; invoice: Invoice }
  | { mode: 'view'; invoice: Invoice };

interface InvoiceActionsProps {
  invoiceId: string;
  onView: () => void;
  onEdit: () => void;
  confirming: boolean;
  deleting: boolean;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}

function InvoiceActions({
  invoiceId,
  onView,
  onEdit,
  confirming,
  deleting,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
}: InvoiceActionsProps) {
  return (
    <div className="flex flex-col gap-2">
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
        <button
          type="button"
          onClick={onAskDelete}
          disabled={deleting}
          className={`${ICON_BTN} text-red-600 dark:text-red-400`}
          aria-label="Delete invoice"
          title="Delete"
        >
          <Trash2 className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      {confirming && (
        <div
          role="group"
          aria-label="Confirm delete"
          className="rounded-2xl border border-border bg-card p-3 text-sm text-text"
        >
          <p>Delete invoice {invoiceId}? This cannot be undone.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onCancelDelete}
              disabled={deleting}
              className={`${BASE} border border-border bg-bg text-text hover:bg-border/40`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirmDelete}
              disabled={deleting}
              className={`${BASE} bg-red-600 text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-400`}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AmountCell({ invoice }: { invoice: Invoice }) {
  return (
    <>
      <div className="font-medium text-text">{formatMoney(invoice.amount)}</div>
      {invoice.paidAmount > 0 && (
        <div className="text-xs text-text/60">Paid {formatMoney(invoice.paidAmount)}</div>
      )}
    </>
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

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listInvoices()
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
  }, [reloadKey]);

  function reload() {
    setReloadKey((k) => k + 1);
  }

  function handleSaved() {
    setModal(null);
    reload();
  }

  function handleChanged() {
    setModal(null);
    reload();
  }

  function askDelete(id: string) {
    setDeleteError(null);
    setConfirmDeleteId(id);
  }

  async function handleConfirmDelete(id: string) {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteInvoice(id);
      setConfirmDeleteId(null);
      reload();
    } catch (err: unknown) {
      setDeleteError(messageFrom(err));
    } finally {
      setDeleting(false);
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
        <button type="button" onClick={reload} className={SECONDARY_BTN}>
          Retry
        </button>
      </div>
    );
  } else if (invoices.length === 0) {
    body = (
      <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-text/60">
        No invoices yet.
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
                  <td className="px-4 py-3 font-medium text-text">{inv.id}</td>
                  <td className="px-4 py-3">
                    <div className="text-text">{inv.payer.name}</div>
                    <div className="text-xs text-text/60">{inv.patientName}</div>
                  </td>
                  <td className="px-4 py-3 text-text">{inv.nextAction}</td>
                  <td className="px-4 py-3">
                    <AmountCell invoice={inv} />
                  </td>
                  <td className="px-4 py-3 text-text">{formatDate(inv.dueDate)}</td>
                  <td className="px-4 py-3 text-text">{inv.claimStage}</td>
                  <td className="px-4 py-3">
                    <ReceivableStatusBadge status={inv.status} />
                  </td>
                  <td className="px-4 py-3">
                    <InvoiceActions
                      invoiceId={inv.id}
                      onView={() => setModal({ mode: 'view', invoice: inv })}
                      onEdit={() => setModal({ mode: 'edit', invoice: inv })}
                      confirming={confirmDeleteId === inv.id}
                      deleting={deleting}
                      onAskDelete={() => askDelete(inv.id)}
                      onCancelDelete={() => setConfirmDeleteId(null)}
                      onConfirmDelete={() => handleConfirmDelete(inv.id)}
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
                  <div className="text-sm text-text">{inv.payer.name}</div>
                  <div className="text-xs text-text/60">{inv.patientName}</div>
                </div>
                <ReceivableStatusBadge status={inv.status} />
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <div className="col-span-2">
                  <dt className="text-xs text-text/60">Service details</dt>
                  <dd className="text-text">{inv.nextAction}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text/60">Amount</dt>
                  <dd>
                    <AmountCell invoice={inv} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-text/60">Due date</dt>
                  <dd className="text-text">{formatDate(inv.dueDate)}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-text/60">Claim stage</dt>
                  <dd className="text-text">{inv.claimStage}</dd>
                </div>
              </dl>
              <div className="mt-4">
                <InvoiceActions
                  invoiceId={inv.id}
                  onView={() => setModal({ mode: 'view', invoice: inv })}
                  onEdit={() => setModal({ mode: 'edit', invoice: inv })}
                  confirming={confirmDeleteId === inv.id}
                  deleting={deleting}
                  onAskDelete={() => askDelete(inv.id)}
                  onCancelDelete={() => setConfirmDeleteId(null)}
                  onConfirmDelete={() => handleConfirmDelete(inv.id)}
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
          <h1 className="text-2xl font-semibold text-text">Invoices</h1>
          <p className="mt-1 text-sm text-text/60">
            Create and review invoices for patients and payers.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ mode: 'create' })}
          className={NEW_BTN}
          aria-label="Create invoice"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create invoice
        </button>
      </header>

      {deleteError && (
        <div
          role="alert"
          className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300"
        >
          {deleteError}
        </div>
      )}

      {body}

      {modal?.mode === 'view' && (
        <InvoiceDetailsModal
          invoice={modal.invoice}
          onClose={() => setModal(null)}
          onChanged={handleChanged}
        />
      )}

      {modal?.mode === 'edit' && (
        <InvoiceFormModal
          mode="edit"
          invoice={modal.invoice}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}

      {modal?.mode === 'create' && (
        <InvoiceFormModal
          mode="create"
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
