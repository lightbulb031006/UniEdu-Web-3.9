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
 * Returns: { bonuses: Bonus[], statistics: { totalMonth, paid, unpaid } }
 */
export interface BonusesResponse {
  bonuses: any[];
  statistics: {
    totalMonth: number;
    paid: number;
    unpaid: number;
  };
}

export async function fetchStaffBonuses(staffId: string, month: string): Promise<BonusesResponse> {
  const response = await api.get<BonusesResponse>(`/staff/${staffId}/bonuses?month=${month}`);
  return response.data || { bonuses: [], statistics: { totalMonth: 0, paid: 0, unpaid: 0 } };
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
 * Returns { totals: Record<id, number>, breakdown: Record<id, { classesAndWork, bonuses, total }> }
 */
export async function getStaffUnpaidAmounts(staffIds: string[]): Promise<{ totals: Record<string, number>; breakdown: Record<string, { classesAndWork: number; bonuses: number; total: number }> }> {
  const response = await api.post('/staff/unpaid-amounts', { staffIds });
  // Handle both new format { totals, breakdown } and old format Record<string, number>
  if (response.data && response.data.totals) {
    return response.data;
  }
  // Backward compatibility: old format is just Record<string, number>
  return { totals: response.data || {}, breakdown: {} };
}

/**
 * Get CSKH detail data with all calculations done in backend
 */
export interface CSKHDetailData {
  students: Array<{
    student: {
      id: string;
      fullName: string;
      birthYear?: number;
      province?: string;
      classIds: string[];
    };
    totalPaid: number;
    profitPercent: number;
    profit: number;
    paymentStatus: 'paid' | 'unpaid' | 'deposit';
  }>;
  defaultProfitPercent: number;
  totals: {
    totalUnpaidProfit: number;
    totalPaidProfit: number;
    totalPaidAll: number;
    totalProfitAll: number;
  };
}

export async function fetchCSKHDetailData(staffId: string, month: string): Promise<CSKHDetailData> {
  const response = await api.get<CSKHDetailData>(`/staff/${staffId}/cskh/detail?month=${month}`);
  return response.data;
}

/**
 * Get staff detail data with all calculations done in backend (for teachers)
 */
export interface StaffDetailData {
  teacherClassStats: Array<{
    class: {
      id: string;
      name: string;
      status: string;
    };
    totalMonth: number;
    totalPaid: number;
    totalUnpaid: number;
    monthSessionsCount: number;
    isActive: boolean;
  }>;
  incomeStats: {
    totalMonthAllClasses: number;
    totalPaidByStatus: number;
    totalUnpaidByStatus: number;
    totalPaidAllTime: number;
    totalDepositAllTime: number;
  };
  sessionStats: {
    total: number;
    paid: number;
    unpaid: number;
    totalAllowance: number;
    paidAllowance: number;
  };
}

export async function fetchStaffDetailData(staffId: string, month: string): Promise<StaffDetailData> {
  const response = await api.get<StaffDetailData>(`/staff/${staffId}/detail-data?month=${month}`);
  return response.data;
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
