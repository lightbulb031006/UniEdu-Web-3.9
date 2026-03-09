/**
 * Staff Monthly Stats Service
 * Service for managing cached staff monthly statistics
 */

import supabase from '../config/database';

export interface StaffMonthlyStats {
  id: string;
  staff_id: string;
  month: string;
  classes_total_month: number;
  classes_total_paid: number;
  classes_total_unpaid: number;
  work_items_total_month: number;
  work_items_total_paid: number;
  work_items_total_unpaid: number;
  bonuses_total_month: number;
  bonuses_total_paid: number;
  bonuses_total_unpaid: number;
  total_month_all: number;
  total_paid_all: number;
  total_unpaid_all: number;
  total_paid_all_time: number;
  calculated_at: string;
  last_updated_at: string;
  version: number;
}

// Current version - increment this when calculation logic changes
const CURRENT_VERSION = 1;

/**
 * Get cached staff monthly stats
 */
export async function getStaffMonthlyStats(
  staffId: string,
  month: string
): Promise<StaffMonthlyStats | null> {
  const { data, error } = await supabase
    .from('staff_monthly_stats')
    .select('*')
    .eq('staff_id', staffId)
    .eq('month', month)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch staff monthly stats:', error);
    return null;
  }

  // Check if cache is valid (version matches)
  if (data && data.version < CURRENT_VERSION) {
    // Cache is outdated, return null to trigger recalculation
    return null;
  }

  return data;
}

/**
 * Save/update staff monthly stats to cache
 */
export async function saveStaffMonthlyStats(
  staffId: string,
  month: string,
  stats: {
    classes_total_month?: number;
    classes_total_paid?: number;
    classes_total_unpaid?: number;
    work_items_total_month?: number;
    work_items_total_paid?: number;
    work_items_total_unpaid?: number;
    bonuses_total_month?: number;
    bonuses_total_paid?: number;
    bonuses_total_unpaid?: number;
    total_month_all?: number;
    total_paid_all?: number;
    total_unpaid_all?: number;
    total_paid_all_time?: number;
  }
): Promise<void> {
  const id = `SMS${staffId}-${month}`;
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('staff_monthly_stats')
    .upsert({
      id,
      staff_id: staffId,
      month,
      classes_total_month: stats.classes_total_month ?? 0,
      classes_total_paid: stats.classes_total_paid ?? 0,
      classes_total_unpaid: stats.classes_total_unpaid ?? 0,
      work_items_total_month: stats.work_items_total_month ?? 0,
      work_items_total_paid: stats.work_items_total_paid ?? 0,
      work_items_total_unpaid: stats.work_items_total_unpaid ?? 0,
      bonuses_total_month: stats.bonuses_total_month ?? 0,
      bonuses_total_paid: stats.bonuses_total_paid ?? 0,
      bonuses_total_unpaid: stats.bonuses_total_unpaid ?? 0,
      total_month_all: stats.total_month_all ?? 0,
      total_paid_all: stats.total_paid_all ?? 0,
      total_unpaid_all: stats.total_unpaid_all ?? 0,
      total_paid_all_time: stats.total_paid_all_time ?? 0,
      calculated_at: now,
      last_updated_at: now,
      version: CURRENT_VERSION,
    });

  if (error) {
    console.error('Failed to save staff monthly stats:', error);
    throw new Error(`Failed to save staff monthly stats: ${error.message}`);
  }
}

/**
 * Invalidate cache for a specific staff and month
 * This should be called when data changes (sessions, bonuses, work items, etc.)
 */
export async function invalidateStaffMonthlyStats(
  staffId: string,
  month: string
): Promise<void> {
  const { error } = await supabase
    .from('staff_monthly_stats')
    .delete()
    .eq('staff_id', staffId)
    .eq('month', month);

  if (error) {
    console.error('Failed to invalidate staff monthly stats:', error);
    // Don't throw - invalidation failure shouldn't break the app
  }
}

/**
 * Invalidate cache for a staff across multiple months
 * Useful when a staff's data changes that affects multiple months
 */
export async function invalidateStaffMonthlyStatsForMonths(
  staffId: string,
  months: string[]
): Promise<void> {
  if (months.length === 0) return;

  const { error } = await supabase
    .from('staff_monthly_stats')
    .delete()
    .eq('staff_id', staffId)
    .in('month', months);

  if (error) {
    console.error('Failed to invalidate staff monthly stats for months:', error);
  }
}

/**
 * Invalidate cache for all months in a year
 * Useful when calculating total_paid_all_time changes
 */
export async function invalidateStaffMonthlyStatsForYear(
  staffId: string,
  year: number
): Promise<void> {
  const { error } = await supabase
    .from('staff_monthly_stats')
    .delete()
    .eq('staff_id', staffId)
    .like('month', `${year}-%`);

  if (error) {
    console.error('Failed to invalidate staff monthly stats for year:', error);
  }
}

/**
 * Get stats from cache or calculate if not available
 * This is a helper function that combines get and calculate logic
 */
export async function getOrCalculateStaffMonthlyStats(
  staffId: string,
  month: string,
  calculateFn: () => Promise<{
    classes_total_month: number;
    classes_total_paid: number;
    classes_total_unpaid: number;
    work_items_total_month: number;
    work_items_total_paid: number;
    work_items_total_unpaid: number;
    bonuses_total_month: number;
    bonuses_total_paid: number;
    bonuses_total_unpaid: number;
    total_month_all: number;
    total_paid_all: number;
    total_unpaid_all: number;
    total_paid_all_time: number;
  }>
): Promise<StaffMonthlyStats> {
  // Try to get from cache first
  const cached = await getStaffMonthlyStats(staffId, month);
  if (cached) {
    return cached;
  }

  // Cache miss - calculate and save
  const calculated = await calculateFn();
  await saveStaffMonthlyStats(staffId, month, calculated);

  // Return the saved stats
  const saved = await getStaffMonthlyStats(staffId, month);
  if (!saved) {
    throw new Error('Failed to retrieve saved staff monthly stats');
  }

  return saved;
}

