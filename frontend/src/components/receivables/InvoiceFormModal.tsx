import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { createInvoice, updateInvoice } from '../../services';
import { ApiError } from '../../services/api';
import type { InvoiceInput, InvoiceUpdate } from '../../services/invoiceService';
import type { Invoice } from '../../types';
import { ThemedSelect } from '../ui/ThemedSelect';

interface InvoiceFormModalProps {
  mode: 'create' | 'edit';
  invoice?: Invoice;
  onClose: () => void;
  onSaved: () => void;
}

interface FormErrors {
  patientName?: string;
  payer?: string;
  amount?: string;
  dueDate?: string;
  paidAmount?: string;
}

const CLAIM_STAGES = ['Submitted', 'Under review', 'Approved', 'Rejected', 'Paid'];

const PRIMARY =
  'inline-flex min-h-[44px] items-center justify-center rounded-xl bg-teal-600 px-4 text-sm font-medium text-white transition-colors hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60 dark:bg-teal-400 dark:text-slate-900 dark:hover:bg-teal-300';
const SECONDARY =
  'inline-flex min-h-[44px] items-center justify-center rounded-xl border border-border bg-bg px-4 text-sm font-medium text-text transition-colors hover:bg-border/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60';
const INPUT =
  'mt-1 min-h-[44px] w-full rounded-xl border border-border bg-card px-3 text-sm text-text placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60';

function messageFrom(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
}

interface FieldProps {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}

function Field({ id, label, required, error, children }: FieldProps) {
  const errorId = `${id}-error`;
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
        <p id={errorId} className="mt-1 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

export default function InvoiceFormModal({
  mode,
  invoice,
  onClose,
  onSaved,
}: InvoiceFormModalProps) {
  const titleId = useId();
  const baseId = useId();
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const isEdit = mode === 'edit';

  const [patientName, setPatientName] = useState(invoice?.patientName ?? '');
  const [payerName, setPayerName] = useState(invoice?.payer.name ?? '');
  const [amount, setAmount] = useState(invoice ? String(invoice.amount) : '');
  const [dueDate, setDueDate] = useState(invoice ? invoice.dueDate.slice(0, 10) : '');
  const [claimStage, setClaimStage] = useState(invoice?.claimStage ?? 'Submitted');
  const [paidAmount, setPaidAmount] = useState(invoice ? String(invoice.paidAmount) : '0');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Keep the invoice's current stage selectable even if it is not in the standard list.
  const stageOptions =
    isEdit && invoice && !CLAIM_STAGES.includes(invoice.claimStage)
      ? [invoice.claimStage, ...CLAIM_STAGES]
      : CLAIM_STAGES;

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
    if (!patientName.trim()) next.patientName = 'Patient name is required.';
    if (!payerName.trim()) next.payer = 'Payer is required.';
    const amountNum = Number(amount);
    if (amount.trim() === '' || !Number.isFinite(amountNum) || amountNum <= 0) {
      next.amount = 'Enter an amount greater than 0.';
    }
    if (!dueDate) next.dueDate = 'Due date is required.';
    if (isEdit && paidAmount.trim() !== '') {
      const paidNum = Number(paidAmount);
      if (!Number.isFinite(paidNum) || paidNum < 0) {
        next.paidAmount = 'Paid amount cannot be negative.';
      }
    }
    return next;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setSubmitError(null);
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const base = {
      patientName: patientName.trim(),
      payer: { name: payerName.trim() },
      amount: Number(amount),
      dueDate,
      claimStage,
    };

    setSubmitting(true);
    try {
      if (isEdit && invoice) {
        const update = {
          ...base,
          paidAmount: paidAmount.trim() === '' ? 0 : Number(paidAmount),
        } as InvoiceUpdate;
        await updateInvoice(invoice.id, update);
      } else {
        await createInvoice(base as InvoiceInput);
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
          {isEdit && invoice ? `Edit invoice ${invoice.id}` : 'New invoice'}
        </h2>

        <form noValidate onSubmit={handleSubmit} className="mt-4 space-y-4">
          <Field
            id={`${baseId}-patient`}
            label="Patient name"
            required
            error={errors.patientName}
          >
            <input
              ref={firstFieldRef}
              id={`${baseId}-patient`}
              type="text"
              required
              aria-required="true"
              aria-invalid={errors.patientName ? true : undefined}
              aria-describedby={errors.patientName ? `${baseId}-patient-error` : undefined}
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              disabled={submitting}
              className={INPUT}
            />
          </Field>

          <Field id={`${baseId}-payer`} label="Payer" required error={errors.payer}>
            <input
              id={`${baseId}-payer`}
              type="text"
              required
              aria-required="true"
              aria-invalid={errors.payer ? true : undefined}
              aria-describedby={errors.payer ? `${baseId}-payer-error` : undefined}
              value={payerName}
              onChange={(e) => setPayerName(e.target.value)}
              disabled={submitting}
              className={INPUT}
            />
          </Field>

          <Field id={`${baseId}-amount`} label="Invoice amount" required error={errors.amount}>
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

          <Field id={`${baseId}-stage`} label="Claim stage" required>
            <ThemedSelect
              id={`${baseId}-stage`}
              ariaLabel="Claim stage"
              value={claimStage}
              onChange={setClaimStage}
              options={stageOptions.map((stage) => ({ value: stage, label: stage }))}
              disabled={submitting}
            />
          </Field>

          {isEdit && (
            <Field id={`${baseId}-paid`} label="Paid amount" error={errors.paidAmount}>
              <input
                id={`${baseId}-paid`}
                type="number"
                min={0}
                step={0.01}
                inputMode="decimal"
                aria-invalid={errors.paidAmount ? true : undefined}
                aria-describedby={errors.paidAmount ? `${baseId}-paid-error` : undefined}
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                disabled={submitting}
                className={INPUT}
              />
            </Field>
          )}

          {submitError && (
            <p
              role="alert"
              className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300"
            >
              {submitError}
            </p>
          )}

          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} disabled={submitting} className={SECONDARY}>
              Cancel
            </button>
            <button type="submit" disabled={submitting} className={PRIMARY}>
              {submitting
                ? isEdit
                  ? 'Updating…'
                  : 'Saving…'
                : isEdit
                  ? 'Update invoice'
                  : 'Save invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
