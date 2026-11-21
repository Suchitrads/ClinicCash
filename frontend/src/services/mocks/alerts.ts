import type { Alert } from '../../types';

export const mockAlerts: Alert[] = [
  {
    id: 'A-1',
    severity: 'critical',
    type: 'cash_shortage',
    message: 'Projected balance falls below safety buffer by 14 July.',
    createdAt: '2025-06-15T09:00:00+05:30',
  },
  {
    id: 'A-2',
    severity: 'warning',
    type: 'overdue_invoice',
    message: 'INV-1001 is 12 days overdue.',
    createdAt: '2025-06-15T08:30:00+05:30',
  },
  {
    id: 'A-3',
    severity: 'info',
    type: 'promise_to_pay',
    message: 'Promise-to-pay date for INV-1003 is 22 June.',
    createdAt: '2025-06-14T17:45:00+05:30',
  },
];
