import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import AuthLayout from './AuthLayout';

const MIN_PASSWORD_LENGTH = 8;

const INPUT =
  'mt-1 block w-full min-h-[44px] rounded-xl border border-border bg-card px-3 text-sm text-text placeholder:text-text/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500';
const PRIMARY_BTN =
  'inline-flex w-full min-h-[44px] items-center justify-center rounded-xl bg-teal-600 px-4 text-sm font-medium text-white transition-colors hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-60 dark:bg-teal-500 dark:hover:bg-teal-400';

function messageFrom(err: unknown): string {
  return err instanceof Error && err.message
    ? err.message
    : 'Something went wrong. Please try again.';
}

export default function SignUpPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const passwordTooShort =
    password.length > 0 && password.length < MIN_PASSWORD_LENGTH
      ? `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
      : null;
  const passwordMismatch =
    confirmPassword.length > 0 && confirmPassword !== password
      ? 'Passwords do not match.'
      : null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await signUp({ name, email, password });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Create your account" subtitle="Start managing your clinic's cash flow">
      <div className="mb-6 rounded-xl bg-teal-50 px-3 py-2 text-sm text-teal-700 dark:bg-teal-500/10 dark:text-teal-300">
        Your 14-day free trial starts when you sign up. No card needed to start.
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="signup-name" className="block text-sm font-medium text-text">
            Name
          </label>
          <input
            id="signup-name"
            name="name"
            type="text"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={INPUT}
          />
        </div>

        <div>
          <label htmlFor="signup-email" className="block text-sm font-medium text-text">
            Email
          </label>
          <input
            id="signup-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={INPUT}
          />
        </div>

        <div>
          <label htmlFor="signup-password" className="block text-sm font-medium text-text">
            Password
          </label>
          <input
            id="signup-password"
            name="password"
            type="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            aria-invalid={passwordTooShort ? true : undefined}
            aria-describedby={passwordTooShort ? 'signup-password-hint' : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={INPUT}
          />
          {passwordTooShort && (
            <p id="signup-password-hint" className="mt-1 text-xs text-red-700 dark:text-red-300">
              {passwordTooShort}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="signup-confirm" className="block text-sm font-medium text-text">
            Confirm password
          </label>
          <input
            id="signup-confirm"
            name="confirmPassword"
            type="password"
            required
            autoComplete="new-password"
            aria-invalid={passwordMismatch ? true : undefined}
            aria-describedby={passwordMismatch ? 'signup-confirm-hint' : undefined}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={INPUT}
          />
          {passwordMismatch && (
            <p id="signup-confirm-hint" className="mt-1 text-xs text-red-700 dark:text-red-300">
              {passwordMismatch}
            </p>
          )}
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300"
          >
            {error}
          </div>
        )}

        <button type="submit" disabled={submitting} className={PRIMARY_BTN}>
          {submitting ? 'Creating account…' : 'Start free trial'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-text/60">
        Already have an account?{' '}
        <Link
          to="/signin"
          className="font-medium text-teal-600 hover:underline dark:text-teal-400 focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
        >
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
