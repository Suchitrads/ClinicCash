import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Wallet,
  FileText,
  TrendingUp,
  Link2,
  Target,
  Receipt,
  CalendarClock,
  BellRing,
  AlertTriangle,
  BarChart3,
  Settings,
  LogOut,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import type { ModuleKey } from '../../lib/plan';

interface SidebarProps {
  collapsed: boolean;
  onNavigate?: () => void;
}

interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  moduleKey: ModuleKey;
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Overview', path: '/dashboard', icon: LayoutDashboard, moduleKey: 'dashboard', end: true },
  { label: 'Receivables', path: '/dashboard/receivables', icon: Wallet, moduleKey: 'receivables' },
  { label: 'Invoices', path: '/dashboard/invoices', icon: FileText, moduleKey: 'invoices' },
  { label: 'Cash Flow Forecast', path: '/dashboard/forecast', icon: TrendingUp, moduleKey: 'forecast' },
  { label: 'Funding Chain', path: '/dashboard/funding-chain', icon: Link2, moduleKey: 'funding-chain' },
  { label: 'Gap Closer', path: '/dashboard/gap-closer', icon: Target, moduleKey: 'gap-closer' },
  { label: 'Bills & Expenses', path: '/dashboard/bills', icon: Receipt, moduleKey: 'bills' },
  { label: 'Payment Plans', path: '/dashboard/payment-plans', icon: CalendarClock, moduleKey: 'payment-plans' },
  { label: 'Reminders', path: '/dashboard/reminders', icon: BellRing, moduleKey: 'reminders' },
  { label: 'Alerts', path: '/dashboard/alerts', icon: AlertTriangle, moduleKey: 'alerts' },
  { label: 'Reports & Analytics', path: '/dashboard/reports', icon: BarChart3, moduleKey: 'reports' },
  { label: 'Settings', path: '/dashboard/settings', icon: Settings, moduleKey: 'settings' },
];

export default function Sidebar({ collapsed, onNavigate }: SidebarProps) {
  const { isAuthenticated, status, canAccess, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = () => {
    signOut();
    onNavigate?.();
    navigate('/');
  };

  return (
    <>
      <nav aria-label="Main" className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ label, path, icon: Icon, moduleKey, end }) => {
            const showProTag = isAuthenticated && status === 'expired' && !canAccess(moduleKey);
            return (
              <li key={path}>
                <NavLink
                  to={path}
                  end={end}
                  onClick={() => onNavigate?.()}
                  title={collapsed ? label : undefined}
                  aria-label={collapsed ? label : undefined}
                  className={({ isActive }) =>
                    [
                      'flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
                      collapsed ? 'justify-center' : '',
                      isActive
                        ? 'bg-teal-600 text-white dark:bg-teal-500'
                        : 'text-muted hover:bg-card hover:text-text',
                    ]
                      .filter(Boolean)
                      .join(' ')
                  }
                >
                  <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span className={collapsed ? 'sr-only' : 'truncate'}>{label}</span>
                  {showProTag && !collapsed && (
                    <span className="ml-auto shrink-0 rounded-full border border-teal-600/30 px-2 text-xs text-teal-600 dark:border-teal-400/30 dark:text-teal-400">
                      Pro
                    </span>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {isAuthenticated && (
        <div className="shrink-0 border-t border-border px-2 py-3">
          <button
            type="button"
            onClick={handleSignOut}
            title={collapsed ? 'Sign out' : undefined}
            aria-label={collapsed ? 'Sign out' : undefined}
            className={`flex min-h-[44px] w-full items-center gap-3 rounded-xl border border-border bg-card px-3 text-sm text-text hover:bg-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className={collapsed ? 'sr-only' : 'truncate'}>Sign out</span>
          </button>
        </div>
      )}
    </>
  );
}
