/*
 * ASSUMED API CONTRACT — not yet confirmed against the backend
 *
 * Base URL: VITE_API_BASE_URL (default http://localhost:8000/api/v1)
 * Success bodies are assumed to be wrapped as { data: T } (ApiResult<T>).
 *
 * GET    /dashboard/summary
 * GET    /invoices                        (query: search, payer, status, sortBy, sortDir)
 * GET    /invoices/{id}
 * POST   /invoices
 * PUT    /invoices/{id}
 * DELETE /invoices/{id}
 * POST   /invoices/{id}/payments
 * POST   /invoices/{id}/mark-paid
 * POST   /invoices/{id}/promise-to-pay
 * POST   /invoices/{id}/payment-plans
 * GET    /payment-plans
 * GET    /bills
 * POST   /bills
 * PUT    /bills/{id}
 * GET    /forecast                        (query: horizon)
 * POST   /forecast/scenario
 * GET    /gap-closer/actions
 * POST   /gap-closer/actions/{id}/execute
 * GET    /reminders
 * POST   /reminders/generate
 * GET    /alerts
 * GET    /reports/{type}                  (query: format=csv for CSV export)
 * GET    /settings
 * PUT    /settings
 */
import axios, { type AxiosError } from 'axios';
import type { ApiResult } from '../types';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1',
  timeout: 15000,
});

interface ErrorBody {
  detail?: unknown;
  message?: unknown;
  error?: {
    code?: string;
    message?: string;
    details?: Array<{ msg?: string; loc?: string[] }>;
  };
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = window.localStorage.getItem('cliniccash.token');
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ErrorBody>) => {
    const status = error.response?.status ?? 0;
    const body = error.response?.data;
    let message = error.message;
    if (!error.response) {
      message = 'Backend not connected yet. This change was not saved.';
    } else if (typeof body?.detail === 'string') {
      message = body.detail;
    } else if (typeof body?.message === 'string') {
      message = body.message;
    } else if (body?.error && typeof body.error === 'object') {
      const errObj = body.error;
      if (typeof errObj.message === 'string') {
        if (Array.isArray(errObj.details) && errObj.details.length > 0) {
          const detailMsgs = errObj.details
            .map((d) => {
              const loc = Array.isArray(d.loc)
                ? d.loc.filter((x: any) => x !== 'body').join('.')
                : '';
              return loc ? `${loc}: ${d.msg}` : d.msg;
            })
            .filter(Boolean)
            .join('; ');
          message = detailMsgs ? `${errObj.message} (${detailMsgs})` : errObj.message;
        } else {
          message = errObj.message;
        }
      }
    }
    if (status === 401 && typeof window !== 'undefined') {
      window.localStorage.removeItem('cliniccash.token');
    }
    return Promise.reject(new ApiError(message, status));
  },
);

/** Unwraps the assumed { data: T } response envelope. */
export function unwrap<T>(request: Promise<{ data: ApiResult<T> }>): Promise<T> {
  return request.then((res) => res.data.data);
}
