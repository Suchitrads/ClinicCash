import { NavLink } from 'react-router-dom';
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
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  onNavigate?: () => void;
}

interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Overview', path: '/dashboard', icon: LayoutDashboard, end: true },
  { label: 'Receivables', path: '/dashboard/receivables', icon: Wallet },
  { label: 'Invoices', path: '/dashboard/invoices', icon: FileText },
  { label: 'Cash Flow Forecast', path: '/dashboard/forecast', icon: TrendingUp },
  { label: 'Funding Chain', path: '/dashboard/funding-chain', icon: Link2 },
  { label: 'Gap Closer', path: '/dashboard/gap-closer', icon: Target },
  { label: 'Bills & Expenses', path: '/dashboard/bills', icon: Receipt },
  { label: 'Payment Plans', path: '/dashboard/payment-plans', icon: CalendarClock },
  { label: 'Reminders', path: '/dashboard/reminders', icon: BellRing },
  { label: 'Alerts', path: '/dashboard/alerts', icon: AlertTriangle },
  { label: 'Reports & Analytics', path: '/dashboard/reports', icon: BarChart3 },
  { label: 'Settings', path: '/dashboard/settings', icon: Settings },
];

export default function Sidebar({ collapsed, onNavigate }: SidebarProps) {
  return (
    <nav aria-label="Main" className="flex-1 overflow-y-auto px-2 py-3">
      <ul className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ label, path, icon: Icon, end }) => (
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
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
