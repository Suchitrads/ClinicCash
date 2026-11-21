import type {
  ApiResult,
  DashboardSummary,
  Invoice,
  Payment,
  PaymentPlan,
  Reminder,
} from '../types';
import { api, unwrap, withMockFallback } from './api';
import { mockDashboardSummary } from './mocks/dashboard';
import { mockInvoices, mockPaymentPlans } from './mocks/invoices';
import { mockReminders } from './mocks/reminders';

export interface InvoiceQuery {
  search?: string;
  payer?: string;
  status?: Invoice['status'];
  sortBy?: 'amount' | 'dueDate';
  sortDir?: 'asc' | 'desc';
}

export type InvoiceInput = Omit<Invoice, 'id'>;
export type InvoiceUpdate = Partial<Omit<Invoice, 'id'>>;
export type PaymentInput = Omit<Payment, 'id' | 'invoiceId'>;
export interface InstallmentPlanInput {
  installmentAmount: number;
  frequency: PaymentPlan['frequency'];
  startDate: string;
}
export type ReminderInput = Pick<Reminder, 'invoiceId' | 'tone' | 'language'>;

export async function getDashboardSummary(): Promise<DashboardSummary> {
  return withMockFallback(
    'GET /dashboard/summary',
    () => unwrap(api.get<ApiResult<DashboardSummary>>('/dashboard/summary')),
    () => mockDashboardSummary,
  );
}

export async function listInvoices(params?: InvoiceQuery): Promise<Invoice[]> {
  return withMockFallback(
    'GET /invoices',
    () => unwrap(api.get<ApiResult<Invoice[]>>('/invoices', { params })),
    () => mockInvoices,
  );
}

export async function getInvoice(id: string): Promise<Invoice> {
  return withMockFallback(
    `GET /invoices/${id}`,
    () => unwrap(api.get<ApiResult<Invoice>>(`/invoices/${id}`)),
    () => mockInvoices.find((inv) => inv.id === id) ?? mockInvoices[0],
  );
}

/** Mutation: no mock fallback. */
export async function createInvoice(input: InvoiceInput): Promise<Invoice> {
  return unwrap(api.post<ApiResult<Invoice>>('/invoices', input));
}

/** Mutation: no mock fallback. */
export async function updateInvoice(id: string, input: InvoiceUpdate): Promise<Invoice> {
  return unwrap(api.put<ApiResult<Invoice>>(`/invoices/${id}`, input));
}

/** Removes the invoice; on mock fallback it is spliced out of the shared mock list. */
export async function deleteInvoice(id: string): Promise<void> {
  return withMockFallback(
    `DELETE /invoices/${id}`,
    async () => {
      await api.delete(`/invoices/${id}`);
    },
    () => {
      const index = mockInvoices.findIndex((inv) => inv.id === id);
      if (index !== -1) mockInvoices.splice(index, 1);
    },
  );
}

/** Mutation: no mock fallback. */
export async function recordPayment(invoiceId: string, input: PaymentInput): Promise<Payment> {
  return unwrap(api.post<ApiResult<Payment>>(`/invoices/${invoiceId}/payments`, input));
}

/** Mutation: no mock fallback. */
export async function markInvoicePaid(invoiceId: string): Promise<Invoice> {
  return unwrap(api.post<ApiResult<Invoice>>(`/invoices/${invoiceId}/mark-paid`));
}

/** Mutation: no mock fallback. */
export async function setPromiseToPay(invoiceId: string, promiseDate: string): Promise<Invoice> {
  return unwrap(
    api.post<ApiResult<Invoice>>(`/invoices/${invoiceId}/promise-to-pay`, { promiseDate }),
  );
}

/** Mutation: no mock fallback. */
export async function createInstallmentPlan(
  invoiceId: string,
  input: InstallmentPlanInput,
): Promise<PaymentPlan> {
  return unwrap(
    api.post<ApiResult<PaymentPlan>>(`/invoices/${invoiceId}/payment-plans`, input),
  );
}

export async function listPaymentPlans(): Promise<PaymentPlan[]> {
  return withMockFallback(
    'GET /payment-plans',
    () => unwrap(api.get<ApiResult<PaymentPlan[]>>('/payment-plans')),
    () => mockPaymentPlans,
  );
}

export async function listReminders(): Promise<Reminder[]> {
  return withMockFallback(
    'GET /reminders',
    () => unwrap(api.get<ApiResult<Reminder[]>>('/reminders')),
    () => mockReminders,
  );
}

/** Mutation: no mock fallback. */
export async function generateReminder(input: ReminderInput): Promise<Reminder> {
  return unwrap(api.post<ApiResult<Reminder>>('/reminders/generate', input));
}
