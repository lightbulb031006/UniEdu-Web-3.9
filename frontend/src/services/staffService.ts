/**
 * Staff Service (Frontend)
 * API calls for staff-related operations
 */

import api from './api';

export interface WorkItem {
  name: string;
  type: string;
  unpaid: number;
  paid: number;
  total: number;
  pageUrl?: string;
}

/**
 * Get work items for a staff member
 */
export async function fetchStaffWorkItems(staffId: string, month: string): Promise<WorkItem[]> {
  const response = await api.get<WorkItem[]>(`/staff/${staffId}/work-items?month=${month}`);
  return response.data || [];
}

/**
 * Get bonuses for a staff member
 */
export async function fetchStaffBonuses(staffId: string, month: string) {
  const response = await api.get(`/staff/${staffId}/bonuses?month=${month}`);
  return response.data || [];
}

/**
 * Get unpaid amount for a specific staff member
 */
export async function getStaffUnpaidAmount(staffId: string): Promise<number> {
  const response = await api.get(`/staff/${staffId}/unpaid`);
  return response.data?.unpaidAmount || 0;
}

/**
 * Get unpaid amounts for multiple staff members
 */
export async function getStaffUnpaidAmounts(staffIds: string[]): Promise<Record<string, number>> {
  const response = await api.post('/staff/unpaid-amounts', { staffIds });
  return response.data || {};
}

/**
 * Update staff QR payment link
 */
export async function updateStaffQrPaymentLink(staffId: string, qrLink: string): Promise<void> {
  await api.put(`/staff/${staffId}/qr-payment-link`, { qrLink });
}

/**
 * Get staff login info (account handle and password hash)
 */
export async function getStaffLoginInfo(staffId: string): Promise<{
  accountHandle: string | null;
  hasPassword: boolean;
  password: string | null;
} | null> {
  const response = await api.get(`/staff/${staffId}/login-info`);
  return response.data;
}
