import type { ReportData } from '../../types';

export const mockReport: ReportData = {
  title: 'Collections (sample)',
  columns: ['Invoice', 'Payer', 'Amount', 'Status'],
  rows: [
    ['INV-1001', 'Star Health', 45000, 'overdue'],
    ['INV-1002', 'ICICI Lombard', 72000, 'pending'],
    ['INV-1003', 'Self-pay', 8500, 'promise_to_pay'],
  ],
};

export const mockReportCsv = [
  'Invoice,Payer,Amount,Status',
  'INV-1001,Star Health,45000,overdue',
  'INV-1002,ICICI Lombard,72000,pending',
  'INV-1003,Self-pay,8500,promise_to_pay',
].join('\n');
