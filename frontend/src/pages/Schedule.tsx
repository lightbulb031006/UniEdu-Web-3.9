import React, { useState, useMemo, useCallback } from 'react';
import { useDataLoading } from '../hooks/useDataLoading';
import { fetchClasses } from '../services/classesService';
import { fetchTeachers } from '../services/teachersService';
import { fetchSessions, Session } from '../services/sessionsService';

/**
 * Schedule Page Component
 * Migrated from backup/assets/js/pages/schedule.js
 * UI giống hệt app cũ với weekly calendar view
 */

function getWeekDates(date: Date): Date[] {
  const dates: Date[] = [];
  const current = new Date(date);
  const weekStart = current.getDate() - current.getDay();

  for (let i = 0; i < 7; i++) {
    const day = new Date(current);
    day.setDate(weekStart + i);
    dates.push(day);
  }

  return dates;
}

function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatTime(time?: string): string {
  if (!time) return '';
  // Handle both "HH:MM:SS" and "HH:MM" formats
  return time.slice(0, 5);
}

function Schedule() {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');

  const { data: classesData } = useDataLoading(() => fetchClasses(), [], {
    cacheKey: 'classes-for-schedule',
    staleTime: 5 * 60 * 1000,
  });

  const { data: teachersData } = useDataLoading(() => fetchTeachers(), [], {
    cacheKey: 'teachers-for-schedule',
    staleTime: 5 * 60 * 1000,
  });

  // Ensure all data are arrays
  const classes = Array.isArray(classesData) ? classesData : [];
  const teachers = Array.isArray(teachersData) ? teachersData : [];

  const weekDates = useMemo(() => getWeekDates(currentWeek), [currentWeek]);
  const startDate = weekDates[0];
  const endDate = weekDates[6];

  const fetchSessionsFn = useCallback(
    () =>
      fetchSessions({
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        classId: selectedClassId || undefined,
        teacherId: selectedTeacherId || undefined,
      }),
    [startDate, endDate, selectedClassId, selectedTeacherId]
  );

  const { data: sessionsData, isLoading: sessionsLoading } = useDataLoading(fetchSessionsFn, [startDate, endDate, selectedClassId, selectedTeacherId], {
    cacheKey: `sessions-${formatDate(startDate)}-${formatDate(endDate)}-${selectedClassId}-${selectedTeacherId}`,
    staleTime: 1 * 60 * 1000,
  });

  // Ensure sessions is always an array
  const sessions = Array.isArray(sessionsData) ? sessionsData : [];

  const getSessionsForDate = (date: Date): Session[] => {
    const dateStr = formatDate(date);
    return sessions.filter((s) => s.date === dateStr);
  };

  const handlePrevWeek = () => {
    const newDate = new Date(currentWeek);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentWeek(newDate);
  };

  const handleNextWeek = () => {
    const newDate = new Date(currentWeek);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentWeek(newDate);
  };

  const handleToday = () => {
    setCurrentWeek(new Date());
  };

  const getSessionStatus = (session: Session): 'scheduled' | 'cancelled' | 'makeup' => {
    // Determine status based on payment_status or other indicators
    if (session.payment_status === 'paid') {
      return 'scheduled';
    }
    // You can add more logic here based on notes or other fields
    return 'scheduled';
  };

  return (
    <div className="page-container" style={{ padding: 'var(--spacing-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-4)' }}>
        <h2 style={{ margin: 0 }}>Lịch học</h2>
        <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
          <select
            className="form-control"
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            style={{ minWidth: '150px' }}
          >
            <option value="">Tất cả lớp</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
          <select
            className="form-control"
            value={selectedTeacherId}
            onChange={(e) => setSelectedTeacherId(e.target.value)}
            style={{ minWidth: '150px' }}
          >
            <option value="">Tất cả giáo viên</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.fullName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Week Navigation */}
      <div className="card" style={{ marginBottom: 'var(--spacing-4)', padding: 'var(--spacing-4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button className="btn btn-secondary" onClick={handlePrevWeek}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Tuần trước
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-4)' }}>
            <span style={{ fontWeight: '600', color: 'var(--text)' }}>
              {weekDates[0].toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' })} -{' '}
              {weekDates[6].toLocaleDateString('vi-VN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <button className="btn btn-primary" onClick={handleToday}>
              Hôm nay
            </button>
          </div>
          <button className="btn btn-secondary" onClick={handleNextWeek}>
            Tuần sau
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Schedule Grid */}
      {sessionsLoading ? (
        <div className="card" style={{ padding: 'var(--spacing-8)', textAlign: 'center' }}>
          <div className="spinner" />
          <p className="text-muted" style={{ marginTop: 'var(--spacing-3)' }}>Đang tải lịch học...</p>
        </div>
      ) : (
        <div
          className="schedule-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 'var(--spacing-3)',
          }}
        >
          {weekDates.map((date, index) => {
            const daySessions = getSessionsForDate(date);
            const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
            const isCurrentDay = isToday(date);

            return (
              <div
                key={index}
                className={`schedule-day ${isCurrentDay ? 'current-day' : ''}`}
                style={{
                  border: `1px solid ${isCurrentDay ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius)',
                  padding: 'var(--spacing-3)',
                  background: isCurrentDay ? 'rgba(59, 130, 246, 0.05)' : 'var(--bg)',
                  minHeight: '200px',
                }}
              >
                <div
                  className="day-header"
                  style={{
                    marginBottom: 'var(--spacing-3)',
                    paddingBottom: 'var(--spacing-2)',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--muted)', marginBottom: 'var(--spacing-1)' }}>
                    {dayNames[date.getDay()]}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: '700', color: 'var(--text)' }}>
                    {date.getDate()}
                  </div>
                </div>
                <div className="schedule-items" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
                  {daySessions.length === 0 ? (
                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--muted)', textAlign: 'center' }}>
                      Không có lớp
                    </div>
                  ) : (
                    daySessions.map((session) => {
                      const cls = classes.find((c) => c.id === session.class_id);
                      const teacher = teachers.find((t) => t.id === session.teacher_id);
                      const status = getSessionStatus(session);
                      const timeDisplay =
                        session.start_time && session.end_time
                          ? `${formatTime(session.start_time)} - ${formatTime(session.end_time)}`
                          : session.start_time
                          ? formatTime(session.start_time)
                          : '';

                      return (
                        <div
                          key={session.id}
                          className="schedule-item"
                          style={{
                            padding: 'var(--spacing-2)',
                            borderRadius: 'var(--radius)',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border)',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--bg-hover)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'var(--bg-secondary)';
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-1)' }}>
                            <div style={{ fontWeight: '500', fontSize: 'var(--font-size-sm)', color: 'var(--text)' }}>
                              {cls?.name || '-'}
                            </div>
                            <span
                              className={`badge ${
                                status === 'scheduled' ? 'badge-success' : status === 'makeup' ? 'badge-warning' : 'badge-danger'
                              }`}
                              style={{
                                padding: '2px 6px',
                                borderRadius: 'var(--radius)',
                                fontSize: '10px',
                                fontWeight: '500',
                              }}
                            >
                              {status === 'scheduled' ? 'Đã lên lịch' : status === 'makeup' ? 'Bù' : 'Hủy'}
                            </span>
                          </div>
                          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--muted)' }}>
                            {teacher?.fullName || 'Chưa có giáo viên'}
                          </div>
                          {timeDisplay && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--muted)' }}>{timeDisplay}</div>}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Schedule;
