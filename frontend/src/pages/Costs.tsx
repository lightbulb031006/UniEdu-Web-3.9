import React, { useState, useCallback, useMemo } from 'react';
import { useDataLoading } from '../hooks/useDataLoading';
import { formatCurrencyVND, formatDate } from '../utils/formatters';
import { fetchCosts, createCost, updateCost, deleteCost, Cost, CostFormData } from '../services/costsService';
import { toast } from '../utils/toast';
import Modal from '../components/Modal';
import { CurrencyInput } from '../components/CurrencyInput';

/**
 * Costs Page Component - Chi phí
 * Migrated from backup/assets/js/pages/costs.js
 */

const COST_STATUS_META = {
  paid: {
    label: 'Đã thanh toán',
    badge: 'badge-success',
  },
  pending: {
    label: 'Chưa thanh toán',
    badge: 'badge-warning',
  },
};

function Costs() {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCost, setEditingCost] = useState<Cost | null>(null);
  const [formData, setFormData] = useState<CostFormData>({
    date: defaultMonth + '-01',
    category: '',
    amount: 0,
    status: 'paid',
  });

  const fetchCostsFn = useCallback(
    () => fetchCosts({ month: selectedMonth }),
    [selectedMonth]
  );

  const { data: costsData, isLoading, error, refetch } = useDataLoading(fetchCostsFn, [selectedMonth], {
    cacheKey: `costs-${selectedMonth}`,
    staleTime: 2 * 60 * 1000,
  });

  // Ensure costs is always an array
  const costs = Array.isArray(costsData) ? costsData : [];

  const formatMonthLabel = (month: string) => {
    if (!month) return '-';
    const [year, monthPart] = month.split('-');
    return `${monthPart}/${year}`;
  };

  const monthTotal = useMemo(() => {
    const costsArray = Array.isArray(costs) ? costs : [];
    return costsArray.reduce((sum: number, cost: Cost) => sum + (cost.amount || 0), 0);
  }, [costs]);

  const handleOpenModal = (cost?: Cost) => {
    if (cost) {
      setEditingCost(cost);
      setFormData({
        date: cost.date || cost.month + '-01',
        category: cost.category || '',
        amount: cost.amount || 0,
        status: cost.status || 'paid',
      });
    } else {
      setEditingCost(null);
      setFormData({
        date: selectedMonth + '-01',
        category: '',
        amount: 0,
        status: 'paid',
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCost(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.date) {
      toast.error('Vui lòng chọn ngày hợp lệ');
      return;
    }
    if (!formData.category.trim()) {
      toast.error('Hạng mục không được để trống');
      return;
    }
    if (!Number.isFinite(formData.amount)) {
      toast.error('Số tiền không hợp lệ');
      return;
    }

    try {
      if (editingCost) {
        await updateCost(editingCost.id, formData);
        toast.success('Đã cập nhật chi phí');
      } else {
        await createCost(formData);
        toast.success('Đã thêm chi phí mới');
      }
      handleCloseModal();
      refetch();
    } catch (error: any) {
      toast.error('Không thể lưu chi phí: ' + (error.message || 'Lỗi không xác định'));
    }
  };

  const handleDelete = async (costId: string) => {
    if (!window.confirm('Xóa chi phí này?')) return;

    try {
      await deleteCost(costId);
      toast.success('Đã xóa chi phí');
      refetch();
    } catch (error: any) {
      toast.error('Không thể xóa chi phí: ' + (error.message || 'Lỗi không xác định'));
    }
  };


  return (
    <div className="page-container" style={{ padding: 'var(--spacing-6)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-4)' }}>
        <h2>Chi phí</h2>
        <button className="btn btn-primary" onClick={() => handleOpenModal()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 'var(--spacing-2)' }}>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Thêm chi phí
        </button>
      </div>

      {/* Month Filter */}
      <div className="card" style={{ marginBottom: 'var(--spacing-4)' }}>
        <div style={{ display: 'flex', gap: 'var(--spacing-4)', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label htmlFor="costMonth" style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)' }}>
              Chọn tháng
            </label>
            <input
              id="costMonth"
              type="month"
              className="form-control"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              max={defaultMonth}
            />
          </div>
        </div>
        <div className="text-muted text-sm" style={{ marginTop: 'var(--spacing-2)' }}>
          Đang xem: {formatMonthLabel(selectedMonth)}
        </div>
      </div>

      {/* Costs List */}
      <div className="card">
        {isLoading ? (
          <div style={{ padding: 'var(--spacing-8)', textAlign: 'center' }}>
            <div className="spinner" />
            <p className="text-muted" style={{ marginTop: 'var(--spacing-3)' }}>Đang tải dữ liệu...</p>
          </div>
        ) : error ? (
          <div style={{ padding: 'var(--spacing-8)', textAlign: 'center' }}>
            <p style={{ color: 'var(--danger)' }}>Lỗi: {error.message}</p>
          </div>
        ) : (
          <>
            <div className="table-container" style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', fontWeight: '600' }}>Ngày</th>
                    <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', fontWeight: '600' }}>Hạng mục</th>
                    <th style={{ padding: 'var(--spacing-3)', textAlign: 'right', fontWeight: '600' }}>Số tiền</th>
                    <th style={{ padding: 'var(--spacing-3)', textAlign: 'center', fontWeight: '600' }}>Trạng thái</th>
                    <th style={{ padding: 'var(--spacing-3)', textAlign: 'center', fontWeight: '600' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {costs.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: 'var(--spacing-8)', textAlign: 'center', color: 'var(--muted)' }}>
                        Chưa có chi phí nào trong tháng này.
                      </td>
                    </tr>
                  ) : (
                    costs.map((cost: Cost) => (
                      <tr
                        key={cost.id}
                        style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--bg-secondary)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                        }}
                        onClick={() => handleOpenModal(cost)}
                      >
                        <td style={{ padding: 'var(--spacing-3)' }}>{formatDate(cost.date || cost.month + '-01')}</td>
                        <td style={{ padding: 'var(--spacing-3)' }}>{cost.category || '-'}</td>
                        <td style={{ padding: 'var(--spacing-3)', textAlign: 'right', fontWeight: '500' }}>
                          {formatCurrencyVND(cost.amount || 0)}
                        </td>
                        <td style={{ padding: 'var(--spacing-3)', textAlign: 'center' }}>
                          <span className={`badge ${COST_STATUS_META[cost.status || 'paid']?.badge || 'badge-success'}`}>
                            {COST_STATUS_META[cost.status || 'paid']?.label || 'Đã thanh toán'}
                          </span>
                        </td>
                        <td style={{ padding: 'var(--spacing-3)', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'center' }}>
                            <button
                              className="btn btn-sm btn-outline"
                              onClick={() => handleOpenModal(cost)}
                              title="Chỉnh sửa"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => handleDelete(cost.id)}
                              title="Xóa"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {costs.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--spacing-4)', paddingTop: 'var(--spacing-3)', borderTop: '1px solid var(--border)' }}>
                <div className="text-muted text-sm">Tổng chi phí tháng {formatMonthLabel(selectedMonth)}</div>
                <div style={{ fontWeight: '600', fontSize: 'var(--font-size-lg)' }}>{formatCurrencyVND(monthTotal)}</div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Cost Form Modal */}
      <Modal
        title={editingCost ? 'Chỉnh sửa chi phí' : 'Thêm chi phí mới'}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        size="md"
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: 'var(--spacing-4)' }}>
            <label htmlFor="costDate" style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)', fontWeight: '500' }}>
              Ngày chi phí *
            </label>
            <input
              id="costDate"
              type="date"
              className="form-control"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--spacing-4)' }}>
            <label htmlFor="costCategory" style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)', fontWeight: '500' }}>
              Hạng mục *
            </label>
            <input
              id="costCategory"
              type="text"
              className="form-control"
              maxLength={30}
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              placeholder="Ví dụ: Thuê phòng"
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--spacing-4)' }}>
            <label htmlFor="costAmount" style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)', fontWeight: '500' }}>
              Số tiền *
            </label>
            <CurrencyInput
              id="costAmount"
              className="form-control"
              value={formData.amount}
              onChange={(value) => setFormData({ ...formData, amount: value })}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--spacing-4)' }}>
            <label htmlFor="costStatus" style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)', fontWeight: '500' }}>
              Trạng thái *
            </label>
            <select
              id="costStatus"
              className="form-control"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as 'paid' | 'pending' })}
              required
            >
              {Object.entries(COST_STATUS_META).map(([value, meta]) => (
                <option key={value} value={value}>
                  {meta.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-actions" style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'flex-end', marginTop: 'var(--spacing-6)' }}>
            <button type="button" className="btn" onClick={handleCloseModal}>
              Hủy
            </button>
            <button type="submit" className="btn btn-primary">
              {editingCost ? 'Cập nhật' : 'Thêm mới'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default Costs;
