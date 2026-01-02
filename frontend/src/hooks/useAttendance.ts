/**
 * useAttendance Hook
 * Manages attendance state and provides toggle functionality
 */

import { useState, useCallback } from 'react';
import { AttendanceStatus } from '../services/attendanceService';

export interface AttendanceRecord {
  status: AttendanceStatus;
  remark: string;
}

export interface AttendanceState {
  [studentId: string]: AttendanceRecord;
}

/**
 * Toggle attendance status in cycle: present → excused → absent → present
 */
export function getNextAttendanceStatus(currentStatus: AttendanceStatus): AttendanceStatus {
  switch (currentStatus) {
    case 'present':
      return 'excused';
    case 'excused':
      return 'absent';
    case 'absent':
      return 'present';
    default:
      return 'present';
  }
}

/**
 * Hook to manage attendance state
 */
export function useAttendance(initialState: AttendanceState = {}) {
  const [attendance, setAttendance] = useState<AttendanceState>(initialState);

  const toggleAttendance = useCallback((studentId: string) => {
    setAttendance((prev) => {
      const current = prev[studentId] || { status: 'present' as AttendanceStatus, remark: '' };
      const nextStatus = getNextAttendanceStatus(current.status);
      return {
        ...prev,
        [studentId]: {
          status: nextStatus,
          remark: current.remark,
        },
      };
    });
  }, []);

  const updateAttendance = useCallback((studentId: string, record: Partial<AttendanceRecord>) => {
    setAttendance((prev) => ({
      ...prev,
      [studentId]: {
        status: record.status ?? prev[studentId]?.status ?? 'present',
        remark: record.remark ?? prev[studentId]?.remark ?? '',
      },
    }));
  }, []);

  const setAttendanceForStudent = useCallback((studentId: string, status: AttendanceStatus, remark: string = '') => {
    setAttendance((prev) => ({
      ...prev,
      [studentId]: { status, remark },
    }));
  }, []);

  const getAttendanceSummary = useCallback(() => {
    const summary = {
      present: 0,
      excused: 0,
      absent: 0,
      total: Object.keys(attendance).length,
    };

    Object.values(attendance).forEach((record) => {
      switch (record.status) {
        case 'present':
          summary.present++;
          break;
        case 'excused':
          summary.excused++;
          break;
        case 'absent':
          summary.absent++;
          break;
      }
    });

    // Count students with remaining sessions who should be counted for allowance
    // present + excused = students eligible for allowance
    summary.total = summary.present + summary.excused + summary.absent;

    return summary;
  }, [attendance]);

  const getEligibleCount = useCallback(() => {
    // Students with status 'present' or 'excused' are eligible for allowance
    return Object.values(attendance).filter(
      (record) => record.status === 'present' || record.status === 'excused'
    ).length;
  }, [attendance]);

  return {
    attendance,
    setAttendance,
    toggleAttendance,
    updateAttendance,
    setAttendanceForStudent,
    getAttendanceSummary,
    getEligibleCount,
  };
}

