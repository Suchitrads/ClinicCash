import type { ForecastResponse, ForecastScenarioParams, GapAction, ReportData, ReportType, Settings, Alert } from '../types';
import { api, unwrap } from './api';
import type { ApiResult } from '../types';

export async function getForecast(horizonDays: number): Promise<ForecastResponse> {
  return unwrap(api.get<ApiResult<ForecastResponse>>('/forecast', { params: { horizon: horizonDays } }));
}

export async function postForecastScenario(params: ForecastScenarioParams): Promise<ForecastResponse> {
  return unwrap(api.post<ApiResult<ForecastResponse>>('/forecast/scenario', params));
}

export async function getGapActions(): Promise<GapAction[]> {
  return unwrap(api.get<ApiResult<GapAction[]>>('/gap-closer/actions'));
}

export async function executeGapAction(id: string): Promise<GapAction> {
  return unwrap(api.post<ApiResult<GapAction>>(`/gap-closer/actions/${id}/execute`));
}

export async function getAlerts(): Promise<Alert[]> {
  return unwrap(api.get<ApiResult<Alert[]>>('/alerts'));
}

export async function getReports(type: ReportType): Promise<ReportData> {
  return unwrap(api.get<ApiResult<ReportData>>(`/reports/${type}`));
}

export async function exportReportCsv(type: ReportType): Promise<string> {
  const res = await api.get<string>(`/reports/${type}`, {
    params: { format: 'csv' },
    responseType: 'text',
  });
  return res.data;
}

export async function getSettings(): Promise<Settings> {
  return unwrap(api.get<ApiResult<Settings>>('/settings'));
}

export async function updateSettings(input: Partial<Settings>): Promise<Settings> {
  return unwrap(api.put<ApiResult<Settings>>('/settings', input));
}
