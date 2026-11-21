import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { setPromiseToPay } from '../../services';
import { ApiError } from '../../services/api';
import type { Invoice } from '../../types';

interface PromiseToPayModalProps {
  invoice: Invoice;
  onClose: () => void;
  onSaved: () => void;
}

const PRIMARY =
  'inline-flex min-h-[44px] items-center justify-center rounded-xl bg-teal-600 px-4 text-sm font-medium text-white transition-colors hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-60 dark:bg-teal-500 dark:hover:bg-teal-400';
const SECONDARY =
  'inline-flex min-h-[44px] items-center justify-center rounded-xl border border-border bg-bg px-4 text-sm font-medium text-text transition-colors hover:bg-border/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-60';

function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function messageFrom(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
}

export default function PromiseToPayModal({ invoice, onClose, onSaved }: PromiseToPayModalProps) {
  const titleId = useId();
  const inputId = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [date, setDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const today = todayIso();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, submitting]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!date) {
      setError('Choose a promise date.');
      return;
    }
    if (date < today) {
      setError('Promise date cannot be in the past.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await setPromiseToPay(invoice.id, date);
      onSaved();
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full rounded-t-2xl border border-border bg-card p-5 shadow-xl sm:max-w-md sm:rounded-2xl"
      >
        <h2 id={titleId} className="text-lg font-semibold text-text">
          Promise to pay
        </h2>
        <p className="mt-1 text-sm text-text/60">Invoice {invoice.id}</p>

        <form noValidate onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-text">
              Promise date
            </label>
            <input
              ref={inputRef}
              id={inputId}
              type="date"
              required
              min={today}
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setError(null);
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              className="min-h-[44px] w-full rounded-xl border border-border bg-card px-3 text-sm text-text placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            />
            {error && (
              <p id={errorId} role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} disabled={submitting} className={SECONDARY}>
              Cancel
            </button>
            <button type="submit" disabled={submitting} className={PRIMARY}>
              {submitting ? 'Saving…' : 'Save promise'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
