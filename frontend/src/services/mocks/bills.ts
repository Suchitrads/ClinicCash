import type { Bill } from '../../types';

export const mockBills: Bill[] = [
  {
    id: 'B-1',
    name: 'Medical supplies vendor',
    amount: 85000,
    dueDate: '2025-06-20',
    recurrence: 'monthly',
    deferrable: true,
    status: 'pending',
  },
  {
    id: 'B-2',
    name: 'Staff salaries',
    amount: 210000,
    dueDate: '2025-06-30',
    recurrence: 'monthly',
    deferrable: false,
    status: 'pending',
  },
  {
    id: 'B-3',
    name: 'Equipment AMC',
    amount: 36000,
    dueDate: '2025-06-08',
    recurrence: 'quarterly',
    deferrable: true,
    status: 'overdue',
  },
];
