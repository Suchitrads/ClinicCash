import type { ReactNode } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import type { ModuleKey } from '../../lib/plan';

const MODULE_LABELS: Record<ModuleKey, string> = {
  dashboard: 'Dashboard',
  receivables: 'Receivables',
  invoices: 'Invoices',
  forecast: 'Forecast',
  'funding-chain': 'Funding Chain',
  'gap-closer': 'Gap Closer',
  bills: 'Bills',
  'payment-plans': 'Payment Plans',
  reminders: 'Reminders',
  alerts: 'Alerts',
  reports: 'Reports & Analytics',
  settings: 'Settings',
};

interface ModuleGateProps {
  module: ModuleKey;
  children: ReactNode;
}

export default function ModuleGate({ module, children }: ModuleGateProps) {
  const { isAuthenticated, status, canAccess } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/signup" replace />;
  }

  if (status === 'expired' && !canAccess(module)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 sm:p-8 text-center shadow-sm">
          <h2 className="text-xl font-semibold text-text">Your free trial has ended</h2>
          <p className="mt-3 text-sm text-text/70">
            Upgrade to Pro to use {MODULE_LABELS[module]}. Dashboard, Receivables, Invoices, Bills, Payment Plans, Reports & Analytics, and Settings stay available on Free.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/plans"
              className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-2xl bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-white font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 transition"
            >
              View plans
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-2xl border border-border bg-card text-text font-medium hover:bg-border/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 transition"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
