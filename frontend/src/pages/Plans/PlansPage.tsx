import { useState } from 'react';
import type { FormEvent, InputHTMLAttributes, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { TRIAL_DAYS, type Plan } from '../../lib/plan';

const FREE_PRICE = '₹0 / month';
const PRO_MONTHLY_PRICE = '₹150 / month';
const PRO_YEARLY_PRICE = '₹16,000 / year';

const PRIMARY_BTN =
  'inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-teal-600 px-4 text-sm font-medium text-white transition-colors hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-60 dark:bg-teal-500 dark:hover:bg-teal-400';

const SECONDARY_BTN =
  'inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-border bg-bg px-4 text-sm font-medium text-text transition-colors hover:bg-border/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-60';

const TOGGLE_BASE =
  'inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl border px-4 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-60';
const TOGGLE_ON = 'border-teal-600 bg-teal-600 text-white dark:border-teal-500 dark:bg-teal-500';
const TOGGLE_OFF = 'border-border bg-card text-text hover:bg-border/40';

const INPUT =
  'min-h-[44px] w-full rounded-xl border border-border bg-card px-3 text-sm text-text placeholder:text-text/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-60';

const PANEL = 'rounded-2xl border border-border bg-card p-6';

type PaymentMethod = 'card' | 'upi' | 'netbanking';

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'card', label: 'Card' },
  { value: 'upi', label: 'UPI' },
  { value: 'netbanking', label: 'Net banking' },
];

// Client-side checks only. Nothing is sent anywhere and nothing is stored
// beyond this component's form state.
interface CardForm {
  name: string;
  number: string;
  expiry: string;
  cvv: string;
}

type FieldErrors = Record<string, string>;

function validateCard(f: CardForm): FieldErrors {
  const errors: FieldErrors = {};
  if (!f.name.trim()) errors.name = 'Enter the cardholder name.';

  const digits = f.number.replace(/\s/g, '');
  if (!/^\d{16}$/.test(digits)) errors.number = 'Card number must be 16 digits.';

  const match = /^(\d{2})\/(\d{2})$/.exec(f.expiry.trim());
  if (!match || Number(match[1]) < 1 || Number(match[1]) > 12) {
    errors.expiry = 'Use the format MM/YY.';
  } else {
    // First day of the month after expiry; the card is valid until that moment.
    const expiresBefore = new Date(2000 + Number(match[2]), Number(match[1]), 1);
    if (expiresBefore <= new Date()) errors.expiry = 'This card has expired.';
  }

  if (!/^\d{3,4}$/.test(f.cvv)) errors.cvv = 'CVV must be 3 or 4 digits.';
  return errors;
}

function validateUpi(value: string): FieldErrors {
  if (!/^[^\s@]+@[^\s@]+$/.test(value.trim())) {
    return { upi: 'Enter a UPI ID that contains @, for example name@bank.' };
  }
  return {};
}

function validateBank(value: string): FieldErrors {
  if (!value.trim()) return { bank: 'Enter the name of your bank.' };
  return {};
}

function messageFrom(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong. Please try again.';
}

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

function TextField({ id, label, value, onChange, error, ...rest }: TextFieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-text">
        {label}
      </label>
      <input
        {...rest}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={INPUT}
      />
      {error && (
        <p id={errorId} className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

interface PlanCardProps {
  title: string;
  price: string;
  tagline: string;
  features: string[];
  highlight?: boolean;
  children: ReactNode;
}

function PlanCard({ title, price, tagline, features, highlight = false, children }: PlanCardProps) {
  return (
    <section className={`${PANEL} flex flex-col`} aria-labelledby={`plan-${title}`}>
      <h2
        id={`plan-${title}`}
        className={`text-lg font-semibold ${highlight ? 'text-teal-600 dark:text-teal-400' : 'text-text'}`}
      >
        {title}
        {highlight && (
          <span className="ml-2 rounded-full bg-teal-600/10 px-2 py-0.5 text-xs font-medium text-teal-600 dark:text-teal-400">
            Pro
          </span>
        )}
      </h2>
      <p className="mt-2 text-2xl font-semibold text-text">{price}</p>
      <p className="mt-1 text-sm text-text/60">{tagline}</p>
      <ul className="mt-4 flex-1 space-y-2">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-text">
            <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <div className="mt-6">{children}</div>
    </section>
  );
}

const FREE_FEATURES = [
  'Dashboard Overview',
  'Receivables Tracking',
  'Invoices & Billing',
  'Bills & Expenses',
  'Payment Plans',
  'Reports & Analytics',
  'Clinic Settings',
];

const PRO_FEATURES = [
  'All 7 Free Modules Included',
  '30/60/90-Day Cash Flow Forecast',
  'Bill Funding Chain (Coverage Mapping)',
  'Gap Closer (Deficit Recovery Actions)',
  'Automated Reminders (WhatsApp & UPI Links)',
  'Real-Time Shortage & Delinquency Alerts',
  'ClinicCash AI Daily Financial Advisor',
  'Priority 24/7 Clinical Support',
];

export default function PlansPage() {
  const navigate = useNavigate();
  const { status, trialDaysLeft, startSubscription } = useAuth();

  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [showPayment, setShowPayment] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>('card');
  const [card, setCard] = useState<CardForm>({ name: '', number: '', expiry: '', cvv: '' });
  const [upiId, setUpiId] = useState('');
  const [bankName, setBankName] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function choose(plan: Plan) {
    setActionError(null);
    setSubmitting(true);
    try {
      await startSubscription(plan);
      navigate('/dashboard');
    } catch (err: unknown) {
      setActionError(messageFrom(err));
      setSubmitting(false);
    }
  }

  function selectMethod(next: PaymentMethod) {
    setMethod(next);
    setErrors({});
    setActionError(null);
  }

  function updateCard<K extends keyof CardForm>(key: K, value: string) {
    setCard((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const { [key]: _cleared, ...rest } = prev;
      return rest;
    });
  }

  function handlePay(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const found =
      method === 'card'
        ? validateCard(card)
        : method === 'upi'
          ? validateUpi(upiId)
          : validateBank(bankName);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    void choose('pro');
  }

  if (status === 'pro') {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-teal-600 dark:text-teal-400">Choose your plan</h1>
        </header>
        <div className={PANEL}>
          <p className="text-base font-medium text-text">You are on the Pro plan</p>
          <p className="mt-1 text-sm text-text/60">All modules are available to you.</p>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className={`${SECONDARY_BTN} mt-4 sm:w-auto`}
          >
            Go to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-teal-600 dark:text-teal-400">Choose your plan</h1>
        <p className="text-sm text-text/60">
          Your {TRIAL_DAYS}-day free trial gives you full access to every module. When the trial ends, subscribe
          to Pro to keep full access, or continue on Free with the essential clinic management modules.
        </p>
      </header>

      {status === 'trialing' && (
        <div className={PANEL}>
          <p className="text-base font-medium text-text">
            Your free trial ends in {trialDaysLeft} {trialDaysLeft === 1 ? 'day' : 'days'}
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <PlanCard title="Free" price={FREE_PRICE} tagline="Essential modules included permanently" features={FREE_FEATURES}>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void choose('free')}
            className={SECONDARY_BTN}
          >
            Continue with Free
          </button>
        </PlanCard>

        <PlanCard
          title="Pro"
          highlight
          price={billingCycle === 'monthly' ? PRO_MONTHLY_PRICE : PRO_YEARLY_PRICE}
          tagline={
            billingCycle === 'monthly'
              ? 'Billed monthly at ₹150 / month'
              : 'Billed annually at ₹16,000 / year (1-Year Plan)'
          }
          features={PRO_FEATURES}
        >
          <div className="mb-4 flex rounded-xl border border-border bg-bg p-1">
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors ${
                billingCycle === 'monthly'
                  ? 'bg-teal-600 text-white shadow-sm dark:bg-teal-500'
                  : 'text-text/70 hover:text-text'
              }`}
            >
              Monthly (₹150)
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('yearly')}
              className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors ${
                billingCycle === 'yearly'
                  ? 'bg-teal-600 text-white shadow-sm dark:bg-teal-500'
                  : 'text-text/70 hover:text-text'
              }`}
            >
              1 Year (₹16,000)
            </button>
          </div>
          <button
            type="button"
            disabled={submitting}
            aria-expanded={showPayment}
            onClick={() => setShowPayment(true)}
            className={PRIMARY_BTN}
          >
            {billingCycle === 'monthly' ? 'Subscribe to Pro (₹150 / month)' : 'Subscribe to Pro (₹16,000 / year)'}
          </button>
        </PlanCard>
      </div>

      {actionError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {actionError}
        </p>
      )}

      {showPayment && (
        <section className={PANEL} aria-labelledby="payment-heading">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h2 id="payment-heading" className="text-lg font-semibold text-teal-600 dark:text-teal-400">
              Payment details
            </h2>
            <span className="rounded-full bg-teal-600/10 px-3 py-1 text-xs font-semibold text-teal-600 dark:text-teal-400">
              Selected: Pro ({billingCycle === 'monthly' ? 'Monthly — ₹150' : '1 Year — ₹16,000'})
            </span>
          </div>
          <p className="mt-2 rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text">
            Payments are not connected yet. This screen collects details in the form only and does not charge
            anyone.
          </p>

          <form onSubmit={handlePay} noValidate className="mt-4 space-y-4">
            <div role="group" aria-label="Payment method" className="flex flex-col gap-2 sm:flex-row">
              {METHODS.map((m) => {
                const pressed = method === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    aria-pressed={pressed}
                    onClick={() => selectMethod(m.value)}
                    className={`${TOGGLE_BASE} ${pressed ? TOGGLE_ON : TOGGLE_OFF}`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>

            {method === 'card' && (
              <div className="space-y-4">
                <TextField
                  id="pay-card-name"
                  label="Cardholder name"
                  autoComplete="cc-name"
                  value={card.name}
                  onChange={(v) => updateCard('name', v)}
                  error={errors.name}
                />
                <TextField
                  id="pay-card-number"
                  label="Card number"
                  inputMode="numeric"
                  autoComplete="cc-number"
                  placeholder="1234 5678 9012 3456"
                  value={card.number}
                  onChange={(v) => updateCard('number', v)}
                  error={errors.number}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    id="pay-card-expiry"
                    label="Expiry (MM/YY)"
                    inputMode="numeric"
                    autoComplete="cc-exp"
                    placeholder="MM/YY"
                    value={card.expiry}
                    onChange={(v) => updateCard('expiry', v)}
                    error={errors.expiry}
                  />
                  <TextField
                    id="pay-card-cvv"
                    label="CVV"
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    maxLength={4}
                    value={card.cvv}
                    onChange={(v) => updateCard('cvv', v)}
                    error={errors.cvv}
                  />
                </div>
              </div>
            )}

            {method === 'upi' && (
              <TextField
                id="pay-upi-id"
                label="UPI ID"
                autoComplete="off"
                placeholder="name@bank"
                value={upiId}
                onChange={(v) => {
                  setUpiId(v);
                  setErrors({});
                }}
                error={errors.upi}
              />
            )}

            {method === 'netbanking' && (
              <TextField
                id="pay-bank-name"
                label="Bank name"
                autoComplete="off"
                value={bankName}
                onChange={(v) => {
                  setBankName(v);
                  setErrors({});
                }}
                error={errors.bank}
              />
            )}

            <button type="submit" disabled={submitting} className={`${PRIMARY_BTN} sm:w-auto`}>
              Pay {billingCycle === 'monthly' ? '₹150' : '₹16,000'} & Start Pro
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
