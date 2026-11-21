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
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

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
    }
    return Promise.reject(new ApiError(message, status));
  },
);

/** Unwraps the assumed { data: T } response envelope. */
export function unwrap<T>(request: Promise<{ data: ApiResult<T> }>): Promise<T> {
  return request.then((res) => res.data.data);
}

/**
 * Runs a read request; falls back to mock data only in DEV when the endpoint
 * is unreachable (status 0) or missing (404). Mutations must not use this.
 */
export async function withMockFallback<T>(
  endpoint: string,
  request: () => Promise<T>,
  mock: () => T,
): Promise<T> {
  try {
    return await request();
  } catch (err) {
    if (
      import.meta.env.DEV &&
      err instanceof ApiError &&
      (err.status === 0 || err.status === 404)
    ) {
      console.warn(`[mock] ${endpoint} unavailable, using mock data`);
      return mock();
    }
    throw err;
  }
}
