/**
 * Dashboard Service
 * API calls for dashboard data
 */

import api from './api';

export interface DashboardData {
  summary: {
    totalClasses: number;
    activeClasses: number;
    totalStudents: number;
    activeStudents: number;
    totalTeachers: number;
    revenue: number;
    uncollected: number;
  };
  financeReport: {
    rows: Array<{
      key: string;
      label: string;
      amount: number;
      note?: string;
      breakdown?: Record<string, number>;
    }>;
  };
  charts: {
    revenueProfitLine: Array<{
      label: string;
      displayLabel: string;
      revenue: number;
      profit: number;
    }>;
  };
  expiringStudents: Array<{
    id: string;
    studentId: string;
    studentName: string;
    className: string;
    remaining: number;
  }>;
  pendingStaffPayouts: Array<{
    staffId: string;
    staffName: string;
    workType: string;
    totalAllowance: number;
    detail: string;
  }>;
  alerts?: {
    studentsNeedRenewal: Array<{
      id: string;
      studentId: string;
      studentName: string;
      className: string;
      remaining: number;
    }>;
    pendingStaffPayouts: Array<{
      staffId: string;
      staffName: string;
      workType: string;
      totalAllowance: number;
      detail: string;
    }>;
    classesWithoutSurvey: {
      maxTestNumber: number;
      classes: Array<{
        id: string;
        name: string;
        teachers: Array<{
          id: string;
          fullName: string;
        }>;
      }>;
    };
    financeRequests: {
      loans: Array<{
        name: string;
        amount: number;
      }>;
      refunds: Array<{
        id: string;
        studentId: string;
        amount: number;
      }>;
    };
  };
}

export interface DashboardParams {
  filterType: 'month' | 'quarter' | 'year';
  filterValue: string;
}

/**
 * Fetch dashboard data
 */
export async function fetchDashboardData(params: DashboardParams): Promise<DashboardData> {
  const response = await api.get<DashboardData>('/dashboard', { params });
  return response.data;
}

/**
 * Fetch quick view data for a specific year
 */
export async function fetchQuickViewData(year: string) {
  const response = await api.get('/dashboard/quick-view', { params: { year } });
  return response.data;
}

