import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { CalendarClock, CheckCircle2, CreditCard, DollarSign } from 'lucide-react';
import { createInstallmentPlan, markInvoicePaid, recordPayment } from '../../services';
import { ApiError } from '../../services/api';
import type { Invoice, PaymentPlan } from '../../types';
import { ThemedSelect } from '../ui/ThemedSelect';
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
const INPUT =
  'mt-1 min-h-[44px] w-full rounded-xl border border-border bg-card px-3 text-sm text-text placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-60';

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

function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);

  const remaining = Math.max(0, invoice.amount - invoice.paidAmount);
  const [payAmount, setPayAmount] = useState(String(remaining || invoice.amount));
  const [payMethod, setPayMethod] = useState('upi');
  const [payDate, setPayDate] = useState(todayIso());
  const [payError, setPayError] = useState<string | null>(null);
  const [paySubmitting, setPaySubmitting] = useState(false);

  const defaultInstallment = Math.max(500, Math.ceil(remaining > 0 ? remaining / 3 : invoice.amount / 3));
  const [planAmount, setPlanAmount] = useState(String(defaultInstallment));
  const [planFreq, setPlanFreq] = useState<PaymentPlan['frequency']>('monthly');
  const [planStart, setPlanStart] = useState(todayIso());
  const [planError, setPlanError] = useState<string | null>(null);
  const [planSubmitting, setPlanSubmitting] = useState(false);

  const isPaid = invoice.status === 'paid';

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  // While a nested modal is open, it owns the Escape key.
  useEffect(() => {
    if (showPromise || showRecordPayment || showPlanModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, showPromise, showRecordPayment, showPlanModal]);

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

  async function handleRecordPayment(e: FormEvent) {
    e.preventDefault();
    const amt = Number(payAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setPayError('Enter an amount greater than 0.');
      return;
    }
    setPaySubmitting(true);
    setPayError(null);
    try {
      await recordPayment(invoice.id, {
        amount: amt,
        method: payMethod,
        paidOn: payDate,
      });
      setShowRecordPayment(false);
      onChanged();
    } catch (err) {
      setPayError(messageFrom(err));
    } finally {
      setPaySubmitting(false);
    }
  }

  async function handleCreatePlan(e: FormEvent) {
    e.preventDefault();
    const amt = Number(planAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setPlanError('Enter an installment amount greater than 0.');
      return;
    }
    if (!planStart) {
      setPlanError('Choose a start date.');
      return;
    }
    setPlanSubmitting(true);
    setPlanError(null);
    try {
      await createInstallmentPlan(invoice.id, {
        installmentAmount: amt,
        frequency: planFreq,
        startDate: planStart,
      });
      setShowPlanModal(false);
      onChanged();
    } catch (err) {
      setPlanError(messageFrom(err));
    } finally {
      setPlanSubmitting(false);
    }
  }

  const rows: [string, string][] = [
    ['Invoice ID', invoice.id],
    ['Patient', invoice.patientName ?? '—'],
    ['Payer', invoice.payer.name],
    ...(invoice.itemLabel ? [['Service details', invoice.itemLabel] as [string, string]] : []),
    ['Amount', formatMoney(invoice.amount)],
    ['Paid amount', formatMoney(invoice.paidAmount)],
    ['Remaining', formatMoney(remaining)],
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
              <div className="flex flex-wrap gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowRecordPayment(true)}
                  className={PRIMARY}
                >
                  <DollarSign className="mr-1.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  Record payment
                </button>
                <button
                  type="button"
                  onClick={() => setShowPlanModal(true)}
                  className={SECONDARY}
                >
                  <CreditCard className="mr-1.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  Payment plan
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  className={SECONDARY}
                >
                  <CheckCircle2 className="mr-1.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  Mark paid
                </button>
                <button
                  type="button"
                  onClick={() => setShowPromise(true)}
                  className={SECONDARY}
                >
                  <CalendarClock className="mr-1.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  Promise to pay
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

      {showRecordPayment && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !paySubmitting) setShowRecordPayment(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full rounded-t-2xl border border-border bg-card p-5 shadow-xl sm:max-w-md sm:rounded-2xl"
          >
            <h3 className="text-lg font-semibold text-text">Record payment</h3>
            <p className="mt-1 text-sm text-text/60">Invoice {invoice.id} • Balance {formatMoney(remaining)}</p>
            <form onSubmit={handleRecordPayment} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text">Amount (₹)</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className={INPUT}
                  disabled={paySubmitting}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text">Payment method</label>
                <ThemedSelect
                  value={payMethod}
                  onChange={setPayMethod}
                  options={[
                    { value: 'upi', label: 'UPI' },
                    { value: 'cash', label: 'Cash' },
                    { value: 'card', label: 'Credit / Debit Card' },
                    { value: 'bank_transfer', label: 'Bank Transfer' },
                    { value: 'insurance', label: 'Insurance' },
                  ]}
                  ariaLabel="Payment method"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text">Paid date</label>
                <input
                  type="date"
                  required
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className={INPUT}
                  disabled={paySubmitting}
                />
              </div>
              {payError && (
                <p className="text-xs text-red-600 dark:text-red-400">{payError}</p>
              )}
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowRecordPayment(false)}
                  disabled={paySubmitting}
                  className={SECONDARY}
                >
                  Cancel
                </button>
                <button type="submit" disabled={paySubmitting} className={PRIMARY}>
                  {paySubmitting ? 'Recording…' : 'Record payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPlanModal && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !planSubmitting) setShowPlanModal(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full rounded-t-2xl border border-border bg-card p-5 shadow-xl sm:max-w-md sm:rounded-2xl"
          >
            <h3 className="text-lg font-semibold text-text">Create payment plan</h3>
            <p className="mt-1 text-sm text-text/60">Invoice {invoice.id} • Balance {formatMoney(remaining)}</p>
            <form onSubmit={handleCreatePlan} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text">Installment amount (₹)</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  value={planAmount}
                  onChange={(e) => setPlanAmount(e.target.value)}
                  className={INPUT}
                  disabled={planSubmitting}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text">Frequency</label>
                <ThemedSelect
                  value={planFreq}
                  onChange={(v) => setPlanFreq(v as PaymentPlan['frequency'])}
                  options={[
                    { value: 'monthly', label: 'Monthly' },
                    { value: 'weekly', label: 'Weekly' },
                    { value: 'biweekly', label: 'Biweekly' },
                  ]}
                  ariaLabel="Installment frequency"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text">Start date</label>
                <input
                  type="date"
                  required
                  value={planStart}
                  onChange={(e) => setPlanStart(e.target.value)}
                  className={INPUT}
                  disabled={planSubmitting}
                />
              </div>
              {planError && (
                <p className="text-xs text-red-600 dark:text-red-400">{planError}</p>
              )}
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowPlanModal(false)}
                  disabled={planSubmitting}
                  className={SECONDARY}
                >
                  Cancel
                </button>
                <button type="submit" disabled={planSubmitting} className={PRIMARY}>
                  {planSubmitting ? 'Creating…' : 'Create plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
