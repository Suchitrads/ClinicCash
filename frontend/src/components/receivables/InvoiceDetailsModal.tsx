import { useEffect, useId, useRef, useState } from 'react';
import { CalendarClock, CheckCircle2 } from 'lucide-react';
import { markInvoicePaid } from '../../services';
import { ApiError } from '../../services/api';
import type { Invoice } from '../../types';
import PromiseToPayModal from './PromiseToPayModal';
import ReceivableStatusBadge from './ReceivableStatusBadge';

interface InvoiceDetailsModalProps {
  invoice: Invoice;
  onClose: () => void;
  onChanged: () => void;
}

const PRIMARY =
  'inline-flex min-h-[44px] items-center justify-center rounded-xl bg-teal-600 px-4 text-sm font-medium text-white transition-colors hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-60 dark:bg-teal-500 dark:hover:bg-teal-400';
const SECONDARY =
  'inline-flex min-h-[44px] items-center justify-center rounded-xl border border-border bg-bg px-4 text-sm font-medium text-text transition-colors hover:bg-border/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-60';

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

export default function InvoiceDetailsModal({
  invoice,
  onClose,
  onChanged,
}: InvoiceDetailsModalProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPromise, setShowPromise] = useState(false);
  const isPaid = invoice.status === 'paid';

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  // While the nested promise modal is open, it owns the Escape key.
  useEffect(() => {
    if (showPromise) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, showPromise]);

  async function handleMarkPaid() {
    setSubmitting(true);
    setError(null);
    try {
      await markInvoicePaid(invoice.id);
      onChanged();
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setSubmitting(false);
    }
  }

  const rows: [string, string][] = [
    ['Invoice ID', invoice.id],
    ['Patient', invoice.patientName],
    ['Payer', invoice.payer.name],
    ['Amount', formatMoney(invoice.amount)],
    ['Paid amount', formatMoney(invoice.paidAmount)],
    ['Due date', formatDate(invoice.dueDate)],
    ['Overdue', invoice.overdueDays > 0 ? `${invoice.overdueDays} days overdue` : '—'],
    ['Claim stage', invoice.claimStage],
    ['Promise date', invoice.promiseDate ? formatDate(invoice.promiseDate) : '—'],
    ['Next action', invoice.nextAction],
  ];

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget && !submitting) onClose();
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl border border-border bg-card p-5 shadow-xl sm:max-w-lg sm:rounded-2xl"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id={titleId} className="text-lg font-semibold text-text">
                Invoice {invoice.id}
              </h2>
              <div className="mt-2">
                <ReceivableStatusBadge status={invoice.status} />
              </div>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-xl text-text/70 transition-colors hover:bg-border/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              ×
            </button>
          </div>

          <dl className="mt-5 grid grid-cols-1 gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
            {rows.map(([label, value]) => (
              <div key={label} className={label === 'Next action' ? 'sm:col-span-2' : undefined}>
                <dt className="text-xs text-text/60">{label}</dt>
                <dd className="font-medium text-text">{value}</dd>
              </div>
            ))}
          </dl>

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300"
            >
              {error}
            </p>
          )}

          <div className="mt-6">
            {isPaid && <p className="text-sm text-text/60">This invoice is already fully paid.</p>}

            {!isPaid && !confirming && (
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setConfirming(true)} className={PRIMARY}>
                  <CheckCircle2 className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />
                  Mark as paid
                </button>
                <button type="button" onClick={() => setShowPromise(true)} className={SECONDARY}>
                  <CalendarClock className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />
                  Set promise to pay
                </button>
              </div>
            )}

            {!isPaid && confirming && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-text">
                  Confirm: mark this invoice as fully paid?
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    disabled={submitting}
                    className={SECONDARY}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleMarkPaid}
                    disabled={submitting}
                    className={PRIMARY}
                  >
                    {submitting ? 'Marking paid…' : 'Confirm'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showPromise && (
        <PromiseToPayModal
          invoice={invoice}
          onClose={() => setShowPromise(false)}
          onSaved={onChanged}
        />
      )}
    </>
  );
}
