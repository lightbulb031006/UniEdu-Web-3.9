/**
 * Costs Service (Frontend)
 * API calls for costs operations
 */

import api from './api';

export interface Cost {
  id: string;
  month: string; // Format: YYYY-MM
  category: string;
  amount: number;
  date?: string;
  status?: 'paid' | 'pending';
  created_at?: string;
  updated_at?: string;
}

export interface CostFilters {
  month?: string; // Format: YYYY-MM
}

export interface CostFormData {
  date: string;
  category: string;
  amount: number;
  status: 'paid' | 'pending';
}

/**
 * Normalize cost data from API response
 */
function normalizeCost(cost: any): Cost {
  return {
    id: cost.id,
    month: cost.month || (cost.date ? cost.date.slice(0, 7) : ''),
    category: cost.category || '',
    amount: cost.amount || 0,
    date: cost.date || cost.month ? `${cost.month}-01` : undefined,
    status: cost.status || 'paid',
    created_at: cost.created_at,
    updated_at: cost.updated_at,
  };
}

/**
 * Fetch all costs with optional filters
 */
export async function fetchCosts(filters: CostFilters = {}): Promise<Cost[]> {
  const params = new URLSearchParams();
  if (filters.month) {
    params.append('month', filters.month);
  }

  const response = await api.get<Cost[]>(`/costs?${params.toString()}`);
  return (response.data || []).map(normalizeCost);
}

/**
 * Fetch a single cost by ID
 */
export async function fetchCostById(id: string): Promise<Cost> {
  const response = await api.get<Cost>(`/costs/${id}`);
  return normalizeCost(response.data);
}

/**
 * Create a new cost
 */
export async function createCost(data: CostFormData): Promise<Cost> {
  const month = data.date.slice(0, 7);
  const payload = {
    month,
    category: data.category,
    amount: data.amount,
    date: data.date,
    status: data.status,
  };

  const response = await api.post<Cost>('/costs', payload);
  return normalizeCost(response.data);
}

/**
 * Update an existing cost
 */
export async function updateCost(id: string, data: Partial<CostFormData>): Promise<Cost> {
  const payload: any = { ...data };
  if (data.date) {
    payload.month = data.date.slice(0, 7);
  }

  const response = await api.put<Cost>(`/costs/${id}`, payload);
  return normalizeCost(response.data);
}

/**
 * Delete a cost
 */
export async function deleteCost(id: string): Promise<void> {
  await api.delete(`/costs/${id}`);
}

