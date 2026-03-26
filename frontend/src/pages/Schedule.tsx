import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useDataLoading } from '../hooks/useDataLoading';
import { fetchClasses } from '../services/classesService';
import { fetchTeachers } from '../services/teachersService';
import '../assets/css/schedule.css';

/**
 * Schedule Page – Google Calendar-style weekly view
 * Displays recurring class schedules on a 7-day × hour grid.
 * Data comes from classes.schedule (recurring weekly schedule) rather than
 * individual recorded sessions. Each class has a schedule array like:
 *   [{ day: "Thứ Hai", time: "19:30-21:30" }, ...]
 */

// ───── Utilities ─────

const DAY_NAMES = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const HOUR_START = 7;   // 07:00
const HOUR_END = 22;    // 22:00
const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
const ROW_HEIGHT = 48;  // px per hour-slot

/** Map Vietnamese day names to JS getDay() values (0=Sun, 1=Mon, ...) */
const VIET_DAY_MAP: Record<string, number> = {
  'Thứ Hai': 1,
  'Thứ Ba': 2,
  'Thứ Tư': 3,
  'Thứ Năm': 4,
  'Thứ Sáu': 5,
  'Thứ Bảy': 6,
  'Chủ Nhật': 0,
  // Short forms
  'T2': 1, 'T3': 2, 'T4': 3, 'T5': 4, 'T6': 5, 'T7': 6, 'CN': 0,
};

function getWeekDates(date: Date): Date[] {
  const dates: Date[] = [];
  const current = new Date(date);
  const dayOfWeek = current.getDay(); // 0=Sun
  const weekStart = new Date(current);
  weekStart.setDate(current.getDate() - dayOfWeek + 1); // Monday first
  // Push Mon→Sun
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function isToday(date: Date): boolean {
  const t = new Date();
  return date.getDate() === t.getDate() && date.getMonth() === t.getMonth() && date.getFullYear() === t.getFullYear();
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

function formatTime(time?: string): string {
  if (!time) return '';
  return time.slice(0, 5);
}

/** Stable color index from class id */
function classColorIndex(classId: string): number {
  let hash = 0;
  for (let i = 0; i < classId.length; i++) {
    hash = classId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 8;
}

// ───── Schedule Block Type ─────

interface ScheduleBlock {
  id: string;          // unique key
  classId: string;
  className: string;
  teacherNames: string;
  startTime: string;   // "HH:MM"
  endTime: string;     // "HH:MM"
  dayIndex: number;    // 0-6 index into weekDates array (Mon=0, ..., Sun=6)
}

// ───── Collision Detection ─────

interface LayoutBlock {
  block: ScheduleBlock;
  top: number;
  height: number;
  startMins: number;
  endMins: number;
  column: number;
  totalColumns: number;
}

function layoutBlocksForDay(dayBlocks: ScheduleBlock[]): LayoutBlock[] {
  if (dayBlocks.length === 0) return [];

  const items: LayoutBlock[] = dayBlocks.map(block => {
    const startMins = timeToMinutes(block.startTime);
    const endMins = timeToMinutes(block.endTime);
    const clampedStart = Math.max(startMins, HOUR_START * 60);
    const clampedEnd = Math.min(endMins, HOUR_END * 60);
    const top = ((clampedStart - HOUR_START * 60) / 60) * ROW_HEIGHT;
    const height = Math.max(((clampedEnd - clampedStart) / 60) * ROW_HEIGHT, 22);

    return {
      block,
      top,
      height,
      startMins: clampedStart,
      endMins: clampedEnd,
      column: 0,
      totalColumns: 1,
    };
  });

  items.sort((a, b) => a.startMins - b.startMins || b.endMins - a.endMins);

  // Find overlapping groups
  const groups: LayoutBlock[][] = [];
  let currentGroup: LayoutBlock[] = [];
  let groupEnd = 0;

  for (const item of items) {
    if (item.startMins >= item.endMins) continue;
    if (currentGroup.length === 0 || item.startMins < groupEnd) {
      currentGroup.push(item);
      groupEnd = Math.max(groupEnd, item.endMins);
    } else {
      if (currentGroup.length > 0) groups.push(currentGroup);
      currentGroup = [item];
      groupEnd = item.endMins;
    }
  }
  if (currentGroup.length > 0) groups.push(currentGroup);

  // Greedy column assignment
  for (const group of groups) {
    const columns: number[][] = [];
    for (const item of group) {
      let placed = false;
      for (let col = 0; col < columns.length; col++) {
        if (item.startMins >= columns[col][columns[col].length - 1]) {
          columns[col].push(item.endMins);
          item.column = col;
          placed = true;
          break;
        }
      }
      if (!placed) {
        item.column = columns.length;
        columns.push([item.endMins]);
      }
    }
    const totalCols = columns.length;
    for (const item of group) {
      item.totalColumns = totalCols;
    }
  }

  return items.filter(item => item.endMins > item.startMins);
}

// ───── Vietnamese full day names for Events panel ─────
const VIET_DAY_FULL: Record<number, string> = {
  0: 'Chủ Nhật', 1: 'Thứ Hai', 2: 'Thứ Ba', 3: 'Thứ Tư',
  4: 'Thứ Năm', 5: 'Thứ Sáu', 6: 'Thứ Bảy',
};

// ───── Component ─────

function Schedule() {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Data fetching
  const { data: classesData, isLoading: classesLoading } = useDataLoading(() => fetchClasses(), [], {
    cacheKey: 'classes-for-schedule', staleTime: 5 * 60 * 1000,
  });
  const { data: teachersData } = useDataLoading(() => fetchTeachers(), [], {
    cacheKey: 'teachers-for-schedule', staleTime: 5 * 60 * 1000,
  });

  const classes = Array.isArray(classesData) ? classesData : [];
  const teachers = Array.isArray(teachersData) ? teachersData : [];

  const weekDates = useMemo(() => getWeekDates(currentWeek), [currentWeek]);

  // Default selectedDayIndex to today's index, or 0
  const todayDayIndex = useMemo(() => {
    const idx = weekDates.findIndex(d => isToday(d));
    return idx >= 0 ? idx : 0;
  }, [weekDates]);

  const activeDayIndex = selectedDayIndex ?? todayDayIndex;

  // Generate schedule blocks from classes.schedule field
  const scheduleBlocks = useMemo(() => {
    const blocks: ScheduleBlock[] = [];

    // Filter classes based on selected filters
    let filteredClasses = classes.filter((c: any) => c.status === 'running');

    if (selectedClassId) {
      filteredClasses = filteredClasses.filter((c: any) => c.id === selectedClassId);
    }

    if (selectedTeacherId) {
      filteredClasses = filteredClasses.filter((c: any) => {
        const tIds = c.teacherIds || c.teacher_ids || (c.teacherId ? [c.teacherId] : []);
        return tIds.includes(selectedTeacherId);
      });
    }

    filteredClasses.forEach((cls: any) => {
      const schedule = cls.schedule;
      if (!schedule || !Array.isArray(schedule)) return;

      // Get teacher names for this class
      const tIds = cls.teacherIds || cls.teacher_ids || (cls.teacherId ? [cls.teacherId] : []);
      const teacherNames = tIds
        .map((tid: string) => {
          const t = teachers.find((te: any) => te.id === tid);
          return t?.fullName || t?.full_name || '';
        })
        .filter(Boolean)
        .join(', ');

      schedule.forEach((s: any, sIdx: number) => {
        if (!s.day || !s.time) return;

        // Parse day name to JS day number
        const dayNum = VIET_DAY_MAP[s.day];
        if (dayNum === undefined) return;

        // Find which weekDates index matches this day
        const dayIndex = weekDates.findIndex(d => d.getDay() === dayNum);
        if (dayIndex < 0) return;

        // Parse time range "HH:MM-HH:MM" or "HH:MM - HH:MM"
        const timeParts = s.time.replace(/\s/g, '').split('-');
        if (timeParts.length < 2) return;

        const startTime = timeParts[0];
        const endTime = timeParts[1];

        blocks.push({
          id: `${cls.id}-${sIdx}-${dayNum}`,
          classId: cls.id,
          className: cls.name || '—',
          teacherNames,
          startTime,
          endTime,
          dayIndex,
        });
      });
    });

    return blocks;
  }, [classes, teachers, weekDates, selectedClassId, selectedTeacherId]);

  // Group blocks by day index and compute layouts
  const layoutByDay = useMemo(() => {
    const map: Record<number, ScheduleBlock[]> = {};
    scheduleBlocks.forEach(b => {
      if (!map[b.dayIndex]) map[b.dayIndex] = [];
      map[b.dayIndex].push(b);
    });
    const layouts: Record<number, LayoutBlock[]> = {};
    for (const [dayIdx, dayBlocks] of Object.entries(map)) {
      layouts[Number(dayIdx)] = layoutBlocksForDay(dayBlocks);
    }
    return layouts;
  }, [scheduleBlocks]);

  // Events for the selected day — sorted by start time, then alphabetically
  const dayEvents = useMemo(() => {
    const events = scheduleBlocks.filter(b => b.dayIndex === activeDayIndex);
    events.sort((a, b) => {
      const timeDiff = timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
      if (timeDiff !== 0) return timeDiff;
      return a.className.localeCompare(b.className, 'vi');
    });
    return events;
  }, [scheduleBlocks, activeDayIndex]);

  // Active day date
  const activeDayDate = weekDates[activeDayIndex];

  // Navigation
  const handlePrev = () => { const d = new Date(currentWeek); d.setDate(d.getDate() - 7); setCurrentWeek(d); setSelectedDayIndex(null); };
  const handleNext = () => { const d = new Date(currentWeek); d.setDate(d.getDate() + 7); setCurrentWeek(d); setSelectedDayIndex(null); };
  const handleToday = () => { setCurrentWeek(new Date()); setSelectedDayIndex(null); };

  // Current time line
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const showTimeLine = nowMinutes >= HOUR_START * 60 && nowMinutes <= HOUR_END * 60;
  const timeLineTop = ((nowMinutes - HOUR_START * 60) / 60) * ROW_HEIGHT;

  // Scroll to current time on mount
  useEffect(() => {
    if (gridRef.current && showTimeLine) {
      const targetScroll = Math.max(0, timeLineTop - 120);
      gridRef.current.scrollTop = targetScroll;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classesLoading]);

  const bodyHeight = HOURS.length * ROW_HEIGHT;

  // ───── Render ─────
  return (
    <div className="schedule-page">
      {/* Header */}
      <div className="schedule-header">
        <h2>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          Lịch Học
        </h2>
        <div className="schedule-filters">
          <select className="form-control" value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)}>
            <option value="">Tất cả lớp</option>
            {classes.filter((c: any) => c.status === 'running').map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="form-control" value={selectedTeacherId} onChange={e => setSelectedTeacherId(e.target.value)}>
            <option value="">Tất cả giáo viên</option>
            {teachers.map((t: any) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
          </select>
        </div>
      </div>

      {/* Week Navigation */}
      <div className="schedule-week-nav">
        <button className="nav-btn" onClick={handlePrev}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
          Tuần trước
        </button>
        <div className="nav-center">
          <span className="week-label">
            {weekDates[0].toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' })} – {weekDates[6].toLocaleDateString('vi-VN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          <button className="today-btn" onClick={handleToday}>Hôm nay</button>
        </div>
        <button className="nav-btn" onClick={handleNext}>
          Tuần sau
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
      </div>

      {/* Main content: Calendar + Events sidebar */}
      {classesLoading ? (
        <div className="schedule-loading">
          <div className="spinner" />
          <p style={{ color: 'var(--muted)', fontSize: 'var(--font-size-sm)' }}>Đang tải lịch học...</p>
        </div>
      ) : (
        <div className="schedule-main-layout">
          {/* Calendar */}
          <div className="calendar-wrapper">
            <div ref={gridRef} className="calendar-scroll">
              {/* Sticky Day Headers — clickable to switch events panel */}
              <div className="calendar-header-row">
                <div className="corner-cell" />
                {weekDates.map((date, i) => (
                  <div
                    key={i}
                    className={`day-header-cell ${isToday(date) ? 'is-today' : ''} ${activeDayIndex === i ? 'is-selected' : ''}`}
                    onClick={() => setSelectedDayIndex(i)}
                    style={{ cursor: 'pointer' }}
                  >
                    <span className="day-name">{DAY_NAMES[(date.getDay()) % 7]}</span>
                    <span className="day-number">{date.getDate()}</span>
                  </div>
                ))}
              </div>

              {/* Grid Body */}
              <div className="calendar-body-area">
                {/* Time labels */}
                <div className="time-labels-column">
                  {HOURS.map(hour => (
                    <div key={hour} className="time-label-cell" style={{ height: ROW_HEIGHT }}>
                      {String(hour).padStart(2, '0')}:00
                    </div>
                  ))}
                </div>

                {/* Day columns */}
                {weekDates.map((date, dayIndex) => {
                  const dayLayout = layoutByDay[dayIndex] || [];

                  return (
                    <div
                      key={dayIndex}
                      className={`day-column ${isToday(date) ? 'day-column-today' : ''}`}
                      style={{ height: bodyHeight }}
                    >
                      {/* Hour grid lines */}
                      {HOURS.map(hour => (
                        <div key={hour} className="hour-line" style={{ top: (hour - HOUR_START) * ROW_HEIGHT }} />
                      ))}

                      {/* Schedule blocks */}
                      {dayLayout.map(item => {
                        const { block, top, height, column, totalColumns } = item;
                        const colorIdx = classColorIndex(block.classId);
                        const timeLabel = `${formatTime(block.startTime)} - ${formatTime(block.endTime)}`;

                        const gap = 2;
                        const widthPercent = 100 / totalColumns;
                        const leftPercent = column * widthPercent;

                        return (
                          <div
                            key={block.id}
                            className={`session-block session-color-${colorIdx}`}
                            style={{
                              top,
                              height: Math.max(height, 22),
                              left: `calc(${leftPercent}% + ${gap}px)`,
                              width: `calc(${widthPercent}% - ${gap * 2}px)`,
                            }}
                            title={`${block.className}\n${block.teacherNames}\n${timeLabel}`}
                          >
                            <div className="session-title">{block.className}</div>
                            {height > 30 && <div className="session-teacher">{block.teacherNames}</div>}
                            {height > 44 && <div className="session-time">{timeLabel}</div>}
                          </div>
                        );
                      })}

                      {/* Current time line */}
                      {showTimeLine && isToday(date) && (
                        <div className="current-time-line" style={{ top: timeLineTop }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Events sidebar ── */}
          <div className="events-sidebar">
            <div className="events-sidebar-header">
              <div className="events-sidebar-date">
                <span className="events-day-name">{VIET_DAY_FULL[activeDayDate.getDay()]}</span>
                <span className="events-day-number">{activeDayDate.getDate()}</span>
                <span className="events-month">{activeDayDate.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}</span>
              </div>
              <div className="events-nav-controls">
                {isToday(activeDayDate) && <span className="events-today-badge">Hôm nay</span>}
                {!isToday(activeDayDate) && (
                  <button
                    className="events-today-link"
                    onClick={() => { setCurrentWeek(new Date()); setSelectedDayIndex(null); }}
                  >
                    Hôm nay
                  </button>
                )}
              </div>
            </div>

            {/* Day navigation: prev / date picker / next */}
            <div className="events-day-nav">
              <button
                className="events-nav-btn"
                onClick={() => {
                  const newIdx = activeDayIndex - 1;
                  if (newIdx >= 0) {
                    setSelectedDayIndex(newIdx);
                  } else {
                    // Go to previous week, select Sunday (last day)
                    const d = new Date(currentWeek);
                    d.setDate(d.getDate() - 7);
                    setCurrentWeek(d);
                    setSelectedDayIndex(6);
                  }
                }}
                title="Ngày trước"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
              </button>

              <input
                type="date"
                className="events-date-input"
                value={activeDayDate.toISOString().split('T')[0]}
                onChange={(e) => {
                  const picked = new Date(e.target.value + 'T00:00:00');
                  if (!isNaN(picked.getTime())) {
                    setCurrentWeek(picked);
                    // Find day index in new week
                    const newWeek = getWeekDates(picked);
                    const idx = newWeek.findIndex(d =>
                      d.getDate() === picked.getDate() && d.getMonth() === picked.getMonth() && d.getFullYear() === picked.getFullYear()
                    );
                    setSelectedDayIndex(idx >= 0 ? idx : 0);
                  }
                }}
              />

              <button
                className="events-nav-btn"
                onClick={() => {
                  const newIdx = activeDayIndex + 1;
                  if (newIdx <= 6) {
                    setSelectedDayIndex(newIdx);
                  } else {
                    // Go to next week, select Monday (first day)
                    const d = new Date(currentWeek);
                    d.setDate(d.getDate() + 7);
                    setCurrentWeek(d);
                    setSelectedDayIndex(0);
                  }
                }}
                title="Ngày sau"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            </div>

            <div className="events-sidebar-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              Sự kiện ({dayEvents.length})
            </div>

            <div className="events-list">
              {dayEvents.length === 0 ? (
                <div className="events-empty">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.3 }}>
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <p>Không có lớp học</p>
                </div>
              ) : (
                dayEvents.map(event => {
                  const colorIdx = classColorIndex(event.classId);
                  const timeLabel = `${formatTime(event.startTime)} - ${formatTime(event.endTime)}`;
                  // Check if event is happening now
                  const eventStartMins = timeToMinutes(event.startTime);
                  const eventEndMins = timeToMinutes(event.endTime);
                  const isNow = isToday(activeDayDate) && nowMinutes >= eventStartMins && nowMinutes < eventEndMins;

                  return (
                    <div
                      key={event.id}
                      className={`event-card event-color-${colorIdx} ${isNow ? 'event-active' : ''}`}
                    >
                      <div className="event-time-badge">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        {timeLabel}
                      </div>
                      <div className="event-class-name">{event.className}</div>
                      {event.teacherNames && (
                        <div className="event-teacher">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                          </svg>
                          {event.teacherNames}
                        </div>
                      )}
                      {isNow && <div className="event-live-indicator">● Đang diễn ra</div>}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Schedule;
