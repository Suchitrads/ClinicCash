import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { createInvoice, listInvoices, listPayers, updateInvoice } from '../../services';
import { ApiError } from '../../services/api';
import type { InvoiceInput, InvoiceUpdate } from '../../services/invoiceService';
import type { Invoice, Payer } from '../../types';
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

  const [patientName, setPatientName] = useState(
    invoice?.patientName ||
      (invoice?.payer.name && invoice.payer.name !== 'Self Pay' ? invoice.payer.name : '') ||
      '',
  );
  const [payerName, setPayerName] = useState(invoice?.payer.name ?? '');
  const [serviceDetails, setServiceDetails] = useState(invoice?.itemLabel ?? '');
  const [amount, setAmount] = useState(invoice ? String(invoice.amount) : '');
  const [dueDate, setDueDate] = useState(invoice ? invoice.dueDate.slice(0, 10) : '');
  const [claimStage, setClaimStage] = useState(invoice?.claimStage ?? 'Submitted');
  const [paidAmount, setPaidAmount] = useState(invoice ? String(invoice.paidAmount) : '0');
  const [isInstallmentPlan, setIsInstallmentPlan] = useState(false);
  const [planMonths, setPlanMonths] = useState(10);
  const [knownPayers, setKnownPayers] = useState<Payer[]>([]);
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
    listPayers()
      .then((data) => {
        if (data && data.length > 0) {
          setKnownPayers(data);
        } else {
          listInvoices().then((invs) => {
            const byId = new Map<string, Payer>();
            invs.forEach((i) => byId.set(i.payer.id, i.payer));
            setKnownPayers(Array.from(byId.values()));
          }).catch(() => {});
        }
      })
      .catch(() => {
        listInvoices().then((invs) => {
          const byId = new Map<string, Payer>();
          invs.forEach((i) => byId.set(i.payer.id, i.payer));
          setKnownPayers(Array.from(byId.values()));
        }).catch(() => {});
      });
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
    if (!patientName.trim()) {
      if (!payerName.trim() || payerName.trim() === 'Self Pay') {
        next.patientName = 'Patient name is required.';
      }
    }
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

    const trimmedPayer = payerName.trim();
    const resolvedPatient = patientName.trim() || trimmedPayer || 'Patient';
    const matchedPayer = knownPayers.find(
      (p) =>
        p.name.toLowerCase() === trimmedPayer.toLowerCase() ||
        p.id.toLowerCase() === trimmedPayer.toLowerCase(),
    );
    const payerPayload = matchedPayer
      ? { id: matchedPayer.id, name: matchedPayer.name }
      : isEdit && invoice && invoice.payer.name.toLowerCase() === trimmedPayer.toLowerCase()
        ? { id: invoice.payer.id, name: invoice.payer.name }
        : { id: `PAY-${Date.now().toString(36).toUpperCase()}`, name: trimmedPayer };

    const base = {
      patientName: resolvedPatient,
      itemLabel: serviceDetails.trim() || undefined,
      payer: payerPayload,
      amount: Number(amount),
      dueDate,
      claimStage,
      isInstallmentPlan: !isEdit && isInstallmentPlan,
      planMonths: !isEdit && isInstallmentPlan ? planMonths : undefined,
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
            <div className="space-y-1.5">
              <input
                id={`${baseId}-payer`}
                type="text"
                required
                list={`${baseId}-payers-list`}
                aria-required="true"
                aria-invalid={errors.payer ? true : undefined}
                aria-describedby={errors.payer ? `${baseId}-payer-error` : undefined}
                value={payerName}
                onChange={(e) => setPayerName(e.target.value)}
                placeholder="e.g. Star Health TPA, Care Plus, or Patient"
                disabled={submitting}
                className={INPUT}
              />
              <datalist id={`${baseId}-payers-list`}>
                {knownPayers.map((p) => (
                  <option key={p.id} value={p.name} />
                ))}
              </datalist>
              {knownPayers.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-xs text-text/50">Suggestions:</span>
                  {knownPayers.slice(0, 4).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPayerName(p.name)}
                      className="rounded-lg border border-border bg-bg px-2 py-0.5 text-xs text-text hover:bg-border/40 transition-colors"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Field>

          <Field id={`${baseId}-service`} label="Service details">
            <input
              id={`${baseId}-service`}
              type="text"
              placeholder="e.g. Consultation, Root canal, Dental implant"
              value={serviceDetails}
              onChange={(e) => setServiceDetails(e.target.value)}
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

          {!isEdit && (
            <div className="rounded-xl border border-teal-500/30 bg-teal-500/5 p-4">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isInstallmentPlan}
                  onChange={(e) => setIsInstallmentPlan(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-teal-600 focus:ring-teal-500"
                />
                <span className="text-sm font-semibold text-text">
                  Treatment installment plan (e.g. 10 months × ₹6,000)
                </span>
              </label>

              {isInstallmentPlan && (
                <div className="mt-3 space-y-3 pt-2 border-t border-teal-500/20">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <label htmlFor={`${baseId}-months`} className="text-xs font-medium text-text/80">
                      Installment duration:
                    </label>
                    <select
                      id={`${baseId}-months`}
                      value={planMonths}
                      onChange={(e) => setPlanMonths(Number(e.target.value))}
                      className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm text-text"
                    >
                      <option value={3}>3 months</option>
                      <option value={6}>6 months</option>
                      <option value={10}>10 months (Dental standard)</option>
                      <option value={12}>12 months</option>
                      <option value={18}>18 months</option>
                      <option value={24}>24 months</option>
                    </select>
                  </div>

                  <div className="rounded-lg bg-teal-500/10 p-2.5 text-xs text-teal-900 dark:text-teal-200">
                    <p className="font-semibold text-sm">
                      ✨ Plan: {planMonths} months × ₹
                      {(Number(amount) > 0 ? Math.round(Number(amount) / planMonths) : 0).toLocaleString('en-IN')}
                    </p>
                    <p className="mt-1 text-text/70">
                      Creates all {planMonths} future scheduled invoices. The Cash Flow Forecast will automatically project this certain future income.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

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
