/**
 * Bonuses Service (Frontend)
 * API calls for bonuses operations
 */

import api from './api';

export interface Bonus {
  id: string;
  staff_id: string;
  work_type: string;
  amount: number;
  status: 'paid' | 'unpaid' | 'deposit';
  note?: string;
  month: string;
  created_at?: string;
  updated_at?: string;
}

export interface BonusFilters {
  staffId?: string;
  month?: string;
  status?: 'paid' | 'unpaid' | 'deposit';
}

/**
 * Get all bonuses with optional filters
 */
export async function fetchBonuses(filters?: BonusFilters): Promise<Bonus[]> {
  const params = new URLSearchParams();
  if (filters?.staffId) params.append('staffId', filters.staffId);
  if (filters?.month) params.append('month', filters.month);
  if (filters?.status) params.append('status', filters.status);

  const response = await api.get<Bonus[]>(`/bonuses?${params.toString()}`);
  return response.data || [];
}

/**
 * Get bonus by ID
 */
export async function fetchBonusById(id: string): Promise<Bonus> {
  const response = await api.get<Bonus>(`/bonuses/${id}`);
  return response.data;
}

/**
 * Create new bonus
 */
export async function createBonus(bonusData: Omit<Bonus, 'id' | 'created_at' | 'updated_at'>): Promise<Bonus> {
  const response = await api.post<Bonus>('/bonuses', bonusData);
  return response.data;
}

/**
 * Update bonus
 */
export async function updateBonus(id: string, bonusData: Partial<Bonus>): Promise<Bonus> {
  const response = await api.put<Bonus>(`/bonuses/${id}`, bonusData);
  return response.data;
}

/**
 * Delete bonus
 */
export async function deleteBonus(id: string): Promise<void> {
  await api.delete(`/bonuses/${id}`);
}

