import { api, unwrap } from './api';

export interface UrgentAction {
  symbol: string;
  title: string;
  amount: number;
  impact: string;
  action_type: 'chase' | 'defer' | 'plan' | 'review';
}

export interface DailyBriefing {
  today: string;
  summary: string;
  cash_balance: number;
  safety_buffer: number;
  min_forecast_balance: number;
  gap_amount: number;
  gap_day?: string;
  overdue_total: number;
  overdue_count: number;
  bills_due_soon_total: number;
  urgent_actions: UrgentAction[];
  health_score: number;
  health_label: string;
  daily_tip: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatResponse {
  reply: string;
  suggestions: string[];
  category?: string;
}

export const aiService = {
  getDailyBriefing: (): Promise<DailyBriefing> =>
    unwrap<{ data?: DailyBriefing } | DailyBriefing>(api.get('/ai/daily-briefing')).then((res: any) =>
      res && 'data' in res ? res.data : res,
    ),

  sendMessage: (message: string, history: ChatMessage[] = []): Promise<ChatResponse> =>
    unwrap<{ data?: ChatResponse } | ChatResponse>(api.post('/ai/chat', { message, history })).then(
      (res: any) => (res && 'data' in res ? res.data : res),
    ),
};
