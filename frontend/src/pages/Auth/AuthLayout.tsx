import type { ReactNode } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export default function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-bg px-6 py-12 text-text">
      <div className="absolute top-4 right-4">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-full border border-border bg-card text-text hover:bg-border/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 transition"
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
      </div>

      <h1 className="mb-8 text-2xl font-semibold tracking-tight text-teal-600 dark:text-teal-400">
        ClinicCash
      </h1>

      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="mb-6 text-center">
          <h2 className="text-xl font-semibold text-text">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-text/60">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}
