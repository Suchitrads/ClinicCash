import type { ApiResult, Bill } from '../types';
import { api, unwrap, withMockFallback } from './api';
import { mockBills } from './mocks/bills';

export type BillInput = Omit<Bill, 'id'>;
export type BillUpdate = Partial<Omit<Bill, 'id'>>;

export async function listBills(): Promise<Bill[]> {
  return withMockFallback(
    'GET /bills',
    () => unwrap(api.get<ApiResult<Bill[]>>('/bills')),
    () => mockBills,
  );
}

/** Mutation: no mock fallback. */
export async function createBill(input: BillInput): Promise<Bill> {
  return unwrap(api.post<ApiResult<Bill>>('/bills', input));
}

/** Mutation: no mock fallback. */
export async function updateBill(id: string, input: BillUpdate): Promise<Bill> {
  return unwrap(api.put<ApiResult<Bill>>(`/bills/${id}`, input));
}
