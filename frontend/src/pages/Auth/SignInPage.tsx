import { useState, type FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import AuthLayout from './AuthLayout';

const INPUT =
  'mt-1 block w-full min-h-[44px] rounded-xl border border-border bg-card px-3 text-sm text-text placeholder:text-text/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500';
const PRIMARY_BTN =
  'inline-flex w-full min-h-[44px] items-center justify-center rounded-xl bg-teal-600 px-4 text-sm font-medium text-white transition-colors hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-60 dark:bg-teal-500 dark:hover:bg-teal-400';
const SECONDARY_BTN =
  'inline-flex w-full min-h-[44px] items-center justify-center rounded-xl border border-border bg-bg px-4 text-sm font-medium text-text transition-colors hover:bg-border/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-60';

function messageFrom(err: unknown): string {
  return err instanceof Error && err.message
    ? err.message
    : 'Something went wrong. Please try again.';
}

export default function SignInPage() {
  const { signIn, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn({ email, password });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setGoogleSubmitting(true);
    try {
      await signInWithGoogle();
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setGoogleSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Sign in" subtitle="Welcome back to ClinicCash">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="signin-email" className="block text-sm font-medium text-text">
            Email
          </label>
          <input
            id="signin-email"
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
          <label htmlFor="signin-password" className="block text-sm font-medium text-text">
            Password
          </label>
          <div className="relative">
            <input
              id="signin-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${INPUT} pr-11`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text/50 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded p-1 transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
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
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs text-text/60">
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
        <span>or</span>
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
      </div>

      <button
        type="button"
        onClick={handleGoogle}
        disabled={googleSubmitting}
        className={SECONDARY_BTN}
      >
        {googleSubmitting ? 'Connecting…' : 'Continue with Google'}
      </button>

      <p className="mt-6 text-center text-sm text-text/60">
        New to ClinicCash?{' '}
        <Link
          to="/signup"
          className="font-medium text-teal-600 hover:underline dark:text-teal-400 focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
        >
          Start your 14-day free trial
        </Link>
      </p>
    </AuthLayout>
  );
}
