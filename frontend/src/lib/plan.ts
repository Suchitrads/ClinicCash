export const TRIAL_DAYS = 14;

export const BASIC_MODULES = [
  'dashboard',
  'receivables',
  'invoices',
  'bills',
  'payment-plans',
  'reports',
  'settings',
] as const;

export type ModuleKey =
  | 'dashboard'
  | 'receivables'
  | 'invoices'
  | 'forecast'
  | 'funding-chain'
  | 'gap-closer'
  | 'bills'
  | 'payment-plans'
  | 'reminders'
  | 'alerts'
  | 'reports'
  | 'settings';

export const ALL_MODULES: ModuleKey[] = [
  'dashboard',
  'receivables',
  'invoices',
  'forecast',
  'funding-chain',
  'gap-closer',
  'bills',
  'payment-plans',
  'reminders',
  'alerts',
  'reports',
  'settings',
];

export type Plan = 'pro' | 'free';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Whole days remaining until `trialEndsAt` (rounded up), never below 0.
 */
export function daysLeft(trialEndsAt: string, now = Date.now()): number {
  const end = Date.parse(trialEndsAt);
  if (Number.isNaN(end)) return 0;
  const remaining = Math.ceil((end - now) / MS_PER_DAY);
  return Math.max(0, remaining);
}
