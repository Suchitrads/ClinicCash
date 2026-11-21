import type { ApiResult, Bill, BillFundingChain } from '../types';
import { api, unwrap } from './api';

export type BillInput = Omit<Bill, 'id'>;
export type BillUpdate = Partial<Omit<Bill, 'id'>>;

export async function listBills(): Promise<Bill[]> {
  return unwrap(api.get<ApiResult<Bill[]>>('/bills'));
}

export async function getBillFundingChain(): Promise<BillFundingChain[]> {
  return unwrap(api.get<ApiResult<BillFundingChain[]>>('/bills/funding-chain'));
}

export async function createBill(input: BillInput): Promise<Bill> {
  return unwrap(api.post<ApiResult<Bill>>('/bills', input));
}

export async function updateBill(id: string, input: BillUpdate): Promise<Bill> {
  return unwrap(api.put<ApiResult<Bill>>(`/bills/${id}`, input));
}

export async function deleteBill(id: string): Promise<void> {
  await api.delete(`/bills/${id}`);
}
