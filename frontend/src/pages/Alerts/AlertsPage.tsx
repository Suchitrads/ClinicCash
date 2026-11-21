import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { getAlerts } from '../../services/forecastService';
import { ApiError } from '../../services/api';
import type { Alert } from '../../types';
import { ThemedSelect } from '../../components/ui/ThemedSelect';
import {
  buildMessage,
  buildQrUrl,
  buildWhatsAppUrl,
  normalizeIndianPhone,
} from './whatsappMessage';

const SECONDARY_BTN =
  'inline-flex min-h-[44px] items-center justify-center rounded-xl border border-border bg-bg px-4 text-sm font-medium text-text transition-colors hover:bg-border/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-60';

const ACCENT_BTN =
  'inline-flex min-h-[44px] items-center justify-center rounded-xl bg-accent px-4 text-sm font-medium text-white transition-colors hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-60';

const FIELD =
  'min-h-[44px] w-full rounded-xl border border-border bg-bg px-3 text-sm text-text placeholder:text-text/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent';

type Severity = Alert['severity'];

const SEVERITY_OPTIONS = [
  { value: 'all', label: 'All severities' },
  { value: 'critical', label: 'Critical' },
  { value: 'warning', label: 'Warning' },
  { value: 'info', label: 'Info' },
];

const PILL: Record<Severity, string> = {
  critical: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  info: 'bg-teal-100 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300',
};

function messageFrom(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading alerts">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-24 animate-pulse rounded-2xl bg-border/40" />
      ))}
    </div>
  );
}

interface WhatsAppModalProps {
  alert: Alert;
  onClose: () => void;
}

function WhatsAppModal({ alert, onClose }: WhatsAppModalProps) {
  const [phoneInput, setPhoneInput] = useState('');
  const [payer, setPayer] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [upiLink, setUpiLink] = useState('');
  // null = follow the template; a string = the user has edited the message text.
  const [messageOverride, setMessageOverride] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const phone = normalizeIndianPhone(phoneInput);
  const phoneTouched = phoneInput !== '';
  const upiTrimmed = upiLink.trim();
  const qrUrl = upiTrimmed ? buildQrUrl(upiTrimmed) : '';
  const templateMessage = buildMessage({
    name: payer,
    alertMessage: alert.message,
    amount,
    dueDate,
    upiLink,
  });
  const message = messageOverride ?? templateMessage;

  function openWhatsApp() {
    if (!phone || !message.trim()) return;
    window.open(buildWhatsAppUrl(phone, message), '_blank', 'noopener,noreferrer');
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="whatsapp-dialog-title"
        className="max-h-[90vh] w-full space-y-4 overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-xl sm:max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="whatsapp-dialog-title" className="text-lg font-semibold text-text">
            Send via WhatsApp
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className={SECONDARY_BTN}>
            Close
          </button>
        </div>

        <div>
          <label htmlFor="wa-phone" className="block text-sm font-medium text-text">
            Recipient phone
          </label>
          <div className="mt-1 flex gap-2">
            <span className="inline-flex min-h-[44px] items-center rounded-xl border border-border bg-bg px-3 text-sm text-text/60">
              +91
            </span>
            <input
              id="wa-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="10-digit mobile number"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, ''))}
              aria-invalid={phoneTouched && !phone}
              className={FIELD}
            />
          </div>
          {phoneTouched && !phone ? (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              Enter a 10-digit Indian mobile number.
            </p>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="wa-payer" className="block text-sm font-medium text-text">
              Payer / patient name
            </label>
            <input
              id="wa-payer"
              type="text"
              value={payer}
              onChange={(e) => setPayer(e.target.value)}
              className={`mt-1 ${FIELD}`}
            />
          </div>
          <div>
            <label htmlFor="wa-amount" className="block text-sm font-medium text-text">
              Amount due
            </label>
            <input
              id="wa-amount"
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`mt-1 ${FIELD}`}
            />
          </div>
          <div>
            <label htmlFor="wa-due" className="block text-sm font-medium text-text">
              Due date
            </label>
            <input
              id="wa-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={`mt-1 ${FIELD}`}
            />
          </div>
          <div>
            <label htmlFor="wa-upi" className="block text-sm font-medium text-text">
              UPI payment link
            </label>
            <input
              id="wa-upi"
              type="text"
              placeholder="upi://pay?pa=..."
              value={upiLink}
              onChange={(e) => setUpiLink(e.target.value)}
              className={`mt-1 ${FIELD}`}
            />
          </div>
        </div>

        {qrUrl ? (
          <div className="flex justify-center">
            <img
              src={qrUrl}
              alt="UPI payment QR code"
              width={300}
              height={300}
              className="h-40 w-40 rounded-xl border border-border bg-white p-2"
            />
          </div>
        ) : null}

        <div>
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="wa-message" className="block text-sm font-medium text-text">
              Message
            </label>
            {messageOverride !== null ? (
              <button
                type="button"
                onClick={() => setMessageOverride(null)}
                className="min-h-[44px] rounded-xl px-3 text-xs font-medium text-text/60 underline underline-offset-2 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Reset to template
              </button>
            ) : null}
          </div>
          <textarea
            id="wa-message"
            rows={5}
            value={message}
            onChange={(e) => setMessageOverride(e.target.value)}
            className={`mt-1 py-2 ${FIELD} min-h-[120px] resize-y`}
          />
          <div className="mt-2 text-xs font-medium uppercase tracking-wide text-text/60">Preview</div>
          <div
            aria-label="Message preview"
            className="mt-1 whitespace-pre-wrap break-words rounded-xl border border-border bg-bg p-3 text-sm text-text"
          >
            {message}
          </div>
        </div>

        <p className="text-xs text-text/60">
          This opens WhatsApp with the message ready. Press send in WhatsApp to deliver it. No
          WhatsApp API is connected.
        </p>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={openWhatsApp}
            disabled={!phone || !message.trim()}
            className={ACCENT_BTN}
          >
            Send via WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [severity, setSeverity] = useState<string>('all');
  const [sendFor, setSendFor] = useState<Alert | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getAlerts()
      .then((data) => {
        if (!cancelled) setAlerts(data);
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

  const visible = severity === 'all' ? alerts : alerts.filter((a) => a.severity === severity);

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
  } else if (alerts.length === 0) {
    body = (
      <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-text/60">
        No alerts right now.
      </div>
    );
  } else if (visible.length === 0) {
    body = (
      <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-text/60">
        No alerts match this severity.
      </div>
    );
  } else {
    body = (
      <ul className="space-y-3" aria-label="Alerts">
        {visible.map((a) => (
          <li key={a.id} className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${PILL[a.severity]}`}
              >
                {a.severity}
              </span>
              <time dateTime={a.createdAt} className="text-xs text-text/60">
                {formatDateTime(a.createdAt)}
              </time>
            </div>
            <div className="mt-3 text-xs uppercase tracking-wide text-text/60">{a.type}</div>
            <p className="mt-1 text-sm text-text">{a.message}</p>
            <div className="mt-3 flex justify-end">
              <button type="button" onClick={() => setSendFor(a)} className={ACCENT_BTN}>
                Send via WhatsApp
              </button>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-text">Alerts</h1>
          <p className="mt-1 text-sm text-text/60">
            Cash, collection and payment warnings that need your attention.
          </p>
        </div>
        <div className="w-full sm:w-56">
          <ThemedSelect
            value={severity}
            onChange={setSeverity}
            options={SEVERITY_OPTIONS}
            ariaLabel="Filter by severity"
          />
        </div>
      </header>

      {body}

      {sendFor ? <WhatsAppModal alert={sendFor} onClose={() => setSendFor(null)} /> : null}
    </div>
  );
}
