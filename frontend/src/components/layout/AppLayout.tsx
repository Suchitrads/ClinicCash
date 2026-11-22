import { useEffect, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { useAuth } from '../../contexts/AuthContext';
import AIChatWidget from '../ai/AIChatWidget';

const FADE_IN_STYLE = `
@keyframes cc-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
.animate-fade-in {
  animation: cc-fade-in 400ms ease-out both;
}
@media (prefers-reduced-motion: reduce) {
  .animate-fade-in {
    animation: none;
  }
}
`;

export default function AppLayout() {
  const { status, trialDaysLeft } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };

    document.addEventListener('keydown', onKeyDown);
    document.body.classList.add('overflow-hidden');

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.classList.remove('overflow-hidden');
    };
  }, [mobileOpen]);

  return (
    <div className="min-h-screen bg-bg text-text">
      <style>{FADE_IN_STYLE}</style>

      {/* Desktop sidebar */}
      <aside
        className={`fixed left-0 top-0 z-20 hidden h-screen flex-col border-r border-border bg-card transition-[width] duration-200 motion-reduce:transition-none md:flex ${
          collapsed ? 'w-16' : 'w-64'
        }`}
      >
        <div
          className={`flex h-16 shrink-0 items-center border-b border-border px-4 ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <span className="text-base font-semibold text-text">
            {collapsed ? 'CC' : 'ClinicCash'}
          </span>
        </div>
        <Sidebar collapsed={collapsed} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden">
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="fixed left-0 top-0 z-50 flex h-full w-72 max-w-[85vw] flex-col border-r border-border bg-card">
            <div className="flex h-16 shrink-0 items-center border-b border-border px-4">
              <span className="text-base font-semibold text-text">ClinicCash</span>
            </div>
            <Sidebar collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main column */}
      <div
        className={`min-w-0 transition-[padding] duration-200 motion-reduce:transition-none ${
          collapsed ? 'md:pl-16' : 'md:pl-64'
        }`}
      >
        <TopBar
          onToggleSidebar={() => setCollapsed((c) => !c)}
          onOpenMenu={() => setMobileOpen(true)}
        />
        {status === 'trialing' && (
          <div className="mx-4 mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm text-text md:mx-6 md:mt-6">
            <span>
              Free trial: {trialDaysLeft} {trialDaysLeft === 1 ? 'day' : 'days'} left. All features are unlocked.
            </span>
            <Link
              to="/plans"
              className="inline-flex min-h-[44px] items-center font-medium text-teal-600 dark:text-teal-400"
            >
              Subscribe
            </Link>
          </div>
        )}
        {status === 'expired' && (
          <div className="mx-4 mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm text-text md:mx-6 md:mt-6">
            <span>
              Your free trial has ended. Dashboard, Receivables, Invoices, Bills, Payment Plans, Reports & Analytics, and Settings stay available on Free. Subscribe to unlock Pro.
            </span>
            <Link
              to="/plans"
              className="inline-flex min-h-[44px] items-center font-medium text-teal-600 dark:text-teal-400"
            >
              View plans
            </Link>
          </div>
        )}
        <main className="min-w-0 animate-fade-in p-4 md:p-6">
          <Outlet />
        </main>
      </div>

      {/* Floating AI Chat Assistant Widget */}
      <AIChatWidget />
    </div>
  );
}
