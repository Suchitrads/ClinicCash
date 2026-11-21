import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { getSettings, updateSettings } from '../../services/forecastService';
import { ApiError } from '../../services/api';
import type { Settings } from '../../types';

const SECONDARY_BTN =
  'inline-flex min-h-[44px] items-center justify-center rounded-xl border border-border bg-bg px-4 text-sm font-medium text-text transition-colors hover:bg-border/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60';

const SAVE_BTN =
  'inline-flex min-h-[44px] items-center justify-center rounded-xl bg-teal-600 px-4 text-sm font-medium text-white transition-colors hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60 dark:bg-teal-500 dark:hover:bg-teal-400';

const INPUT =
  'min-h-[44px] w-full rounded-xl border border-border bg-bg px-3 text-sm text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60';

type NumberKey = 'openingCash' | 'weeklyWalkInCollections' | 'safetyBuffer' | 'dueSoonDays' | 'reminderThresholdDays';

interface NumberField {
  key: NumberKey;
  label: string;
  kind: 'money' | 'days';
}

const CASH_FIELDS: NumberField[] = [
  { key: 'openingCash', label: 'Opening cash (₹)', kind: 'money' },
  { key: 'weeklyWalkInCollections', label: 'Weekly walk-in collections (₹)', kind: 'money' },
  { key: 'safetyBuffer', label: 'Safety buffer (₹)', kind: 'money' },
];

const REMINDER_FIELDS: NumberField[] = [
  { key: 'dueSoonDays', label: 'Due soon window (days)', kind: 'days' },
  { key: 'reminderThresholdDays', label: 'Reminder threshold (days)', kind: 'days' },
];

// Form values are kept as strings so partially typed numbers are editable.
interface FormState {
  openingCash: string;
  weeklyWalkInCollections: string;
  safetyBuffer: string;
  dueSoonDays: string;
  reminderThresholdDays: string;
  timezone: string;
}

function toForm(s: Settings): FormState {
  return {
    openingCash: String(s.openingCash),
    weeklyWalkInCollections: String(s.weeklyWalkInCollections),
    safetyBuffer: String(s.safetyBuffer),
    dueSoonDays: String(s.dueSoonDays),
    reminderThresholdDays: String(s.reminderThresholdDays),
    timezone: s.timezone,
  };
}

function messageFrom(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading settings">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-40 animate-pulse rounded-2xl bg-border/40" />
      ))}
    </div>
  );
}

export default function SettingsPage() {
  const [loaded, setLoaded] = useState<Settings | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getSettings()
      .then((s) => {
        if (!cancelled) {
          setLoaded(s);
          setForm(toForm(s));
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

  function setField(key: keyof FormState, value: string) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaveSuccess(null);
    setSaveError(null);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!loaded || !form) return;

    // Build a patch containing only the values that differ from the loaded settings.
    const patch: Partial<Settings> = {};
    for (const field of [...CASH_FIELDS, ...REMINDER_FIELDS]) {
      const raw = form[field.key].trim();
      const n = Number(raw);
      if (raw === '' || !Number.isFinite(n) || n < 0) {
        setSaveError(`${field.label.replace(/ \(.*\)$/, '')} must be a number of 0 or more.`);
        setSaveSuccess(null);
        return;
      }
      if (n !== loaded[field.key]) patch[field.key] = n;
    }

    const tz = form.timezone.trim();
    if (tz === '') {
      setSaveError('Timezone is required.');
      setSaveSuccess(null);
      return;
    }
    if (tz !== loaded.timezone) patch.timezone = tz;

    if (Object.keys(patch).length === 0) {
      setSaveError(null);
      setSaveSuccess('No changes to save.');
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);
    try {
      const updated = await updateSettings(patch);
      setLoaded(updated);
      setForm(toForm(updated));
      setSaveSuccess('Settings saved.');
    } catch (err: unknown) {
      setSaveError(messageFrom(err));
    } finally {
      setSaving(false);
    }
  }

  function renderNumberField(field: NumberField): ReactNode {
    const id = `settings-${field.key}`;
    return (
      <div key={field.key}>
        <label htmlFor={id} className="mb-1 block text-sm font-medium text-text">
          {field.label}
        </label>
        <input
          id={id}
          type="number"
          min={0}
          step={field.kind === 'money' ? 'any' : 1}
          inputMode={field.kind === 'money' ? 'decimal' : 'numeric'}
          value={form ? form[field.key] : ''}
          onChange={(e) => setField(field.key, e.target.value)}
          disabled={saving}
          className={INPUT}
        />
      </div>
    );
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
        <button type="button" onClick={() => setReloadKey((k) => k + 1)} className={SECONDARY_BTN}>
          Retry
        </button>
      </div>
    );
  } else if (!form) {
    body = (
      <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-text/60">
        No settings available.
      </div>
    );
  } else {
    body = (
      <form onSubmit={handleSubmit} className="space-y-6" aria-label="Settings form">
        <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="settings-cash">
          <h2 id="settings-cash" className="text-base font-semibold text-text">
            Cash
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {CASH_FIELDS.map(renderNumberField)}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="settings-reminders">
          <h2 id="settings-reminders" className="text-base font-semibold text-text">
            Reminders &amp; due dates
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {REMINDER_FIELDS.map(renderNumberField)}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="settings-locale">
          <h2 id="settings-locale" className="text-base font-semibold text-text">
            Locale
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="settings-timezone" className="mb-1 block text-sm font-medium text-text">
                Timezone
              </label>
              <input
                id="settings-timezone"
                type="text"
                value={form.timezone}
                onChange={(e) => setField('timezone', e.target.value)}
                disabled={saving}
                placeholder="e.g. Asia/Kolkata"
                className={INPUT}
              />
            </div>
          </div>
        </section>

        {saveError && (
          <div
            role="alert"
            className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300"
          >
            {saveError}
          </div>
        )}
        {saveSuccess && (
          <div role="status" className="rounded-2xl border border-border bg-card p-4 text-sm text-text">
            {saveSuccess}
          </div>
        )}

        <div className="flex justify-end">
          <button type="submit" disabled={saving} className={SAVE_BTN}>
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-text">Settings</h1>
        <p className="mt-1 text-sm text-text/60">
          Opening cash, collection assumptions, reminder timing and locale used across ClinicCash.
        </p>
      </header>

      {body}
    </div>
  );
}
