import type { GapAction } from '../../types';

export const mockGapActions: GapAction[] = [
  {
    id: 'GA-1',
    title: 'Chase overdue Star Health claims',
    estimatedAmount: 45000,
    impact: 'Closes most of the mid-July gap',
    effort: 'low',
    explanation: 'Overdue claim INV-1001 is past its payer SLA; an escalation call usually unlocks it.',
  },
  {
    id: 'GA-2',
    title: 'Defer equipment AMC payment',
    estimatedAmount: 36000,
    impact: 'Shifts outflow by 30 days',
    effort: 'low',
    explanation: 'The AMC bill is marked deferrable; vendor has accepted deferrals before.',
  },
  {
    id: 'GA-3',
    title: 'Offer installment plan on INV-1002',
    estimatedAmount: 52000,
    impact: 'Converts balance into predictable weekly inflow',
    effort: 'medium',
    explanation: 'Patient has partially paid; an installment plan reduces the risk of default.',
  },
];
