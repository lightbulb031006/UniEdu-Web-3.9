import React, { useState, useCallback } from 'react';
import { useDataLoading } from '../hooks/useDataLoading';
import { useAuthStore } from '../store/authStore';
import { fetchActionHistory, undoAction, ActionHistory as ActionHistoryItem, ActionHistoryFilters } from '../services/actionHistoryService';

/**
 * Action History Page Component - Lịch sử chỉnh sửa
 * Migrated from backup/assets/js/pages/action-history.js
 */

const ACTION_LABELS: Record<string, string> = {
  create: 'Tạo mới',
  update: 'Cập nhật',
  delete: 'Xóa',
  undo: 'Hoàn tác',
};

const ACTION_COLORS: Record<string, string> = {
  create: 'success',
  update: 'primary',
  delete: 'danger',
  undo: 'warning',
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
  student: 'Học sinh',
  teacher: 'Nhân sự',
  class: 'Lớp học',
  payment: 'Thanh toán',
  cost: 'Chi phí',
  category: 'Phân loại',
  lesson_plan: 'Giáo án',
  lesson_output: 'Giáo án',
};

function ActionHistory() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [filters, setFilters] = useState<ActionHistoryFilters>({
    entityType: '',
    userId: '',
    actionType: '',
    startDate: (() => {
      const date = new Date();
      date.setDate(date.getDate() - 30);
      return date.toISOString().split('T')[0];
    })(),
    endDate: new Date().toISOString().split('T')[0],
  });

  const fetchHistoryFn = useCallback(() => fetchActionHistory(filters), [filters]);

  const { data: historyData, isLoading, error, refetch } = useDataLoading(fetchHistoryFn, [filters], {
    cacheKey: `action-history-${JSON.stringify(filters)}`,
    staleTime: 1 * 60 * 1000,
  });

  // Ensure history is always an array
  const history = Array.isArray(historyData) ? historyData : [];

  const handleApplyFilters = () => {
    // Filters are already in state, just trigger refetch
    refetch();
  };

  const handleUndo = async (actionId: string) => {
    if (!window.confirm('Bạn có chắc muốn khôi phục hành động này? Dữ liệu hiện tại sẽ bị thay thế.')) {
      return;
    }

    try {
      const result = await undoAction(actionId);
      if (result.success) {
        toast.success(result.message);
        refetch();
      } else {
        toast.error(result.message);
      }
    } catch (error: any) {
      toast.error('Lỗi khi khôi phục: ' + (error.message || 'Lỗi không xác định'));
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('vi-VN'),
      time: date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      full: date.toLocaleString('vi-VN'),
    };
  };

  const getEntityName = (action: ActionHistoryItem): string => {
    if (action.after_value) {
      return action.after_value.fullName || action.after_value.name || action.after_value.lesson_name || action.entity_id || '-';
    }
    if (action.before_value) {
      return action.before_value.fullName || action.before_value.name || action.before_value.lesson_name || action.entity_id || '-';
    }
    return action.entity_id || '-';
  };

  const canUndo = (action: ActionHistoryItem): boolean => {
    return (
      isAdmin &&
      action.action_type !== 'undo' &&
      action.before_value !== null &&
      action.before_value !== undefined &&
      action.entity_id !== null &&
      action.entity_id !== undefined
    );
  };

  return (
    <div className="page-container" style={{ padding: 'var(--spacing-6)' }}>
      <div style={{ marginBottom: 'var(--spacing-6)' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          Lịch sử chỉnh sửa
        </h1>
        <p className="text-muted">Theo dõi và quản lý các hành động chỉnh sửa dữ liệu</p>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 'var(--spacing-4)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-3)' }}>
          <div>
            <label className="form-label" style={{ fontSize: 'var(--font-size-sm)', fontWeight: '500', marginBottom: 'var(--spacing-1)' }}>
              Loại đối tượng
            </label>
            <select
              className="form-control"
              value={filters.entityType || ''}
              onChange={(e) => setFilters({ ...filters, entityType: e.target.value || undefined })}
            >
              <option value="">Tất cả</option>
              <option value="student">Học sinh</option>
              <option value="teacher">Nhân sự</option>
              <option value="class">Lớp học</option>
              <option value="payment">Thanh toán</option>
              <option value="cost">Chi phí</option>
              <option value="category">Phân loại</option>
              <option value="lesson_plan">Giáo án</option>
            </select>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: 'var(--font-size-sm)', fontWeight: '500', marginBottom: 'var(--spacing-1)' }}>
              Loại hành động
            </label>
            <select
              className="form-control"
              value={filters.actionType || ''}
              onChange={(e) => setFilters({ ...filters, actionType: (e.target.value as any) || undefined })}
            >
              <option value="">Tất cả</option>
              <option value="create">Tạo mới</option>
              <option value="update">Cập nhật</option>
              <option value="delete">Xóa</option>
              <option value="undo">Hoàn tác</option>
            </select>
          </div>

          {isAdmin && (
            <div>
              <label className="form-label" style={{ fontSize: 'var(--font-size-sm)', fontWeight: '500', marginBottom: 'var(--spacing-1)' }}>
                Người thực hiện
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="User ID"
                value={filters.userId || ''}
                onChange={(e) => setFilters({ ...filters, userId: e.target.value || undefined })}
              />
            </div>
          )}

          <div>
            <label className="form-label" style={{ fontSize: 'var(--font-size-sm)', fontWeight: '500', marginBottom: 'var(--spacing-1)' }}>
              Từ ngày
            </label>
            <input
              type="date"
              className="form-control"
              value={filters.startDate || ''}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value || undefined })}
            />
            <small style={{ fontSize: 'var(--font-size-xs)', color: 'var(--muted)', marginTop: '4px', display: 'block' }}>
              Chỉ hiển thị lịch sử trong 30 ngày gần nhất
            </small>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: 'var(--font-size-sm)', fontWeight: '500', marginBottom: 'var(--spacing-1)' }}>
              Đến ngày
            </label>
            <input
              type="date"
              className="form-control"
              value={filters.endDate || ''}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value || undefined })}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="btn btn-primary" onClick={handleApplyFilters} style={{ width: '100%' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px' }}>
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              Áp dụng
            </button>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="card">
        {isLoading ? (
          <div style={{ padding: 'var(--spacing-8)', textAlign: 'center' }}>
            <div className="spinner" />
            <p className="text-muted" style={{ marginTop: 'var(--spacing-3)' }}>Đang tải lịch sử...</p>
          </div>
        ) : error ? (
          <div style={{ padding: 'var(--spacing-8)', textAlign: 'center' }}>
            <p style={{ color: 'var(--danger)' }}>Lỗi: {error.message}</p>
          </div>
        ) : history.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--spacing-8)', color: 'var(--muted)' }}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ margin: '0 auto var(--spacing-3)', opacity: 0.3 }}>
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <p style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--spacing-2)' }}>Chưa có lịch sử</p>
            <p style={{ fontSize: 'var(--font-size-sm)' }}>Các hành động chỉnh sửa sẽ được hiển thị ở đây</p>
          </div>
        ) : (
          <div className="timeline-container" style={{ padding: 'var(--spacing-4)' }}>
            {history.map((action, index) => {
              const dateTime = formatDateTime(action.created_at);
              const actionLabel = ACTION_LABELS[action.action_type] || action.action_type;
              const actionColor = ACTION_COLORS[action.action_type] || 'default';
              const entityLabel = ENTITY_TYPE_LABELS[action.entity_type] || action.entity_type;
              const entityName = getEntityName(action);
              const canUndoAction = canUndo(action);

              return (
                <div
                  key={action.id}
                  className="timeline-item"
                  style={{
                    position: 'relative',
                    paddingLeft: 'var(--spacing-6)',
                    marginBottom: index < history.length - 1 ? 'var(--spacing-4)' : '0',
                  }}
                >
                  {/* Timeline marker */}
                  <div
                    className="timeline-marker"
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: `var(--${actionColor})`,
                      border: '2px solid var(--surface)',
                      zIndex: 1,
                    }}
                  />

                  {/* Timeline line */}
                  {index < history.length - 1 && (
                    <div
                      className="timeline-line"
                      style={{
                        position: 'absolute',
                        left: '5px',
                        top: '12px',
                        width: '2px',
                        height: 'calc(100% + var(--spacing-4))',
                        background: 'var(--border)',
                      }}
                    />
                  )}

                  {/* Timeline content */}
                  <div
                    className="timeline-content"
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-lg)',
                      padding: 'var(--spacing-4)',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--spacing-3)', marginBottom: 'var(--spacing-2)' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-2)', flexWrap: 'wrap' }}>
                          <span className={`badge badge-${actionColor}`} style={{ fontSize: 'var(--font-size-xs)' }}>
                            {actionLabel}
                          </span>
                          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: '600', color: 'var(--text)' }}>
                            {entityLabel}: {entityName}
                          </span>
                        </div>
                        {action.description && (
                          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text)', margin: '0 0 var(--spacing-1) 0' }}>
                            {action.description}
                          </p>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)', flexWrap: 'wrap', marginTop: 'var(--spacing-2)' }}>
                          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10" />
                              <polyline points="12 6 12 12 16 14" />
                            </svg>
                            {dateTime.date} {dateTime.time}
                          </span>
                          {action.user_email && (
                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--muted)' }}>bởi {action.user_email}</span>
                          )}
                        </div>
                        {action.changed_fields && Object.keys(action.changed_fields).length > 0 && (
                          <details style={{ marginTop: 'var(--spacing-2)', paddingTop: 'var(--spacing-2)', borderTop: '1px solid var(--border)' }}>
                            <summary style={{ cursor: 'pointer', color: 'var(--primary)', fontWeight: '500', fontSize: 'var(--font-size-xs)' }}>
                              Xem các field đã thay đổi ({Object.keys(action.changed_fields).length})
                            </summary>
                            <div style={{ marginTop: 'var(--spacing-2)', padding: 'var(--spacing-2)', background: 'var(--bg)', borderRadius: 'var(--radius)' }}>
                              {Object.entries(action.changed_fields).map(([field, change]: [string, any]) => (
                                <div key={field} style={{ marginBottom: 'var(--spacing-1)', fontSize: 'var(--font-size-xs)' }}>
                                  <strong>{field}:</strong>
                                  <span style={{ color: 'var(--danger)', marginLeft: 'var(--spacing-1)' }}>
                                    {JSON.stringify(change.old)}
                                  </span>
                                  <span style={{ margin: '0 var(--spacing-1)' }}>→</span>
                                  <span style={{ color: 'var(--success)' }}>{JSON.stringify(change.new)}</span>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                      {canUndoAction && (
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={() => handleUndo(action.id)}
                          style={{ fontSize: 'var(--font-size-xs)', padding: '6px 12px', whiteSpace: 'nowrap' }}
                          title="Khôi phục về trạng thái trước đó"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '4px', verticalAlign: 'middle' }}>
                            <path d="M3 7v6h6" />
                            <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
                          </svg>
                          Undo
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default ActionHistory;
