import type { ForecastResponse, ForecastScenarioParams, GapAction, ReportData, ReportType, Settings, Alert } from '../types';
import { api, unwrap, withMockFallback } from './api';
import { mockAlerts } from './mocks/alerts';
import { mockForecast } from './mocks/forecast';
import { mockGapActions } from './mocks/gap';
import { mockReport, mockReportCsv } from './mocks/reports';
import { mockSettings } from './mocks/settings';
import type { ApiResult } from '../types';

export async function getForecast(horizonDays: number): Promise<ForecastResponse> {
  return withMockFallback(
    'GET /forecast',
    () => unwrap(api.get<ApiResult<ForecastResponse>>('/forecast', { params: { horizon: horizonDays } })),
    () => mockForecast,
  );
}

export async function postForecastScenario(params: ForecastScenarioParams): Promise<ForecastResponse> {
  return withMockFallback(
    'POST /forecast/scenario',
    () => unwrap(api.post<ApiResult<ForecastResponse>>('/forecast/scenario', params)),
    () => mockForecast,
  );
}

export async function getGapActions(): Promise<GapAction[]> {
  return withMockFallback(
    'GET /gap-closer/actions',
    () => unwrap(api.get<ApiResult<GapAction[]>>('/gap-closer/actions')),
    () => mockGapActions,
  );
}

/** Mutation: no mock fallback — returns the real backend response. */
export async function executeGapAction(id: string): Promise<GapAction> {
  return unwrap(api.post<ApiResult<GapAction>>(`/gap-closer/actions/${id}/execute`));
}

export async function getAlerts(): Promise<Alert[]> {
  return withMockFallback(
    'GET /alerts',
    () => unwrap(api.get<ApiResult<Alert[]>>('/alerts')),
    () => mockAlerts,
  );
}

export async function getReports(type: ReportType): Promise<ReportData> {
  return withMockFallback(
    `GET /reports/${type}`,
    () => unwrap(api.get<ApiResult<ReportData>>(`/reports/${type}`)),
    () => mockReport,
  );
}

export async function exportReportCsv(type: ReportType): Promise<string> {
  return withMockFallback(
    `GET /reports/${type}?format=csv`,
    async () => {
      const res = await api.get<string>(`/reports/${type}`, {
        params: { format: 'csv' },
        responseType: 'text',
      });
      return res.data;
    },
    () => mockReportCsv,
  );
}

export async function getSettings(): Promise<Settings> {
  return withMockFallback(
    'GET /settings',
    () => unwrap(api.get<ApiResult<Settings>>('/settings')),
    () => mockSettings,
  );
}

/** Mutation: no mock fallback. */
export async function updateSettings(input: Partial<Settings>): Promise<Settings> {
  return unwrap(api.put<ApiResult<Settings>>('/settings', input));
}
