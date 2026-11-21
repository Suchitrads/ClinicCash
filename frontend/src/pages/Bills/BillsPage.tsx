import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { ApiError } from '../../services/api';
import { createBill, deleteBill, getBillFundingChain, listBills, updateBill } from '../../services/billService';
import type { BillInput, BillUpdate } from '../../services/billService';
import type { Bill, BillFundingChain } from '../../types';
import { ThemedSelect } from '../../components/ui/ThemedSelect';

const BASE =
  'inline-flex min-h-[44px] items-center justify-center rounded-xl px-4 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-60';
const SECONDARY_BTN = `${BASE} border border-border bg-bg text-text hover:bg-border/40`;
const ICON_BTN =
  'inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-teal-600 transition-colors hover:bg-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-60 dark:text-teal-400';
const NEW_BTN =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 text-sm font-medium text-white transition-colors hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-60 dark:bg-teal-500 dark:hover:bg-teal-400';
const PRIMARY =
  'inline-flex min-h-[44px] items-center justify-center rounded-xl bg-teal-600 px-4 text-sm font-medium text-white transition-colors hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-60 dark:bg-teal-400 dark:text-slate-900 dark:hover:bg-teal-300';
const INPUT =
  'mt-1 min-h-[44px] w-full rounded-xl border border-border bg-card px-3 text-sm text-text placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60';

const COLUMNS = ['Bill', 'Amount', 'Due date', 'Recurrence', 'Funding chain', 'Status', 'Actions'];

const RECURRENCE_OPTIONS: { value: Bill['recurrence']; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'custom', label: 'Custom' },
];

const STATUS_OPTIONS: { value: Bill['status']; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
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

function labelFor<T extends string>(options: { value: T; label: string }[], value: T): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

function messageFrom(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
}

function StatusText({ status }: { status: Bill['status'] }) {
  const tone =
    status === 'paid'
      ? 'text-teal-600 dark:text-teal-400'
      : status === 'overdue'
        ? 'text-red-600 dark:text-red-400'
        : 'text-text/60';
  return <span className={`text-sm font-medium ${tone}`}>{labelFor(STATUS_OPTIONS, status)}</span>;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading bills">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-2xl bg-border/40" />
      ))}
    </div>
  );
}

interface FieldProps {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}

function Field({ id, label, required, error, children }: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-text">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-red-600 dark:text-red-400">
            *
          </span>
        )}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

interface BillFormModalProps {
  mode: 'create' | 'edit';
  bill?: Bill;
  onClose: () => void;
  onSaved: () => void;
}

interface FormErrors {
  name?: string;
  amount?: string;
  dueDate?: string;
}

function BillFormModal({ mode, bill, onClose, onSaved }: BillFormModalProps) {
  const titleId = useId();
  const baseId = useId();
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const isEdit = mode === 'edit';

  const [name, setName] = useState(bill?.name ?? '');
  const [amount, setAmount] = useState(bill ? String(bill.amount) : '');
  const [dueDate, setDueDate] = useState(bill ? bill.dueDate.slice(0, 10) : '');
  const [recurrence, setRecurrence] = useState<Bill['recurrence']>(bill?.recurrence ?? 'none');
  const [deferrable, setDeferrable] = useState(bill?.deferrable ?? false);
  const [status, setStatus] = useState<Bill['status']>(bill?.status ?? 'pending');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, submitting]);

  function validate(): FormErrors {
    const next: FormErrors = {};
    if (!name.trim()) next.name = 'Bill name is required.';
    const amountNum = Number(amount);
    if (amount.trim() === '' || !Number.isFinite(amountNum) || amountNum <= 0) {
      next.amount = 'Enter an amount greater than 0.';
    }
    if (!dueDate) next.dueDate = 'Due date is required.';
    return next;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setSubmitError(null);
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const input: BillInput = {
      name: name.trim(),
      amount: Number(amount),
      dueDate,
      recurrence,
      deferrable,
      status,
    };

    setSubmitting(true);
    try {
      if (isEdit && bill) {
        const update: BillUpdate = input;
        await updateBill(bill.id, update);
      } else {
        await createBill(input);
      }
    } catch (err) {
      setSubmitError(messageFrom(err));
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    onSaved();
  }

  return (
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
        className="max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-xl sm:max-w-lg"
      >
        <h2 id={titleId} className="text-lg font-semibold text-text">
          {isEdit && bill ? `Edit bill ${bill.name}` : 'Add bill'}
        </h2>

        <form noValidate onSubmit={handleSubmit} className="mt-4 space-y-4">
          <Field id={`${baseId}-name`} label="Bill name" required error={errors.name}>
            <input
              ref={firstFieldRef}
              id={`${baseId}-name`}
              type="text"
              required
              aria-required="true"
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? `${baseId}-name-error` : undefined}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
              className={INPUT}
            />
          </Field>

          <Field id={`${baseId}-amount`} label="Amount" required error={errors.amount}>
            <input
              id={`${baseId}-amount`}
              type="number"
              min={1}
              step={0.01}
              inputMode="decimal"
              required
              aria-required="true"
              aria-invalid={errors.amount ? true : undefined}
              aria-describedby={errors.amount ? `${baseId}-amount-error` : undefined}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={submitting}
              className={INPUT}
            />
          </Field>

          <Field id={`${baseId}-due`} label="Due date" required error={errors.dueDate}>
            <input
              id={`${baseId}-due`}
              type="date"
              required
              aria-required="true"
              aria-invalid={errors.dueDate ? true : undefined}
              aria-describedby={errors.dueDate ? `${baseId}-due-error` : undefined}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={submitting}
              className={INPUT}
            />
          </Field>

          <Field id={`${baseId}-recurrence`} label="Recurrence" required>
            <ThemedSelect
              id={`${baseId}-recurrence`}
              ariaLabel="Recurrence"
              value={recurrence}
              onChange={(v) => setRecurrence(v as Bill['recurrence'])}
              options={RECURRENCE_OPTIONS}
              disabled={submitting}
            />
          </Field>

          <Field id={`${baseId}-status`} label="Status" required>
            <ThemedSelect
              id={`${baseId}-status`}
              ariaLabel="Status"
              value={status}
              onChange={(v) => setStatus(v as Bill['status'])}
              options={STATUS_OPTIONS}
              disabled={submitting}
            />
          </Field>

          <label className="flex min-h-[44px] items-center gap-3 text-sm text-text">
            <input
              type="checkbox"
              checked={deferrable}
              onChange={(e) => setDeferrable(e.target.checked)}
              disabled={submitting}
              className="h-5 w-5 rounded border-border accent-teal-600"
            />
            Deferrable
          </label>

          {submitError && (
            <p
              role="alert"
              className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300"
            >
              {submitError}
            </p>
          )}

          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} disabled={submitting} className={SECONDARY_BTN}>
              Cancel
            </button>
            <button type="submit" disabled={submitting} className={PRIMARY}>
              {submitting
                ? isEdit
                  ? 'Updating…'
                  : 'Saving…'
                : isEdit
                  ? 'Update bill'
                  : 'Save bill'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type ModalState = { mode: 'create' } | { mode: 'edit'; bill: Bill };

export default function BillsPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [chains, setChains] = useState<Record<string, BillFundingChain>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([listBills(), getBillFundingChain().catch(() => [])])
      .then(([data, chainList]) => {
        if (!cancelled) {
          setBills(data);
          const map: Record<string, BillFundingChain> = {};
          chainList.forEach((c) => {
            map[c.billId] = c;
          });
          setChains(map);
        }
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

  async function handleDeleteBill(id: string) {
    setDeleting(true);
    try {
      await deleteBill(id);
      setConfirmDeleteId(null);
      reload();
    } catch (err: unknown) {
      setError(messageFrom(err));
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
  } else if (bills.length === 0) {
    body = (
      <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-text/60">
        No bills yet.
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
              {bills.map((bill) => (
                <tr key={bill.id} className="border-b border-border align-middle last:border-0">
                  <td className="px-4 py-3 font-medium text-text">{bill.name}</td>
                  <td className="px-4 py-3 font-medium text-text">{formatMoney(bill.amount)}</td>
                  <td className="px-4 py-3 text-text">{formatDate(bill.dueDate)}</td>
                  <td className="px-4 py-3 text-text">
                    {labelFor(RECURRENCE_OPTIONS, bill.recurrence)}
                  </td>
                  <td className="px-4 py-3">
                    {chains[bill.id] ? (
                      chains[bill.id].status === 'fully_covered' ? (
                        <span
                          className="inline-flex items-center gap-1 text-xs font-semibold text-teal-600 dark:text-teal-400"
                          title={chains[bill.id].narrative}
                        >
                          ✓ Covered (gap ₹0)
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400"
                          title={chains[bill.id].narrative}
                        >
                          ⚠️ Gap: {formatMoney(chains[bill.id].gapAmount)}
                        </span>
                      )
                    ) : (
                      <span className="text-xs text-text/50">
                        {bill.deferrable ? 'Deferrable' : 'Standard'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusText status={bill.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setModal({ mode: 'edit', bill })}
                        className={ICON_BTN}
                        aria-label={`Edit ${bill.name}`}
                        title="Edit"
                      >
                        <Pencil className="h-5 w-5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(bill.id)}
                        disabled={deleting}
                        className={`${ICON_BTN} text-red-600 hover:text-red-700 dark:text-red-400`}
                        aria-label={`Delete ${bill.name}`}
                        title="Delete"
                      >
                        <Trash2 className="h-5 w-5" aria-hidden="true" />
                      </button>
                    </div>
                    {confirmDeleteId === bill.id && (
                      <div className="absolute z-10 mt-1 rounded-xl border border-border bg-card p-3 shadow-lg">
                        <p className="text-xs text-text mb-2">Delete {bill.name}?</p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            disabled={deleting}
                            className="rounded-lg border border-border px-2 py-1 text-xs text-text hover:bg-border/40"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteBill(bill.id)}
                            disabled={deleting}
                            className="rounded-lg bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
                          >
                            {deleting ? 'Deleting…' : 'Delete'}
                          </button>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 md:hidden">
          {bills.map((bill) => (
            <article key={bill.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 font-medium text-text">{bill.name}</div>
                <StatusText status={bill.status} />
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <div>
                  <dt className="text-xs text-text/60">Amount</dt>
                  <dd className="font-medium text-text">{formatMoney(bill.amount)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text/60">Due date</dt>
                  <dd className="text-text">{formatDate(bill.dueDate)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text/60">Recurrence</dt>
                  <dd className="text-text">{labelFor(RECURRENCE_OPTIONS, bill.recurrence)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text/60">Funding chain</dt>
                  <dd className="text-text">
                    {chains[bill.id] ? (
                      chains[bill.id].status === 'fully_covered' ? (
                        <span className="font-semibold text-teal-600 dark:text-teal-400">
                          ✓ Covered
                        </span>
                      ) : (
                        <span className="font-semibold text-amber-600 dark:text-amber-400">
                          ⚠️ Gap: {formatMoney(chains[bill.id].gapAmount)}
                        </span>
                      )
                    ) : (
                      bill.deferrable ? 'Deferrable' : 'Standard'
                    )}
                  </dd>
                </div>
              </dl>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setModal({ mode: 'edit', bill })}
                  className={`${SECONDARY_BTN} gap-2`}
                >
                  <Pencil className="h-4 w-4 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                  Edit
                </button>
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
          <h1 className="text-2xl font-semibold text-text">Bills &amp; Expenses</h1>
          <p className="mt-1 text-sm text-text/60">
            Track upcoming bills, recurring expenses and their payment status.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ mode: 'create' })}
          className={NEW_BTN}
          aria-label="Add bill"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add bill
        </button>
      </header>

      {body}

      {modal?.mode === 'edit' && (
        <BillFormModal
          mode="edit"
          bill={modal.bill}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}

      {modal?.mode === 'create' && (
        <BillFormModal mode="create" onClose={() => setModal(null)} onSaved={handleSaved} />
      )}
    </div>
  );
}
