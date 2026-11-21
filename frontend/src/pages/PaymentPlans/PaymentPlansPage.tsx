import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { createInstallmentPlan, listPaymentPlans } from '../../services';
import type { InstallmentPlanInput } from '../../services';
import { ApiError } from '../../services/api';
import type { PaymentPlan } from '../../types';

const BASE =
  'inline-flex min-h-[44px] items-center justify-center rounded-xl px-4 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-60';
const SECONDARY_BTN = `${BASE} border border-border bg-bg text-text hover:bg-border/40`;
const PRIMARY_BTN = `${BASE} bg-teal-600 text-white hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400`;
const NEW_BTN = `${PRIMARY_BTN} gap-2`;
const INPUT =
  'min-h-[44px] w-full rounded-xl border border-border bg-bg px-3 text-sm text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500';

const COLUMNS = [
  'Plan',
  'Total amount',
  'Paid',
  'Remaining',
  'Installment',
  'Frequency',
  'Next payment',
];

const FREQUENCY_LABEL: Record<PaymentPlan['frequency'], string> = {
  weekly: 'Weekly',
  biweekly: 'Biweekly',
  monthly: 'Monthly',
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

function messageFrom(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading payment plans">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-2xl bg-border/40" />
      ))}
    </div>
  );
}

interface NewPlanModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function NewPlanModal({ onClose, onCreated }: NewPlanModalProps) {
  const [invoiceId, setInvoiceId] = useState('');
  const [installmentAmount, setInstallmentAmount] = useState('');
  const [frequency, setFrequency] = useState<PaymentPlan['frequency']>('monthly');
  const [startDate, setStartDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const id = invoiceId.trim();
    const amount = Number(installmentAmount);
    if (!id) {
      setFormError('Enter an invoice ID.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError('Enter an installment amount greater than zero.');
      return;
    }
    if (!startDate) {
      setFormError('Choose a start date.');
      return;
    }
    const input: InstallmentPlanInput = { installmentAmount: amount, frequency, startDate };
    setSaving(true);
    setFormError(null);
    try {
      await createInstallmentPlan(id, input);
      onCreated();
    } catch (err: unknown) {
      setFormError(messageFrom(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-plan-title"
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="new-plan-title" className="text-lg font-semibold text-text">
          New payment plan
        </h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4" noValidate>
          <div>
            <label htmlFor="plan-invoice-id" className="mb-1 block text-sm text-text">
              Invoice ID
            </label>
            <input
              id="plan-invoice-id"
              type="text"
              value={invoiceId}
              onChange={(e) => setInvoiceId(e.target.value)}
              className={INPUT}
              placeholder="e.g. INV-1001"
              autoComplete="off"
            />
          </div>
          <div>
            <label htmlFor="plan-installment" className="mb-1 block text-sm text-text">
              Installment amount (₹)
            </label>
            <input
              id="plan-installment"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={installmentAmount}
              onChange={(e) => setInstallmentAmount(e.target.value)}
              className={INPUT}
            />
          </div>
          <div>
            <label htmlFor="plan-frequency" className="mb-1 block text-sm text-text">
              Frequency
            </label>
            <select
              id="plan-frequency"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as PaymentPlan['frequency'])}
              className={INPUT}
            >
              {(Object.keys(FREQUENCY_LABEL) as PaymentPlan['frequency'][]).map((f) => (
                <option key={f} value={f}>
                  {FREQUENCY_LABEL[f]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="plan-start-date" className="mb-1 block text-sm text-text">
              Start date
            </label>
            <input
              id="plan-start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={INPUT}
            />
          </div>

          {formError && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {formError}
            </p>
          )}

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} disabled={saving} className={SECONDARY_BTN}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className={PRIMARY_BTN}>
              {saving ? 'Creating…' : 'Create plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PaymentPlansPage() {
  const [plans, setPlans] = useState<PaymentPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listPaymentPlans()
      .then((data) => {
        if (!cancelled) setPlans(data);
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

  function handleCreated() {
    setShowNew(false);
    reload();
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
  } else if (plans.length === 0) {
    body = (
      <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-text/60">
        No payment plans yet.
      </div>
    );
  } else {
    body = (
      <>
        <div className="hidden overflow-x-auto rounded-2xl border border-border bg-card md:block">
          <table className="w-full min-w-[800px] text-left text-sm">
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
              {plans.map((p) => (
                <tr key={p.id} className="border-b border-border align-middle last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium text-text">{p.name}</div>
                    <div className="text-xs text-text/60">{p.id}</div>
                  </td>
                  <td className="px-4 py-3 text-text">{formatMoney(p.totalAmount)}</td>
                  <td className="px-4 py-3 text-text">{formatMoney(p.paidAmount)}</td>
                  <td className="px-4 py-3 font-medium text-text">
                    {formatMoney(p.remainingAmount)}
                  </td>
                  <td className="px-4 py-3 text-text">{formatMoney(p.installmentAmount)}</td>
                  <td className="px-4 py-3 text-text">{FREQUENCY_LABEL[p.frequency]}</td>
                  <td className="px-4 py-3 text-text">{formatDate(p.nextPaymentDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 md:hidden">
          {plans.map((p) => (
            <article key={p.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="min-w-0">
                <div className="font-medium text-text">{p.name}</div>
                <div className="text-xs text-text/60">{p.id}</div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <div>
                  <dt className="text-xs text-text/60">Total amount</dt>
                  <dd className="text-text">{formatMoney(p.totalAmount)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text/60">Paid</dt>
                  <dd className="text-text">{formatMoney(p.paidAmount)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text/60">Remaining</dt>
                  <dd className="font-medium text-text">{formatMoney(p.remainingAmount)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text/60">Installment</dt>
                  <dd className="text-text">{formatMoney(p.installmentAmount)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text/60">Frequency</dt>
                  <dd className="text-text">{FREQUENCY_LABEL[p.frequency]}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-text/60">Next payment</dt>
                  <dd className="text-text">{formatDate(p.nextPaymentDate)}</dd>
                </div>
              </dl>
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
          <h1 className="text-2xl font-semibold text-text">Payment Plans</h1>
          <p className="mt-1 text-sm text-text/60">
            Track instalment plans agreed with patients and payers.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className={NEW_BTN}
          aria-label="New payment plan"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          New plan
        </button>
      </header>

      {body}

      {showNew && (
        <NewPlanModal onClose={() => setShowNew(false)} onCreated={handleCreated} />
      )}
    </div>
  );
}
