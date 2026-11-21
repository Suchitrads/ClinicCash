import type { Reminder } from '../../types';

export const mockReminders: Reminder[] = [
  {
    id: 'R-1',
    invoiceId: 'INV-1001',
    tone: 'firm',
    language: 'en',
    message: 'Your invoice INV-1001 is overdue. Please arrange payment at the earliest.',
  },
  {
    id: 'R-2',
    invoiceId: 'INV-1002',
    tone: 'friendly',
    language: 'hi',
    message: 'आपके इनवॉइस INV-1002 का भुगतान बाकी है। कृपया जल्द भुगतान करें।',
  },
];
