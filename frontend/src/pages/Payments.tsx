import React, { useState, useMemo, useCallback } from 'react';
import { useDataLoading } from '../hooks/useDataLoading';
import { fetchPayments, createPayment, updatePayment, deletePayment, Payment, PaymentFilters } from '../services/paymentsService';
import { fetchStudents } from '../services/studentsService';
import { fetchClasses } from '../services/classesService';
import { formatCurrencyVND } from '../utils/formatters';
import { toast } from '../utils/toast';
import Modal from '../components/Modal';
import { CurrencyInput } from '../components/CurrencyInput';

/**
 * Payments Page Component
 * Migrated from backup/assets/js/pages/payments.js
 * UI giống hệt app cũ với filters và statistics
 */

function Payments() {
  const [filters, setFilters] = useState<PaymentFilters>({
    status: 'all',
  });
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [formData, setFormData] = useState({
    studentId: '',
    classId: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    status: 'pending' as 'paid' | 'pending',
    note: '',
  });

  // Stable fetch function for payments
  const fetchPaymentsFn = useCallback(
    () => fetchPayments(filters),
    [filters.status, filters.classId, filters.studentId]
  );

  // Fetch payments
  const { data: paymentsData, isLoading, error, refetch } = useDataLoading(
    fetchPaymentsFn,
    [filters.status, filters.classId, filters.studentId],
    {
      cacheKey: `payments-${filters.status}-${filters.classId || ''}-${filters.studentId || ''}`,
      staleTime: 1 * 60 * 1000,
    }
  );

  // Fetch students and classes for filters
  const { data: studentsData } = useDataLoading(() => fetchStudents(), [], {
    cacheKey: 'students-for-payments',
    staleTime: 5 * 60 * 1000,
  });

  const { data: classesData } = useDataLoading(() => fetchClasses(), [], {
    cacheKey: 'classes-for-payments',
    staleTime: 5 * 60 * 1000,
  });

  // Ensure all data are arrays
  const payments = Array.isArray(paymentsData) ? paymentsData : [];
  const students = Array.isArray(studentsData) ? studentsData : [];
  const classes = Array.isArray(classesData) ? classesData : [];

  // Calculate statistics
  const stats = useMemo(() => {
    return {
      total: payments.reduce((sum, p) => sum + (p.amount || 0), 0),
      paid: payments.filter((p) => p.status === 'paid').reduce((sum, p) => sum + (p.amount || 0), 0),
      pending: payments.filter((p) => p.status === 'pending').reduce((sum, p) => sum + (p.amount || 0), 0),
    };
  }, [payments]);

  // Filter payments
  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      if (selectedClassId && payment.classId !== selectedClassId) return false;
      if (selectedStudentId && payment.studentId !== selectedStudentId) return false;
      return true;
    });
  }, [payments, selectedClassId, selectedStudentId]);

  const handleStatusFilterChange = (status: 'all' | 'paid' | 'pending') => {
    setFilters((prev) => ({ ...prev, status }));
  };

  const handleClassFilterChange = (classId: string) => {
    setSelectedClassId(classId);
    setFilters((prev) => ({ ...prev, classId: classId || undefined }));
  };

  const handleStudentFilterChange = (studentId: string) => {
    setSelectedStudentId(studentId);
    setFilters((prev) => ({ ...prev, studentId: studentId || undefined }));
  };

  const handleCreate = () => {
    setEditingPayment(null);
    setFormData({
      studentId: '',
      classId: '',
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      status: 'pending',
      note: '',
    });
    setShowModal(true);
  };

  const handleEdit = (payment: Payment) => {
    setEditingPayment(payment);
    setFormData({
      studentId: payment.studentId || '',
      classId: payment.classId || '',
      amount: payment.amount || 0,
      date: payment.date || new Date().toISOString().split('T')[0],
      status: payment.status || 'pending',
      note: payment.note || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bạn có chắc muốn xóa thanh toán này?')) return;
    try {
      await deletePayment(id);
      toast.success('Đã xóa thanh toán');
      refetch();
    } catch (err: any) {
      toast.error('Lỗi khi xóa thanh toán: ' + (err.message || 'Lỗi không xác định'));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const paymentData: any = {
        studentId: formData.studentId,
        classId: formData.classId,
        amount: formData.amount,
        date: formData.date,
        status: formData.status,
      };

      if (formData.note) {
        paymentData.note = formData.note.trim();
      }

      if (editingPayment) {
        await updatePayment(editingPayment.id, paymentData);
      } else {
        await createPayment(paymentData);
      }

      setShowModal(false);
      toast.success(editingPayment ? 'Đã cập nhật thanh toán' : 'Đã thêm thanh toán mới');
      refetch();
    } catch (err: any) {
      toast.error('Lỗi khi lưu thanh toán: ' + (err.message || 'Lỗi không xác định'));
    }
  };

  if (error) {
    return (
      <div className="page-container" style={{ padding: 'var(--spacing-6)' }}>
        <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-8)' }}>
          <h2 style={{ color: 'var(--danger)' }}>Lỗi tải dữ liệu</h2>
          <button className="btn btn-primary" onClick={() => refetch()}>
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ padding: 'var(--spacing-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-4)' }}>
        <h2 style={{ margin: 0 }}>Thanh toán</h2>
        <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
          <button className="btn btn-primary" onClick={handleCreate} title="Thêm thanh toán mới">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 'var(--spacing-2)' }}>
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Thêm thanh toán
          </button>
          <button
            className="btn"
            onClick={() => {
            // Export to CSV
            const headers = ['Ngày', 'Học sinh', 'Lớp', 'Số tiền', 'Trạng thái'];
            const rows = filteredPayments.map((payment) => {
              const student = students.find((s) => s.id === payment.studentId);
              const cls = classes.find((c) => c.id === payment.classId);
              return [
                payment.date || '-',
                student?.fullName || '-',
                cls?.name || '-',
                payment.amount.toString(),
                payment.status === 'paid' ? 'Đã thanh toán' : 'Đang chờ',
              ];
            });

            // Create CSV content
            const csvContent = [headers.join(','), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))].join('\n');

            // Download
            const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `payments-${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }}
          title="Xuất báo cáo CSV"
        >
          Export CSV
        </button>
        </div>
      </div>

      {/* Statistics */}
      <div className="payment-summary" style={{ marginBottom: 'var(--spacing-4)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-4)' }}>
          <div className="card" style={{ padding: 'var(--spacing-4)' }}>
            <div style={{ color: 'var(--muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-2)' }}>Tổng doanh thu</div>
            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: '700', color: 'var(--text)' }}>
              {isLoading ? (
                <div className="skeleton-loading" style={{ height: '24px', width: '120px', borderRadius: '4px' }} />
              ) : (
                formatCurrencyVND(stats.total)
              )}
            </div>
          </div>
          <div className="card" style={{ padding: 'var(--spacing-4)' }}>
            <div style={{ color: 'var(--muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-2)' }}>Đã thanh toán</div>
            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: '700', color: '#10b981' }}>
              {isLoading ? (
                <div className="skeleton-loading" style={{ height: '24px', width: '120px', borderRadius: '4px' }} />
              ) : (
                formatCurrencyVND(stats.paid)
              )}
            </div>
          </div>
          <div className="card" style={{ padding: 'var(--spacing-4)' }}>
            <div style={{ color: 'var(--muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-2)' }}>Đang chờ</div>
            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: '700', color: '#f59e0b' }}>
              {isLoading ? (
                <div className="skeleton-loading" style={{ height: '24px', width: '120px', borderRadius: '4px' }} />
              ) : (
                formatCurrencyVND(stats.pending)
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 'var(--spacing-4)', padding: 'var(--spacing-4)' }}>
        <div style={{ display: 'flex', gap: 'var(--spacing-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="filter-group" style={{ flex: '1', minWidth: '150px' }}>
            <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)', fontWeight: '500' }}>
              Trạng thái
            </label>
            <select
              className="form-control"
              value={filters.status || 'all'}
              onChange={(e) => handleStatusFilterChange(e.target.value as 'all' | 'paid' | 'pending')}
            >
              <option value="all">Tất cả</option>
              <option value="paid">Đã thanh toán</option>
              <option value="pending">Đang chờ</option>
            </select>
          </div>
          <div className="filter-group" style={{ flex: '1', minWidth: '150px' }}>
            <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)', fontWeight: '500' }}>
              Lớp học
            </label>
            <select className="form-control" value={selectedClassId} onChange={(e) => handleClassFilterChange(e.target.value)}>
              <option value="">Tất cả lớp</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-group" style={{ flex: '1', minWidth: '150px' }}>
            <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)', fontWeight: '500' }}>
              Học sinh
            </label>
            <select className="form-control" value={selectedStudentId} onChange={(e) => handleStudentFilterChange(e.target.value)}>
              <option value="">Tất cả học sinh</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.fullName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-container" style={{ overflowX: 'auto' }}>
          {isLoading && filteredPayments.length === 0 ? (
            <table className="table-striped" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Ngày</th>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Học sinh</th>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Lớp</th>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'right', borderBottom: '2px solid var(--border)' }}>Số tiền</th>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Trạng thái</th>
                  <th style={{ padding: 'var(--spacing-3)', width: '80px', borderBottom: '2px solid var(--border)' }}></th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td style={{ padding: 'var(--spacing-3)' }}>
                      <div className="skeleton-loading" style={{ height: '16px', width: '100px', borderRadius: '4px' }} />
                    </td>
                    <td style={{ padding: 'var(--spacing-3)' }}>
                      <div className="skeleton-loading" style={{ height: '16px', width: '120px', borderRadius: '4px' }} />
                    </td>
                    <td style={{ padding: 'var(--spacing-3)' }}>
                      <div className="skeleton-loading" style={{ height: '16px', width: '100px', borderRadius: '4px' }} />
                    </td>
                    <td style={{ padding: 'var(--spacing-3)', textAlign: 'right' }}>
                      <div className="skeleton-loading" style={{ height: '16px', width: '100px', marginLeft: 'auto', borderRadius: '4px' }} />
                    </td>
                    <td style={{ padding: 'var(--spacing-3)' }}>
                      <div className="skeleton-loading" style={{ height: '20px', width: '80px', borderRadius: '4px' }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="table-striped" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Ngày</th>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Học sinh</th>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Lớp</th>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'right', borderBottom: '2px solid var(--border)' }}>Số tiền</th>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 'var(--spacing-6)', textAlign: 'center', color: 'var(--muted)' }}>
                      Không có thanh toán nào phù hợp.
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map((payment) => {
                    const student = students.find((s) => s.id === payment.studentId);
                    const cls = classes.find((c) => c.id === payment.classId);
                    return (
                      <tr key={payment.id}>
                        <td style={{ padding: 'var(--spacing-3)', color: 'var(--text)' }}>{payment.date || '-'}</td>
                        <td style={{ padding: 'var(--spacing-3)', color: 'var(--text)' }}>{student?.fullName || '-'}</td>
                        <td style={{ padding: 'var(--spacing-3)', color: 'var(--text)' }}>{cls?.name || '-'}</td>
                        <td style={{ padding: 'var(--spacing-3)', textAlign: 'right', fontWeight: '500', color: 'var(--text)' }}>
                          {formatCurrencyVND(payment.amount)}
                        </td>
                        <td style={{ padding: 'var(--spacing-3)' }}>
                          <span
                            className={`badge ${payment.status === 'paid' ? 'badge-success' : 'badge-warning'}`}
                            style={{
                              padding: 'var(--spacing-1) var(--spacing-2)',
                              borderRadius: 'var(--radius)',
                              fontSize: 'var(--font-size-xs)',
                              fontWeight: '500',
                              background: payment.status === 'paid' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(251, 191, 36, 0.1)',
                              color: payment.status === 'paid' ? '#10b981' : '#f59e0b',
                            }}
                          >
                            {payment.status === 'paid' ? 'Đã thanh toán' : 'Đang chờ'}
                          </span>
                        </td>
                        <td style={{ padding: 'var(--spacing-3)' }} onClick={(e) => e.stopPropagation()}>
                          <div className="crud-actions" style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
                            <button
                              className="btn-edit-icon"
                              onClick={() => handleEdit(payment)}
                              title="Sửa"
                              style={{ padding: '4px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            <button
                              className="btn-delete-icon"
                              onClick={() => handleDelete(payment.id)}
                              title="Xóa"
                              style={{ padding: '4px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      <Modal
        title={editingPayment ? 'Chỉnh sửa thanh toán' : 'Thêm thanh toán mới'}
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        size="md"
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: 'var(--spacing-3)' }}>
            <label htmlFor="paymentStudent" className="form-label">
              Học sinh *
            </label>
            <select
              id="paymentStudent"
              className="form-control"
              value={formData.studentId}
              onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
              required
            >
              <option value="">Chọn học sinh</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.fullName}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--spacing-3)' }}>
            <label htmlFor="paymentClass" className="form-label">
              Lớp học *
            </label>
            <select
              id="paymentClass"
              className="form-control"
              value={formData.classId}
              onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
              required
            >
              <option value="">Chọn lớp</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-3)', marginBottom: 'var(--spacing-3)' }}>
            <div className="form-group">
              <label htmlFor="paymentAmount" className="form-label">
                Số tiền (VND) *
              </label>
              <CurrencyInput
                id="paymentAmount"
                className="form-control"
                value={formData.amount}
                onChange={(value) => {
                  setFormData({ ...formData, amount: value });
                }}
                required
                placeholder="0"
              />
            </div>

            <div className="form-group">
              <label htmlFor="paymentDate" className="form-label">
                Ngày thanh toán *
              </label>
              <input
                type="date"
                id="paymentDate"
                className="form-control"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--spacing-3)' }}>
            <label htmlFor="paymentStatus" className="form-label">
              Trạng thái
            </label>
            <select
              id="paymentStatus"
              className="form-control"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as 'paid' | 'pending' })}
            >
              <option value="pending">Đang chờ</option>
              <option value="paid">Đã thanh toán</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--spacing-3)' }}>
            <label htmlFor="paymentNote" className="form-label">
              Ghi chú
            </label>
            <textarea
              id="paymentNote"
              className="form-control"
              rows={3}
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              placeholder="Ghi chú về thanh toán (tùy chọn)"
            />
          </div>

          <div className="form-actions" style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'flex-end', marginTop: 'var(--spacing-4)' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
              Hủy
            </button>
            <button type="submit" className="btn btn-primary">
              {editingPayment ? 'Cập nhật' : 'Tạo mới'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default Payments;
