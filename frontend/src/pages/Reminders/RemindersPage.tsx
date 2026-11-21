import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { generateReminder, listReminders } from '../../services/invoiceService';
import type { ReminderInput } from '../../services/invoiceService';
import { ApiError } from '../../services/api';
import type { Reminder } from '../../types';
import { ThemedSelect } from '../../components/ui/ThemedSelect';

const BASE =
  'inline-flex min-h-[44px] items-center justify-center rounded-xl px-4 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-60';
const SECONDARY_BTN = `${BASE} border border-border bg-bg text-text hover:bg-border/40`;
const NEW_BTN = `${BASE} gap-2 bg-teal-600 text-white hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400`;
const INPUT =
  'min-h-[44px] w-full rounded-xl border border-border bg-card px-3 text-sm text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500';
const LINK =
  'inline-flex min-h-[44px] items-center text-sm font-medium text-teal-600 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:text-teal-400';

const TONE_OPTIONS = [
  { value: 'friendly', label: 'Friendly' },
  { value: 'firm', label: 'Firm' },
  { value: 'final', label: 'Final' },
];

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'ta', label: 'Tamil' },
  { value: 'te', label: 'Telugu' },
  { value: 'bn', label: 'Bengali' },
  { value: 'mr', label: 'Marathi' },
];

const COLUMNS = ['Invoice ID', 'Tone', 'Language', 'Message', 'Links'];

function messageFrom(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
}

function labelFor(options: { value: string; label: string }[], value: string): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

function ReminderLinks({ reminder }: { reminder: Reminder }) {
  if (!reminder.upiLink && !reminder.whatsappLink) {
    return <span className="text-sm text-text/60">None</span>;
  }
  return (
    <div className="flex flex-col">
      {reminder.upiLink && (
        <a href={reminder.upiLink} target="_blank" rel="noopener noreferrer" className={LINK}>
          UPI link
        </a>
      )}
      {reminder.whatsappLink && (
        <a href={reminder.whatsappLink} target="_blank" rel="noopener noreferrer" className={LINK}>
          WhatsApp link
        </a>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading reminders">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-24 animate-pulse rounded-2xl bg-border/40" />
      ))}
    </div>
  );
}

interface GenerateModalProps {
  onClose: () => void;
  onGenerated: () => void;
}

function GenerateReminderModal({ onClose, onGenerated }: GenerateModalProps) {
  const [invoiceId, setInvoiceId] = useState('');
  const [tone, setTone] = useState<string>('friendly');
  const [language, setLanguage] = useState<string>('en');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submitting) onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, submitting]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const id = invoiceId.trim();
    if (!id) {
      setFormError('Enter an invoice ID.');
      return;
    }
    const input: ReminderInput = {
      invoiceId: id,
      tone: tone as ReminderInput['tone'],
      language: language as ReminderInput['language'],
    };
    setSubmitting(true);
    setFormError(null);
    try {
      await generateReminder(input);
      onGenerated();
    } catch (err: unknown) {
      setFormError(messageFrom(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="generate-reminder-title"
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-lg"
      >
        <h2 id="generate-reminder-title" className="text-lg font-semibold text-text">
          Generate reminder
        </h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4" noValidate>
          <div className="space-y-1">
            <label htmlFor="reminder-invoice-id" className="text-sm font-medium text-text">
              Invoice ID
            </label>
            <input
              id="reminder-invoice-id"
              type="text"
              value={invoiceId}
              onChange={(e) => setInvoiceId(e.target.value)}
              className={INPUT}
              autoComplete="off"
              disabled={submitting}
            />
          </div>
          <div className="space-y-1">
            <span className="text-sm font-medium text-text">Tone</span>
            <ThemedSelect value={tone} onChange={setTone} options={TONE_OPTIONS} ariaLabel="Reminder tone" />
          </div>
          <div className="space-y-1">
            <span className="text-sm font-medium text-text">Language</span>
            <ThemedSelect
              value={language}
              onChange={setLanguage}
              options={LANGUAGE_OPTIONS}
              ariaLabel="Reminder language"
            />
          </div>
          {formError && (
            <p role="alert" className="text-sm text-red-700 dark:text-red-300">
              {formError}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} disabled={submitting} className={SECONDARY_BTN}>
              Cancel
            </button>
            <button type="submit" disabled={submitting} className={NEW_BTN}>
              {submitting ? 'Generating…' : 'Generate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listReminders()
      .then((data) => {
        if (!cancelled) setReminders(data);
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

  function handleGenerated() {
    setModalOpen(false);
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
  } else if (reminders.length === 0) {
    body = (
      <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-text/60">
        No reminders yet.
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
              {reminders.map((r) => (
                <tr key={r.id} className="border-b border-border align-middle last:border-0">
                  <td className="px-4 py-3 font-medium text-text">{r.invoiceId}</td>
                  <td className="px-4 py-3 text-text">{labelFor(TONE_OPTIONS, r.tone)}</td>
                  <td className="px-4 py-3 text-text">{labelFor(LANGUAGE_OPTIONS, r.language)}</td>
                  <td className="max-w-md px-4 py-3 text-text">{r.message}</td>
                  <td className="px-4 py-3">
                    <ReminderLinks reminder={r} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 md:hidden">
          {reminders.map((r) => (
            <article key={r.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="font-medium text-text">{r.invoiceId}</div>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <div>
                  <dt className="text-xs text-text/60">Tone</dt>
                  <dd className="text-text">{labelFor(TONE_OPTIONS, r.tone)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text/60">Language</dt>
                  <dd className="text-text">{labelFor(LANGUAGE_OPTIONS, r.language)}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-text/60">Message</dt>
                  <dd className="text-text">{r.message}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-text/60">Links</dt>
                  <dd>
                    <ReminderLinks reminder={r} />
                  </dd>
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
          <h1 className="text-2xl font-semibold text-text">Reminders</h1>
          <p className="mt-1 text-sm text-text/60">
            Payment reminders sent to payers, with UPI and WhatsApp links where available.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className={NEW_BTN}
          aria-label="Generate reminder"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Generate reminder
        </button>
      </header>

      {body}

      {modalOpen && (
        <GenerateReminderModal onClose={() => setModalOpen(false)} onGenerated={handleGenerated} />
      )}
    </div>
  );
}
