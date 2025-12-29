import React, { useState, useCallback } from 'react';
import { useDataLoading } from '../hooks/useDataLoading';
import { fetchCategories, createCategory, updateCategory, deleteCategory, Category } from '../services/categoriesService';
import { toast } from '../utils/toast';

/**
 * Categories Page Component - Phân loại lớp
 * Migrated from backup/assets/js/pages/categories.js
 */

function Categories() {
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategories, setEditingCategories] = useState<Record<number, string>>({});

  const fetchCategoriesFn = useCallback(() => fetchCategories(), []);

  const { data: categories = [], isLoading, error, refetch } = useDataLoading(fetchCategoriesFn, [], {
    cacheKey: 'categories',
    staleTime: 5 * 60 * 1000,
  });

  const handleAdd = async () => {
    const name = newCategoryName.trim();
    if (!name) return;

    try {
      await createCategory({ name });
      setNewCategoryName('');
      toast.success('Đã thêm phân loại mới');
      refetch();
    } catch (error: any) {
      toast.error('Không thể thêm phân loại: ' + (error.message || 'Lỗi không xác định'));
    }
  };

  const handleSave = async (category: Category) => {
    const newName = editingCategories[category.id]?.trim();
    if (!newName || newName === category.name) {
      setEditingCategories((prev) => {
        const next = { ...prev };
        delete next[category.id];
        return next;
      });
      return;
    }

    try {
      await updateCategory(category.id, { name: newName });
      setEditingCategories((prev) => {
        const next = { ...prev };
        delete next[category.id];
        return next;
      });
      toast.success('Đã cập nhật phân loại');
      refetch();
    } catch (error: any) {
      toast.error('Không thể cập nhật phân loại: ' + (error.message || 'Lỗi không xác định'));
    }
  };

  const handleDelete = async (category: Category) => {
    if (!window.confirm('Bạn có chắc muốn xóa phân loại này?')) return;

    try {
      await deleteCategory(category.id);
      toast.success('Đã xóa phân loại');
      refetch();
    } catch (error: any) {
      toast.error('Không thể xóa phân loại: ' + (error.message || 'Lỗi không xác định'));
    }
  };

  const handleEditChange = (categoryId: number, value: string) => {
    setEditingCategories((prev) => ({
      ...prev,
      [categoryId]: value,
    }));
  };

  const handleStartEdit = (category: Category) => {
    setEditingCategories((prev) => ({
      ...prev,
      [category.id]: category.name,
    }));
  };

  return (
    <div className="page-container" style={{ padding: 'var(--spacing-6)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-4)' }}>
        <h2>Phân loại lớp</h2>
        <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
          <input
            className="form-control"
            placeholder="Tên phân loại"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleAdd();
              }
            }}
            style={{ minWidth: '200px' }}
          />
          <button className="btn btn-primary" onClick={handleAdd}>
            Thêm
          </button>
        </div>
      </div>

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
          <div className="table-container" style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', fontWeight: '600' }}>Tên</th>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'right', fontWeight: '600' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan={2} style={{ padding: 'var(--spacing-8)', textAlign: 'center', color: 'var(--muted)' }}>
                      Chưa có phân loại nào.
                    </td>
                  </tr>
                ) : (
                  categories.map((category) => {
                    const isEditing = editingCategories.hasOwnProperty(category.id);
                    const editValue = isEditing ? editingCategories[category.id] : category.name;

                    return (
                      <tr key={category.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: 'var(--spacing-3)' }}>
                          {isEditing ? (
                            <input
                              className="form-control"
                              value={editValue}
                              onChange={(e) => handleEditChange(category.id, e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  handleSave(category);
                                }
                              }}
                              style={{ maxWidth: '300px' }}
                              autoFocus
                            />
                          ) : (
                            <span onClick={() => handleStartEdit(category)} style={{ cursor: 'text', display: 'block', padding: 'var(--spacing-2)' }}>
                              {category.name}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: 'var(--spacing-3)', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'flex-end' }}>
                            {isEditing ? (
                              <>
                                <button className="btn btn-sm" onClick={() => handleSave(category)}>
                                  Lưu
                                </button>
                                <button
                                  className="btn btn-sm"
                                  onClick={() => {
                                    setEditingCategories((prev) => {
                                      const next = { ...prev };
                                      delete next[category.id];
                                      return next;
                                    });
                                  }}
                                >
                                  Hủy
                                </button>
                              </>
                            ) : (
                              <>
                                <button className="btn btn-sm btn-outline" onClick={() => handleStartEdit(category)}>
                                  Sửa
                                </button>
                                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(category)}>
                                  Xóa
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default Categories;
