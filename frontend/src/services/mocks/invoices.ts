import type { Invoice, PaymentPlan } from '../../types';

export const mockInvoices: Invoice[] = [
  {
    id: 'INV-1001',
    payer: { id: 'P-1', name: 'Star Health' },
    patientName: 'Ravi Kumar',
    amount: 45000,
    paidAmount: 0,
    dueDate: '2025-06-10',
    claimStage: 'Submitted',
    status: 'overdue',
    overdueDays: 12,
    nextAction: 'Follow up with payer',
  },
  {
    id: 'INV-1002',
    payer: { id: 'P-2', name: 'ICICI Lombard' },
    patientName: 'Asha Menon',
    amount: 72000,
    paidAmount: 20000,
    dueDate: '2025-06-25',
    claimStage: 'Under review',
    status: 'pending',
    overdueDays: 0,
    nextAction: 'Send reminder',
  },
  {
    id: 'INV-1003',
    payer: { id: 'P-3', name: 'Self-pay' },
    patientName: 'Imran Sheikh',
    amount: 8500,
    paidAmount: 0,
    dueDate: '2025-06-18',
    claimStage: 'Billed',
    status: 'promise_to_pay',
    promiseDate: '2025-06-22',
    overdueDays: 0,
    nextAction: 'Confirm promise date',
  },
];

export const mockPaymentPlans: PaymentPlan[] = [
  {
    id: 'PP-1',
    name: 'Ravi Kumar — surgery balance',
    totalAmount: 60000,
    paidAmount: 20000,
    remainingAmount: 40000,
    installmentAmount: 10000,
    frequency: 'monthly',
    nextPaymentDate: '2025-07-01',
  },
];
