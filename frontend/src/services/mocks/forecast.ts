import type { ForecastResponse } from '../../types';

export const mockForecast: ForecastResponse = {
  horizonDays: 30,
  points: [
    { date: '2025-06-16', likely: 310000, cautious: 290000, whatIf: 300000, safetyBuffer: 50000, zeroLine: 0 },
    { date: '2025-06-23', likely: 285000, cautious: 262000, whatIf: 270000, safetyBuffer: 50000, zeroLine: 0 },
    { date: '2025-06-30', likely: 240000, cautious: 205000, whatIf: 220000, safetyBuffer: 50000, zeroLine: 0 },
    { date: '2025-07-07', likely: 196000, cautious: 160000, whatIf: 178000, safetyBuffer: 50000, zeroLine: 0 },
    { date: '2025-07-14', likely: 152000, cautious: 118000, whatIf: 131000, safetyBuffer: 50000, zeroLine: 0 },
  ],
  shortageWarnings: [
    {
      date: '2025-07-07',
      projectedBalance: 160000,
      message: 'Cautious scenario drops below safety buffer by mid-July.',
    },
  ],
  expectedCollections: 210000,
  upcomingExpenses: 165000,
};
