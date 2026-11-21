import type {
  ApiResult,
  DashboardSummary,
  Invoice,
  Payer,
  Payment,
  PaymentPlan,
  Reminder,
} from '../types';
import { api, unwrap } from './api';

export interface InvoiceQuery {
  search?: string;
  payer?: string;
  status?: Invoice['status'];
  sortBy?: 'amount' | 'dueDate';
  sortDir?: 'asc' | 'desc';
}

export type InvoiceInput = Omit<Invoice, 'id'> & {
  isInstallmentPlan?: boolean;
  planMonths?: number;
};
export type InvoiceUpdate = Partial<Omit<Invoice, 'id'>>;
export type PaymentInput = Omit<Payment, 'id' | 'invoiceId'>;
export interface InstallmentPlanInput {
  installmentAmount: number;
  frequency: PaymentPlan['frequency'];
  startDate: string;
}
export type ReminderInput = Pick<Reminder, 'invoiceId' | 'tone' | 'language'>;

export async function getDashboardSummary(): Promise<DashboardSummary> {
  return unwrap(api.get<ApiResult<DashboardSummary>>('/dashboard/summary'));
}

export async function listInvoices(params?: InvoiceQuery): Promise<Invoice[]> {
  return unwrap(api.get<ApiResult<Invoice[]>>('/invoices', { params }));
}

export async function listPayers(): Promise<Payer[]> {
  return unwrap(api.get<ApiResult<Payer[]>>('/payers'));
}

export async function getInvoice(id: string): Promise<Invoice> {
  return unwrap(api.get<ApiResult<Invoice>>(`/invoices/${id}`));
}

export async function createInvoice(input: InvoiceInput): Promise<Invoice> {
  return unwrap(api.post<ApiResult<Invoice>>('/invoices', input));
}

export async function updateInvoice(id: string, input: InvoiceUpdate): Promise<Invoice> {
  return unwrap(api.put<ApiResult<Invoice>>(`/invoices/${id}`, input));
}

export async function deleteInvoice(id: string): Promise<void> {
  await api.delete(`/invoices/${id}`);
}

export async function recordPayment(invoiceId: string, input: PaymentInput): Promise<Payment> {
  return unwrap(api.post<ApiResult<Payment>>(`/invoices/${invoiceId}/payments`, input));
}

export async function markInvoicePaid(invoiceId: string): Promise<Invoice> {
  return unwrap(api.post<ApiResult<Invoice>>(`/invoices/${invoiceId}/mark-paid`));
}

export async function setPromiseToPay(invoiceId: string, promiseDate: string): Promise<Invoice> {
  return unwrap(
    api.post<ApiResult<Invoice>>(`/invoices/${invoiceId}/promise-to-pay`, { promiseDate }),
  );
}

export async function createInstallmentPlan(
  invoiceId: string,
  input: InstallmentPlanInput,
): Promise<PaymentPlan> {
  return unwrap(
    api.post<ApiResult<PaymentPlan>>(`/invoices/${invoiceId}/payment-plans`, input),
  );
}

export async function listPaymentPlans(): Promise<PaymentPlan[]> {
  return unwrap(api.get<ApiResult<PaymentPlan[]>>('/payment-plans'));
}

export async function listReminders(): Promise<Reminder[]> {
  return unwrap(api.get<ApiResult<Reminder[]>>('/reminders'));
}

export async function generateReminder(input: ReminderInput): Promise<Reminder> {
  return unwrap(api.post<ApiResult<Reminder>>('/reminders/generate', input));
}
