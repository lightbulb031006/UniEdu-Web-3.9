/**
 * SurveyTab Component
 * Displays and manages survey reports for a class
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useDataLoading } from '../hooks/useDataLoading';
import {
  fetchSurveysByClassId,
  createSurvey,
  updateSurvey,
  deleteSurvey,
  SurveyWithTeacher,
} from '../services/surveysService';
import { fetchClassById } from '../services/classesService';
import { formatDate } from '../utils/formatters';
import { toast } from '../utils/toast';
import { getCurrentUser } from '../utils/permissions';
import Modal from './Modal';

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface SurveyTabProps {
  classId: string;
  canManage?: boolean; // Permission to create/edit/delete surveys
}

export default function SurveyTab({ classId, canManage = true }: SurveyTabProps) {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingSurvey, setEditingSurvey] = useState<SurveyWithTeacher | null>(null);

  // Month state for surveys
  const currentMonth = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
  const [monthPopupOpen, setMonthPopupOpen] = useState(false);

  // Fetch surveys
  const fetchSurveysFn = useCallback(() => fetchSurveysByClassId(classId), [classId]);
  const {
    data: surveys,
    isLoading,
    refetch: refetchSurveys,
  } = useDataLoading(fetchSurveysFn, [classId], {
    cacheKey: `surveys-class-${classId}`,
    staleTime: 1 * 60 * 1000,
  });

  // Fetch class data with teachers (only teachers of this class)
  const fetchClassFn = useCallback(() => fetchClassById(classId, { includeTeachers: true }), [classId]);
  const { data: classData } = useDataLoading(fetchClassFn, [classId], {
    cacheKey: `class-${classId}-for-surveys`,
    staleTime: 5 * 60 * 1000,
  });

  // Get class teachers from classData
  const classTeachers = useMemo(() => {
    if (!classData) {
      console.log('[SurveyTab] No classData, returning empty teachers array');
      return [];
    }
    if (!(classData as any).teachers) {
      console.warn('[SurveyTab] No teachers in classData. classData keys:', Object.keys(classData));
      return [];
    }
    const teachers = Array.isArray((classData as any).teachers) ? (classData as any).teachers : [];
    console.log('[SurveyTab] Found teachers:', teachers.length);
    return teachers;
  }, [classData]);

  const surveysList = Array.isArray(surveys) ? surveys : [];

  // Month navigation handlers
  const handleMonthChange = (delta: number) => {
    const [year, month] = selectedMonth.split('-');
    let newMonth = parseInt(month) + delta;
    let newYear = parseInt(year);
    if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    } else if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    }
    setSelectedMonth(`${newYear}-${String(newMonth).padStart(2, '0')}`);
  };

  const handleYearChange = (delta: number) => {
    const [year, month] = selectedMonth.split('-');
    const newYear = parseInt(year) + delta;
    setSelectedMonth(`${newYear}-${month}`);
  };

  const handleMonthSelect = (monthVal: string) => {
    const [year] = selectedMonth.split('-');
    setSelectedMonth(`${year}-${monthVal}`);
    setMonthPopupOpen(false);
  };

  // Close month popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (monthPopupOpen && !target.closest('.survey-month-nav')) {
        setMonthPopupOpen(false);
      }
    };

    if (monthPopupOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [monthPopupOpen]);

  // Filter surveys by selected month
  const monthSurveys = useMemo(() => {
    return surveysList.filter((s) => {
      if (!s.report_date) return false;
      const surveyMonth = s.report_date.slice(0, 7); // YYYY-MM
      return surveyMonth === selectedMonth;
    });
  }, [surveysList, selectedMonth]);

  // Calculate month label
  const [year, month] = selectedMonth.split('-');
  const monthNum = parseInt(month);
  const monthLabel = `Tháng ${monthNum}/${year}`;

  // Optimistic update handlers
  const handleCreate = async (surveyData: Omit<SurveyWithTeacher, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      // Optimistic: Add to local state immediately
      const tempId = `temp-${Date.now()}`;
      const optimisticSurvey: SurveyWithTeacher = {
        id: tempId,
        ...surveyData,
        responsible_person: surveyData.responsible_person_id
          ? classTeachers.find((t) => t.id === surveyData.responsible_person_id) || null
          : null,
      };

      // Update UI immediately
      const currentSurveys = surveysList;
      const newSurveys = [...currentSurveys, optimisticSurvey];

      // Call API
      const created = await createSurvey({
        class_id: surveyData.class_id,
        test_number: surveyData.test_number,
        responsible_person_id: surveyData.responsible_person_id,
        report_date: surveyData.report_date,
        content: surveyData.content,
      });

      // Replace optimistic with real data
      toast.success('Đã tạo báo cáo khảo sát');
      refetchSurveys();
      setAddModalOpen(false);
    } catch (error: any) {
      toast.error('Không thể tạo báo cáo: ' + (error.response?.data?.error || error.message));
      // Rollback: refetch to get correct data
      refetchSurveys();
    }
  };

  const handleUpdate = async (id: string, updates: Partial<SurveyWithTeacher>) => {
    try {
      // Optimistic: Update local state immediately
      const currentSurveys = surveysList;
      const updatedSurveys = currentSurveys.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      );

      // Call API
      await updateSurvey(id, {
        test_number: updates.test_number,
        responsible_person_id: updates.responsible_person_id,
        report_date: updates.report_date,
        content: updates.content,
      });

      toast.success('Đã cập nhật báo cáo khảo sát');
      refetchSurveys();
      setEditModalOpen(false);
      setEditingSurvey(null);
    } catch (error: any) {
      toast.error('Không thể cập nhật báo cáo: ' + (error.response?.data?.error || error.message));
      // Rollback: refetch to get correct data
      refetchSurveys();
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa báo cáo khảo sát này?')) {
      return;
    }

    try {
      // Optimistic: Remove from local state immediately
      const currentSurveys = surveysList;
      const filteredSurveys = currentSurveys.filter((s) => s.id !== id);

      // Call API
      await deleteSurvey(id);

      toast.success('Đã xóa báo cáo khảo sát');
      refetchSurveys();
    } catch (error: any) {
      toast.error('Không thể xóa báo cáo: ' + (error.response?.data?.error || error.message));
      // Rollback: refetch to get correct data
      refetchSurveys();
    }
  };

  return (
    <div className="survey-tab">
      {/* Toolbar with Month Navigation */}
      <div className="session-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-4)', flexWrap: 'wrap', gap: 'var(--spacing-2)' }}>
        <div style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>Tổng số báo cáo: {monthSurveys.length}</div>
        <div className="survey-month-nav" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}>
          <button
            type="button"
            className="session-month-btn"
            onClick={() => handleMonthChange(-1)}
            title="Tháng trước"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg)';
              e.currentTarget.style.borderColor = 'var(--primary)';
              e.currentTarget.style.color = 'var(--primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--surface)';
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.color = 'var(--text)';
            }}
            style={{
              padding: '4px 8px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              cursor: 'pointer',
              fontSize: 'var(--font-size-sm)',
              minWidth: '32px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
            }}
          >
            ◀
          </button>
          <button
            type="button"
            className="session-month-label-btn"
            onClick={() => setMonthPopupOpen(!monthPopupOpen)}
            title="Chọn tháng/năm"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: 'var(--radius)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s ease',
            }}
          >
            <span className="session-month-label" style={{ fontWeight: '500', fontSize: 'var(--font-size-sm)', whiteSpace: 'nowrap' }}>{monthLabel}</span>
          </button>
          <button
            type="button"
            className="session-month-btn"
            onClick={() => handleMonthChange(1)}
            title="Tháng sau"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg)';
              e.currentTarget.style.borderColor = 'var(--primary)';
              e.currentTarget.style.color = 'var(--primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--surface)';
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.color = 'var(--text)';
            }}
            style={{
              padding: '4px 8px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              cursor: 'pointer',
              fontSize: 'var(--font-size-sm)',
              minWidth: '32px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
            }}
          >
            ▶
          </button>
          {/* Month Popup */}
          {monthPopupOpen && (
            <div
              className="session-month-popup"
              style={{
                position: 'absolute',
                top: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                marginTop: '6px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                boxShadow: 'var(--shadow-sm)',
                padding: '6px 8px 8px',
                zIndex: 30,
                minWidth: '200px',
              }}
            >
              <div className="session-month-popup-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px', fontSize: 'var(--font-size-xs)' }}>
                <button
                  type="button"
                  className="session-month-year-btn"
                  onClick={() => handleYearChange(-1)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    padding: '2px 4px',
                    borderRadius: 'var(--radius)',
                    transition: 'background 0.2s ease',
                  }}
                >
                  ‹
                </button>
                <span className="session-month-year-label" style={{ fontWeight: '500' }}>{year}</span>
                <button
                  type="button"
                  className="session-month-year-btn"
                  onClick={() => handleYearChange(1)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    padding: '2px 4px',
                    borderRadius: 'var(--radius)',
                    transition: 'background 0.2s ease',
                  }}
                >
                  ›
                </button>
              </div>
              <div
                className="session-month-grid"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                  gap: '4px',
                }}
              >
                {monthNames.map((label, idx) => {
                  const val = String(idx + 1).padStart(2, '0');
                  const isActive = val === month;
                  return (
                    <button
                      key={val}
                      type="button"
                      className={`session-month-cell${isActive ? ' active' : ''}`}
                      data-month={val}
                      onClick={() => handleMonthSelect(val)}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = 'var(--bg)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = 'transparent';
                        }
                      }}
                      style={{
                        borderRadius: 'var(--radius)',
                        border: isActive ? '1px solid var(--primary)' : '1px solid transparent',
                        background: isActive ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                        color: isActive ? 'var(--primary)' : 'var(--text)',
                        cursor: 'pointer',
                        padding: '3px 0',
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: isActive ? '600' : '400',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        {canManage && (
          <div className="session-toolbar-actions" style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
            <button
              className="btn btn-primary"
              onClick={() => setAddModalOpen(true)}
              title="Thêm báo cáo"
              style={{ 
                width: '36px', 
                height: '36px', 
                padding: 0, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                borderRadius: 'var(--radius)',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Surveys List */}
      {isLoading ? (
        <div style={{ padding: 'var(--spacing-8)', textAlign: 'center', color: 'var(--muted)' }}>
          Đang tải...
        </div>
      ) : monthSurveys.length > 0 ? (
        <div className="table-container" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border)' }}>
          <table className="table-striped" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'linear-gradient(180deg, rgba(59, 130, 246, 0.08) 0%, rgba(59, 130, 246, 0.03) 100%)' }}>
                <th style={{ padding: 'var(--spacing-3)', textAlign: 'center', fontWeight: '600', fontSize: '0.875rem', width: '50px' }}>#</th>
                <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem' }}>Nội dung</th>
                <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem', width: '250px' }}>Thông tin</th>
                {canManage && (
                  <th style={{ width: '50px', textAlign: 'center', padding: 'var(--spacing-3)' }}></th>
                )}
              </tr>
            </thead>
            <tbody>
              {monthSurveys.map((survey, index) => (
                <tr
                  key={survey.id}
                  style={{
                    transition: 'all 0.2s ease',
                    cursor: canManage ? 'pointer' : 'default',
                  }}
                  onClick={(e) => {
                    // Don't open modal if clicking on buttons or other interactive elements
                    const target = e.target as HTMLElement;
                    if (
                      target.tagName === 'BUTTON' ||
                      target.tagName === 'INPUT' ||
                      target.closest('button') ||
                      target.closest('input') ||
                      target.closest('.btn-delete-icon')
                    ) {
                      return;
                    }
                    // Open edit modal when clicking on row (if can manage)
                    if (canManage) {
                      setEditingSurvey(survey);
                      setEditModalOpen(true);
                    }
                  }}
                  onMouseEnter={(e) => {
                    if (canManage) {
                      e.currentTarget.style.background = 'var(--bg-secondary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '';
                  }}
                >
                  <td style={{ padding: 'var(--spacing-3)', textAlign: 'center', color: 'var(--muted)', fontWeight: '600' }}>
                    {index + 1}
                  </td>
                  <td style={{ padding: 'var(--spacing-3)' }}>
                    <div
                      style={{
                        fontSize: 'var(--font-size-sm)',
                        color: 'var(--text)',
                        lineHeight: 1.6,
                        whiteSpace: 'pre-wrap',
                        wordWrap: 'break-word',
                      }}
                    >
                      {survey.content || <span style={{ fontStyle: 'italic', color: 'var(--muted)' }}>Không có nội dung</span>}
                    </div>
                  </td>
                  <td style={{ padding: 'var(--spacing-3)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}>
                        <span style={{ color: 'var(--muted)', fontWeight: '500' }}>Lần:</span>
                        <span style={{ color: 'var(--text)', fontWeight: '500' }}>{survey.test_number}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}>
                        <span style={{ color: 'var(--muted)', fontWeight: '500' }}>Ngày:</span>
                        <span style={{ color: 'var(--text)' }}>{formatDate(survey.report_date)}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}>
                        <span style={{ color: 'var(--muted)', fontWeight: '500' }}>Phụ trách:</span>
                        {survey.responsible_person ? (
                          <span style={{ color: 'var(--text)' }}>{survey.responsible_person.full_name}</span>
                        ) : (
                          <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>Chưa có</span>
                        )}
                      </div>
                    </div>
                  </td>
                  {canManage && (
                    <td
                      className="session-actions"
                      onClick={(e) => e.stopPropagation()}
                      style={{ textAlign: 'center', padding: 'var(--spacing-3)' }}
                    >
                      <button
                        className="btn-delete-icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(survey.id);
                        }}
                        title="Xóa báo cáo"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--danger)',
                          cursor: 'pointer',
                          padding: 'var(--spacing-1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ padding: 'var(--spacing-8)', textAlign: 'center' }}>
          <svg
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ opacity: 0.3, color: 'var(--muted)', marginBottom: 'var(--spacing-4)' }}
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '1rem', fontWeight: '500', marginBottom: 'var(--spacing-3)' }}>
            Chưa có báo cáo khảo sát nào.
          </p>
          {canManage && (
            <button
              className="btn btn-primary"
              onClick={() => setAddModalOpen(true)}
              title="Thêm báo cáo"
              style={{ 
                width: '40px', 
                height: '40px', 
                padding: 0, 
                display: 'inline-flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                borderRadius: 'var(--radius)',
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Add Survey Modal */}
      <Modal
        title="Thêm báo cáo khảo sát"
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        size="lg"
      >
        <SurveyForm
          classId={classId}
          teachers={classTeachers}
          onSubmit={handleCreate}
          onCancel={() => setAddModalOpen(false)}
        />
      </Modal>

      {/* Edit Survey Modal */}
      <Modal
        title="Chỉnh sửa báo cáo khảo sát"
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setEditingSurvey(null);
        }}
        size="lg"
      >
        {editingSurvey && (
          <SurveyForm
            classId={classId}
            teachers={classTeachers}
            survey={editingSurvey}
            onSubmit={(updates) => handleUpdate(editingSurvey.id, updates)}
            onCancel={() => {
              setEditModalOpen(false);
              setEditingSurvey(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}

// Survey Form Component
interface SurveyFormProps {
  classId: string;
  teachers: any[];
  survey?: SurveyWithTeacher;
  onSubmit: (data: Omit<SurveyWithTeacher, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  onCancel: () => void;
}

function SurveyForm({ classId, teachers, survey, onSubmit, onCancel }: SurveyFormProps) {
  // Get current user to set as default responsible person
  const currentUser = getCurrentUser();
  
  // Determine default responsible person: 
  // - If editing: use existing value
  // - If creating: use current user's linkId if they're a teacher of this class
  const defaultResponsiblePersonId = useMemo(() => {
    if (survey?.responsible_person_id) {
      return survey.responsible_person_id;
    }
    // For new surveys: set to current user if they're a teacher of this class
    if (currentUser?.linkId) {
      const isClassTeacher = teachers.some((t) => t.id === currentUser.linkId);
      return isClassTeacher ? currentUser.linkId : null;
    }
    return null;
  }, [survey, currentUser, teachers]);

  const [formData, setFormData] = useState({
    test_number: survey?.test_number || 1,
    responsible_person_id: defaultResponsiblePersonId,
    report_date: survey?.report_date || new Date().toISOString().split('T')[0],
    content: survey?.content || '',
  });
  const [testNumberInput, setTestNumberInput] = useState<string>(survey?.test_number?.toString() || '1');
  const [loading, setLoading] = useState(false);

  // Sync testNumberInput when survey changes (e.g., switching between create/edit)
  useEffect(() => {
    setTestNumberInput(survey?.test_number?.toString() || '1');
  }, [survey?.id]); // Only update when survey ID changes

  // Update responsible_person_id when default changes (e.g., when teachers load)
  useEffect(() => {
    // Only update if creating new survey (not editing) and defaultResponsiblePersonId is set
    if (!survey && defaultResponsiblePersonId && !formData.responsible_person_id) {
      setFormData((prev) => ({
        ...prev,
        responsible_person_id: defaultResponsiblePersonId,
      }));
    }
  }, [defaultResponsiblePersonId, survey, formData.responsible_person_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.content.trim()) {
      toast.error('Vui lòng nhập nội dung báo cáo');
      return;
    }

    // Validate and parse test_number
    const testNumber = testNumberInput.trim() === '' ? 1 : parseInt(testNumberInput, 10);
    if (isNaN(testNumber) || testNumber < 1) {
      toast.error('Vui lòng nhập số lần kiểm tra hợp lệ (từ 1 trở lên)');
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        class_id: classId,
        test_number: testNumber,
        responsible_person_id: formData.responsible_person_id,
        report_date: formData.report_date,
        content: formData.content,
      });
    } catch (error) {
      // Error already handled in parent
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-3)', marginBottom: 'var(--spacing-3)' }}>
        <div className="form-group">
          <label htmlFor="testNumber" className="form-label">
            Bài kiểm tra lần mấy *
          </label>
          <input
            type="number"
            id="testNumber"
            className="form-control"
            value={testNumberInput}
            onChange={(e) => {
              const value = e.target.value;
              // Allow empty string to clear the input
              setTestNumberInput(value);
              // Update formData only if value is valid
              const numValue = value.trim() === '' ? null : parseInt(value, 10);
              if (!isNaN(numValue as number) && numValue !== null && numValue >= 1) {
                setFormData({ ...formData, test_number: numValue });
              }
            }}
            min="1"
            required
            placeholder="1"
          />
        </div>

        <div className="form-group">
          <label htmlFor="reportDate" className="form-label">
            Ngày báo cáo *
          </label>
          <input
            type="date"
            id="reportDate"
            className="form-control"
            value={formData.report_date}
            onChange={(e) => setFormData({ ...formData, report_date: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: 'var(--spacing-3)' }}>
        <label htmlFor="responsiblePerson" className="form-label">
          Người phụ trách
        </label>
        <select
          id="responsiblePerson"
          className="form-control"
          value={formData.responsible_person_id || ''}
          onChange={(e) => setFormData({ ...formData, responsible_person_id: e.target.value || null })}
          disabled={teachers.length === 0}
        >
          <option value="">{teachers.length === 0 ? 'Lớp này chưa có giáo viên' : 'Chọn người phụ trách'}</option>
          {teachers
            .slice()
            .sort((a, b) => {
              const nameA = (a.fullName || a.full_name || '').toLowerCase();
              const nameB = (b.fullName || b.full_name || '').toLowerCase();
              return nameA.localeCompare(nameB);
            })
            .map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.fullName || teacher.full_name}
              </option>
            ))}
        </select>
        {teachers.length === 0 && (
          <small style={{ color: 'var(--muted)', fontSize: '0.875rem', marginTop: 'var(--spacing-1)', display: 'block' }}>
            Vui lòng thêm giáo viên vào lớp trước khi tạo báo cáo
          </small>
        )}
        {teachers.length > 0 && (
          <small style={{ color: 'var(--muted)', fontSize: '0.875rem', marginTop: 'var(--spacing-1)', display: 'block' }}>
            Chọn từ {teachers.length} giáo viên phụ trách lớp
          </small>
        )}
      </div>

      <div className="form-group" style={{ marginBottom: 'var(--spacing-4)' }}>
        <label htmlFor="content" className="form-label">
          Nội dung báo cáo *
        </label>
        <textarea
          id="content"
          className="form-control"
          value={formData.content}
          onChange={(e) => setFormData({ ...formData, content: e.target.value })}
          required
          placeholder="Nhập nội dung báo cáo khảo sát..."
          rows={8}
          style={{
            resize: 'vertical',
            fontFamily: 'inherit',
            fontSize: 'var(--font-size-sm)',
          }}
        />
      </div>

      <div className="form-actions" style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'flex-end' }}>
        <button type="button" className="btn" onClick={onCancel} disabled={loading}>
          Hủy
        </button>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Đang lưu...' : survey ? 'Cập nhật' : 'Tạo báo cáo'}
        </button>
      </div>
    </form>
  );
}


