import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  ChevronDown,
  FilePlus,
  Menu,
  Moon,
  PanelLeft,
  Plus,
  Receipt,
  RefreshCw,
  Sun,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useCurrentTime } from '../../hooks/useCurrentTime';

interface TopBarProps {
  onToggleSidebar: () => void;
  onOpenMenu: () => void;
}

interface QuickAction {
  label: string;
  path: string;
  icon: LucideIcon;
}

const iconButtonClass =
  'relative inline-flex h-11 w-11 min-h-11 min-w-11 items-center justify-center rounded-lg text-text transition-colors hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500';

const quickActions: QuickAction[] = [
  { label: 'Create invoice', path: '/dashboard/invoices', icon: FilePlus },
  { label: 'Record payment', path: '/dashboard/receivables', icon: Wallet },
  { label: 'Add clinic bill', path: '/dashboard/bills', icon: Receipt },
];

const dateTimeFormatter = new Intl.DateTimeFormat('en-IN', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

export default function TopBar({ onToggleSidebar, onOpenMenu }: TopBarProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const navigate = useNavigate();
  const now = useCurrentTime();

  const [menuOpen, setMenuOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const menuWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const handleMouseDown = (event: MouseEvent) => {
      const wrapper = menuWrapperRef.current;
      if (wrapper && event.target instanceof Node && !wrapper.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const handleQuickAction = (path: string) => {
    setMenuOpen(false);
    navigate(path);
  };

  return (
    <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-3 border-b border-border bg-card px-4 py-2 md:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          aria-label="Open menu"
          onClick={onOpenMenu}
          className={`${iconButtonClass} md:hidden`}
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Toggle sidebar"
          onClick={onToggleSidebar}
          className={`${iconButtonClass} hidden md:inline-flex`}
        >
          <PanelLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="min-w-0">
          <span className="block text-lg font-semibold tracking-tight text-teal-600 dark:text-teal-400">
            ClinicCash
          </span>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
            <time dateTime={now.toISOString()}>{dateTimeFormatter.format(now)}</time>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        <div ref={menuWrapperRef} className="relative">
          <button
            type="button"
            aria-label="Quick actions"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl bg-teal-600 px-3 text-sm font-medium text-white transition-colors hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <Plus className="h-5 w-5" aria-hidden="true" />
            <span className="hidden sm:inline">Quick actions</span>
            <ChevronDown className="hidden h-4 w-4 sm:inline" aria-hidden="true" />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full z-40 mt-2 w-56 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-card py-2 text-text shadow-lg"
            >
              {quickActions.map(({ label, path, icon: Icon }) => (
                <button
                  key={path}
                  type="button"
                  role="menuitem"
                  onClick={() => handleQuickAction(path)}
                  className="flex min-h-11 w-full items-center gap-3 px-4 text-left text-sm text-text transition-colors hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500"
                >
                  <Icon className="h-4 w-4 text-accent" aria-hidden="true" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          aria-label="Refresh clinic data"
          onClick={() => {
            setIsRefreshing(true);
            window.location.reload();
          }}
          className={iconButtonClass}
          title="Refresh clinic data"
        >
          <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
        </button>

        <button
          type="button"
          aria-label="Notifications"
          onClick={() => navigate('/dashboard/alerts')}
          className={iconButtonClass}
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          <span
            aria-hidden="true"
            className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500"
          />
        </button>

        <button
          type="button"
          aria-label="Toggle theme"
          onClick={toggleTheme}
          className={iconButtonClass}
        >
          {isDark ? (
            <Sun className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Moon className="h-5 w-5" aria-hidden="true" />
          )}
        </button>

        <button
          type="button"
          aria-label="Clinic profile"
          onClick={() => navigate('/dashboard/settings')}
          className="inline-flex h-11 w-11 min-h-11 min-w-11 items-center justify-center rounded-full bg-teal-600 text-sm font-semibold text-white transition-colors hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          CC
        </button>
      </div>
    </header>
  );
}
