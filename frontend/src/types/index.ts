export interface Payer {
  id: string;
  name: string;
}

export interface Invoice {
  id: string;
  payer: Payer;
  patientName: string;
  amount: number;
  paidAmount: number;
  dueDate: string; // ISO date
  claimStage: string;
  status: 'paid' | 'pending' | 'overdue' | 'promise_to_pay';
  promiseDate?: string;
  overdueDays: number;
  nextAction: string;
}

export interface Bill {
  id: string;
  name: string;
  amount: number;
  dueDate: string;
  recurrence: 'none' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  deferrable: boolean;
  status: 'paid' | 'pending' | 'overdue';
}

export interface PaymentPlan {
  id: string;
  name: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  installmentAmount: number;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  nextPaymentDate: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  paidOn: string;
  method: string;
}

export interface ForecastPoint {
  date: string;
  likely: number;
  cautious: number;
  whatIf: number;
  safetyBuffer: number;
  zeroLine: number;
}

export interface ShortageWarning {
  date: string;
  projectedBalance: number;
  message: string;
}

export interface ForecastResponse {
  horizonDays: number;
  points: ForecastPoint[];
  shortageWarnings: ShortageWarning[];
  expectedCollections: number;
  upcomingExpenses: number;
}

export interface ForecastScenarioParams {
  payerId?: string;
  extraDelayDays: number;
  rejectionPct: number;
  billToDeferId?: string;
  deferralDays: number;
}

export interface GapAction {
  id: string;
  title: string;
  estimatedAmount: number;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  explanation: string;
}

export interface Reminder {
  id: string;
  invoiceId: string;
  tone: 'friendly' | 'firm' | 'final';
  language: 'en' | 'hi' | 'ta' | 'te' | 'bn' | 'mr';
  message: string;
  upiLink?: string;
  whatsappLink?: string;
}

export interface Alert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  type: string;
  message: string;
  createdAt: string;
}

export interface Settings {
  openingCash: number;
  weeklyWalkInCollections: number;
  safetyBuffer: number;
  dueSoonDays: number;
  reminderThresholdDays: number;
  timezone: string;
}

export interface DashboardSummary {
  openingCash: number;
  totalOutstanding: number;
  overdueAmount: number;
  expectedCollections: number;
  cashRunwayDays: number;
  financialHealthScore: number;
}

export type ReportType =
  | 'collections'
  | 'outstanding'
  | 'delays'
  | 'payer-reliability'
  | 'monthly-cashflow';

export interface ReportData {
  title: string;
  columns: string[];
  rows: (string | number)[][];
}

export interface ApiResult<T> {
  data: T;
}
