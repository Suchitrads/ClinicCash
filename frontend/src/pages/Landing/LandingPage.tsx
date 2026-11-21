import { useEffect, useState, type MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import ToothGrowthIllustration from '../../components/common/ToothGrowthIllustration';

const LEAVE_DURATION_MS = 400;

export default function LandingPage() {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => navigate('/dashboard'), LEAVE_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [leaving, navigate]);

  const handleEnter = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    setLeaving(true);
  };

  return (
    <div
      className={`relative min-h-screen flex flex-col items-center justify-between bg-bg text-text px-6 transition duration-400 ${
        leaving ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
      }`}
    >
      <div className="absolute top-4 right-4">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-full border border-border bg-card text-text hover:bg-border/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition"
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
      </div>

      <h1 className="mt-6 text-2xl font-semibold text-teal-600 dark:text-teal-400 tracking-tight">
        ClinicCash
      </h1>

      <div className="flex-1 flex items-center justify-center w-full">
        <div className="w-full max-w-[220px] sm:max-w-[300px]">
          <ToothGrowthIllustration />
        </div>
      </div>

      <div className="flex flex-col items-center text-center w-full">
        <p className="mt-8 mb-3 text-2xl sm:text-3xl font-medium text-teal-600 dark:text-teal-400">
          Healthy Clinics. Stronger Cash Flow.
        </p>


        <div className="w-full mt-8">
          <Link
            to="/dashboard"
            onClick={handleEnter}
            className="block w-full max-w-xs mx-auto min-h-[56px] py-4 rounded-2xl text-center text-xl font-medium text-teal-600 dark:text-teal-400 animate-[pulse_3s_ease-in-out_infinite] md:hover:scale-105 active:scale-95 transition-transform focus-visible:ring-2 focus-visible:ring-teal-500 outline-none"
          >
            Tap to Enter →
          </Link>
        </div>
      </div>

      <p className="mt-8 mb-4 text-xs text-slate-400 dark:text-slate-500 text-center">
        Intelligent Cash Flow Management for Modern Clinics
      </p>
    </div>
  );
}
