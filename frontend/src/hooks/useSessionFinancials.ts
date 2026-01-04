/**
 * useSessionFinancials Hook
 * Calculates tuition fees and teacher allowances based on attendance status
 */

import { useMemo } from 'react';
import { AttendanceStatus } from '../services/attendanceService';

interface Student {
  id: string;
  remainingSessions?: number;
  tuitionPerSession?: number;
  wallet_balance?: number;
  walletBalance?: number;
}

interface AttendanceState {
  [studentId: string]: {
    status: AttendanceStatus;
    remark?: string;
  };
}

interface ClassData {
  tuitionPerSession?: number;
  scaleAmount?: number;
  maxAllowancePerSession?: number;
  customTeacherAllowances?: Record<string, number>;
}

/**
 * Calculate weighted count for teacher allowance
 * Present = 1, Excused = 1
 */
export function calculateWeightedCount(
  students: Student[],
  attendance: AttendanceState
): number {
  let weightedCount = 0;
  students.forEach((student) => {
    const att = attendance[student.id];
    const hasRemaining = (student.remainingSessions || 0) > 0;
    if (hasRemaining) {
      if (att?.status === 'present') {
        weightedCount += 1;
      } else if (att?.status === 'excused') {
        weightedCount += 1;
      }
    }
  });
  return weightedCount;
}

/**
 * Calculate estimated tuition fee based on attendance
 * Sum of tuition per session for students with status 'present' or 'excused'
 */
export function calculateEstimatedTuitionFee(
  students: Student[],
  attendance: AttendanceState
): number {
  let total = 0;
  students.forEach((student) => {
    const att = attendance[student.id];
    const isEligible = att?.status === 'present' || att?.status === 'excused';
    if (isEligible) {
      const studentTuition = student.tuitionPerSession || 0;
      total += studentTuition;
    }
  });
  return total;
}

/**
 * Calculate teacher allowance based on weighted count
 */
export function calculateAllowance(
  teacherId: string,
  coefficient: number,
  weightedCount: number,
  classData: ClassData
): number {
  if (!teacherId || coefficient === 0 || weightedCount === 0) return 0;

  const customAllowances = classData?.customTeacherAllowances || {};
  const baseAllowance = customAllowances[teacherId] ?? (classData?.tuitionPerSession || 0);
  const scaleAmount = classData?.scaleAmount || 0;
  const maxPerSession = classData?.maxAllowancePerSession || 0;
  
  let allowance = baseAllowance * coefficient * weightedCount + scaleAmount;
  if (maxPerSession > 0 && allowance > maxPerSession) {
    allowance = maxPerSession;
  }
  
  return Math.round(allowance > 0 ? allowance : 0);
}

/**
 * Format currency for display
 */
function formatCurrencyVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount);
}

/**
 * Hook to calculate session financials (tuition fees and allowances)
 */
export function useSessionFinancials(
  students: Student[],
  attendance: AttendanceState,
  teacherId: string,
  coefficient: number,
  classData: ClassData
) {
  // Calculate weighted count for allowance (present = 1, excused = 1)
  const weightedCount = useMemo(() => {
    return calculateWeightedCount(students, attendance);
  }, [students, attendance]);

  // Calculate estimated tuition fee
  const estimatedTuitionFee = useMemo(() => {
    return calculateEstimatedTuitionFee(students, attendance);
  }, [students, attendance]);

  // Calculate allowance preview
  const allowancePreview = useMemo(() => {
    return calculateAllowance(teacherId, coefficient, weightedCount, classData);
  }, [teacherId, coefficient, weightedCount, classData]);

  // Calculate present and excused counts for formula display
  const presentCount = useMemo(() => {
    return students.filter((s) => {
      const att = attendance[s.id];
      const hasRemaining = (s.remainingSessions || 0) > 0;
      return att?.status === 'present' && hasRemaining;
    }).length;
  }, [students, attendance]);

  const excusedCount = useMemo(() => {
    return students.filter((s) => {
      const att = attendance[s.id];
      const hasRemaining = (s.remainingSessions || 0) > 0;
      return att?.status === 'excused' && hasRemaining;
    }).length;
  }, [students, attendance]);

  // Format allowance formula for display
  const allowanceFormula = useMemo(() => {
    if (!teacherId || coefficient === 0 || weightedCount === 0) {
      return null;
    }
    
    const customAllowances = classData?.customTeacherAllowances || {};
    const baseAllowance = customAllowances[teacherId] ?? (classData?.tuitionPerSession || 0);
    const scaleAmount = classData?.scaleAmount || 0;
    const maxPerSession = classData?.maxAllowancePerSession || 0;
    
    const weightedCountStr = weightedCount % 1 === 0 ? weightedCount.toString() : weightedCount.toFixed(1);
    const baseAllowanceStr = formatCurrencyVND(baseAllowance);
    const scaleAmountStr = scaleAmount > 0 ? ` + ${formatCurrencyVND(scaleAmount)}` : '';
    
    // Calculate the full amount before applying max
    const calculatedAmount = baseAllowance * coefficient * weightedCount + scaleAmount;
    const calculatedAmountStr = formatCurrencyVND(Math.round(calculatedAmount));
    
    // Build allowance formula string
    let allowanceFormulaStr = `(${baseAllowanceStr} × ${coefficient} × ${weightedCountStr})${scaleAmountStr} = ${calculatedAmountStr}`;
    
    // If max is applied, show it clearly
    if (maxPerSession > 0 && calculatedAmount > maxPerSession) {
      allowanceFormulaStr += ` → min(${calculatedAmountStr}, ${formatCurrencyVND(maxPerSession)}) = ${formatCurrencyVND(allowancePreview)}`;
    } else if (calculatedAmount !== allowancePreview) {
      // Fallback: if values don't match, show both
      allowanceFormulaStr += ` = ${formatCurrencyVND(allowancePreview)}`;
    }
    
    return {
      weightedFormula: presentCount > 0 && excusedCount > 0
        ? `${presentCount} × 1 + ${excusedCount} × 1 = ${weightedCountStr}`
        : presentCount > 0
        ? `${presentCount} × 1 = ${weightedCountStr}`
        : excusedCount > 0
        ? `${excusedCount} × 1 = ${weightedCountStr}`
        : '0',
      allowanceFormula: allowanceFormulaStr,
    };
  }, [teacherId, coefficient, weightedCount, presentCount, excusedCount, classData, allowancePreview]);

  return {
    weightedCount,
    estimatedTuitionFee,
    allowancePreview,
    allowanceFormula,
  };
}

