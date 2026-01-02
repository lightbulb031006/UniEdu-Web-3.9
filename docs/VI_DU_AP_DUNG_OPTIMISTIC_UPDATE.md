# Ví Dụ Áp Dụng Optimistic Update

## 1. Ví Dụ: Nạp Tiền Vào Ví (TopUpModal)

### Trước khi áp dụng (Current Implementation)

```typescript
// StudentDetail.tsx - TopUpModal
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!Number.isFinite(amount) || amount <= 0) {
    toast.error('Số tiền không hợp lệ');
    return;
  }

  setLoading(true);
  try {
    const newWalletBalance = Number(student.walletBalance || 0) + amount;
    await updateStudent(studentId, { walletBalance: newWalletBalance });
    await createWalletTransaction({
      studentId,
      type: 'topup',
      amount: amount,
      note: '',
      date: new Date().toISOString().split('T')[0],
    });
    toast.success('Đã nạp tiền vào tài khoản');
    onSuccess(); // Refetch student data
  } catch (error: any) {
    toast.error('Không thể nạp tiền: ' + (error.response?.data?.error || error.message));
  } finally {
    setLoading(false);
  }
};
```

**Vấn đề**:
- ❌ UI chỉ cập nhật sau khi API thành công
- ❌ Người dùng phải chờ response từ server
- ❌ Không có rollback nếu có lỗi

### Sau khi áp dụng Optimistic Update

```typescript
// StudentDetail.tsx - TopUpModal với useOptimisticUpdate
import { useOptimisticUpdate } from '../hooks/useOptimisticUpdate';

function TopUpModal({ studentId, student, onSuccess, onClose }: TopUpModalProps) {
  const [amount, setAmount] = useState<number>(0);
  
  // Sử dụng optimistic update cho wallet balance
  const { data: optimisticStudent, update: updateStudentOptimistic, isUpdating } = useOptimisticUpdate(
    student,
    async (updatedStudent) => {
      // Update wallet balance
      const newWalletBalance = Number(updatedStudent.walletBalance || 0) + amount;
      const updated = await updateStudent(studentId, { walletBalance: newWalletBalance });
      
      // Create transaction
      await createWalletTransaction({
        studentId,
        type: 'topup',
        amount: amount,
        note: '',
        date: new Date().toISOString().split('T')[0],
      });
      
      return { ...updated, walletBalance: newWalletBalance };
    },
    {
      successMessage: 'Đã nạp tiền vào tài khoản',
      errorMessage: 'Không thể nạp tiền',
      onSuccess: () => {
        onSuccess(); // Refetch để đồng bộ
      },
    }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Số tiền không hợp lệ');
      return;
    }

    // Optimistic update: cập nhật UI ngay lập tức
    const optimisticData = {
      ...optimisticStudent,
      walletBalance: Number(optimisticStudent.walletBalance || 0) + amount,
    };
    
    await updateStudentOptimistic(optimisticData);
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      <div>
        Số dư hiện tại: {formatCurrencyVND(optimisticStudent.walletBalance || 0)}
        {isUpdating && <span style={{ opacity: 0.6 }}> (Đang cập nhật...)</span>}
      </div>
      <div>
        Số dư sau nạp: {formatCurrencyVND((optimisticStudent.walletBalance || 0) + amount)}
      </div>
      <button type="submit" disabled={isUpdating || amount <= 0}>
        {isUpdating ? 'Đang xử lý...' : 'Nạp tiền'}
      </button>
    </form>
  );
}
```

**Cải thiện**:
- ✅ UI cập nhật ngay lập tức
- ✅ Tự động rollback nếu có lỗi
- ✅ Visual feedback với `isUpdating` state
- ✅ Toast notifications tự động

## 2. Ví Dụ: Thêm Thưởng (BonusModal)

### Trước khi áp dụng

```typescript
// StaffDetail.tsx - BonusModal
const handleSaveBonus = useCallback(async () => {
  try {
    if (editingBonus) {
      await updateBonus(editingBonus.id, bonusData);
      toast.success('Đã cập nhật thưởng');
    } else {
      await createBonus(bonusData);
      toast.success('Đã thêm thưởng mới');
    }
    await refetchBonuses(); // Refetch để đồng bộ
    setAddBonusModalOpen(false);
  } catch (error) {
    toast.error('Không thể lưu thưởng: ' + error.message);
  }
}, [editingBonus, bonusData, refetchBonuses]);
```

### Sau khi áp dụng Optimistic Update

```typescript
// StaffDetail.tsx - BonusModal với useOptimisticUpdate
import { useOptimisticUpdate } from '../hooks/useOptimisticUpdate';

function BonusModal({ staffId, month, bonus: editingBonus, bonuses, onSuccess, onClose }: BonusModalProps) {
  const [bonusData, setBonusData] = useState({ /* ... */ });
  
  // Sử dụng optimistic update cho bonuses list
  const { data: optimisticBonuses, updateList, isUpdating } = useOptimisticUpdate(
    bonuses || [],
    async (bonus) => {
      if (editingBonus) {
        return await updateBonus(editingBonus.id, bonus);
      } else {
        return await createBonus(bonus);
      }
    },
    {
      successMessage: editingBonus ? 'Đã cập nhật thưởng' : 'Đã thêm thưởng mới',
      errorMessage: 'Không thể lưu thưởng',
      onSuccess: () => {
        onSuccess(); // Refetch để đồng bộ
      },
    }
  );

  const handleSaveBonus = useCallback(async () => {
    if (editingBonus) {
      // Update existing bonus
      await updateList(
        optimisticBonuses,
        { ...editingBonus, ...bonusData },
        'update',
        async (bonus) => await updateBonus(editingBonus.id, bonus)
      );
    } else {
      // Add new bonus
      const newBonus = {
        id: `temp-${Date.now()}`, // Temporary ID
        ...bonusData,
        staffId,
        month,
      };
      await updateList(
        optimisticBonuses,
        newBonus,
        'add',
        async (bonus) => await createBonus(bonus)
      );
    }
    onClose();
  }, [editingBonus, bonusData, optimisticBonuses, updateList, onClose]);

  return (
    <form onSubmit={handleSaveBonus}>
      {/* Form fields */}
      <div>
        <h3>Danh sách thưởng ({optimisticBonuses.length})</h3>
        {optimisticBonuses.map((bonus) => (
          <div key={bonus.id} style={{ 
            opacity: isUpdating && bonus.id?.toString().startsWith('temp-') ? 0.6 : 1,
            transition: 'opacity 0.3s ease',
          }}>
            {/* Bonus item */}
          </div>
        ))}
      </div>
      <button type="submit" disabled={isUpdating}>
        {isUpdating ? 'Đang lưu...' : editingBonus ? 'Cập nhật' : 'Thêm mới'}
      </button>
    </form>
  );
}
```

**Cải thiện**:
- ✅ Bonus mới hiển thị ngay trong list
- ✅ Visual feedback cho item đang được thêm (opacity)
- ✅ Tự động rollback nếu có lỗi
- ✅ Toast notifications tự động

## 3. Ví Dụ: Cập Nhật Trạng Thái Thanh Toán CSKH (Đã có)

```typescript
// StaffCSKHDetail.tsx - Đã áp dụng optimistic update
const handlePaymentStatusChange = async (studentId: string, status: 'paid' | 'unpaid' | 'deposit') => {
  if (!staffId || isUpdatingStatus) return;
  
  // Optimistic update: update UI immediately
  const studentStat = studentStats.find((s) => s.student.id === studentId);
  if (!studentStat) return;
  
  // Store original state for rollback
  const originalStatus = studentStat.paymentStatus;
  
  // Optimistically update local state
  setStudentStats((prev) =>
    prev.map((s) =>
      s.student.id === studentId
        ? { ...s, paymentStatus: status }
        : s
    )
  );
  setIsUpdatingStatus(true);
  
  try {
    const profitPercent = studentStat.profitPercent;
    await updateCSKHPaymentStatus(staffId, studentId, monthKey, status, profitPercent);
    // Refetch to get updated data from backend
    await refetchCSKHDetail();
    toast.success('Đã cập nhật trạng thái thanh toán');
  } catch (error: any) {
    // Rollback: restore original status
    setStudentStats((prev) =>
      prev.map((s) =>
        s.student.id === studentId
          ? { ...s, paymentStatus: originalStatus }
          : s
      )
    );
    toast.error('Không thể cập nhật trạng thái thanh toán: ' + (error.message || 'Lỗi không xác định'));
    // Refetch to restore correct state
    await refetchCSKHDetail();
  } finally {
    setIsUpdatingStatus(false);
  }
};
```

**Có thể cải thiện bằng hook**:

```typescript
// StaffCSKHDetail.tsx - Sử dụng useOptimisticUpdate hook
import { useOptimisticUpdate } from '../hooks/useOptimisticUpdate';

function StaffCSKHDetail() {
  const [studentStats, setStudentStats] = useState([]);
  
  const { data: optimisticStats, updateList, isUpdating } = useOptimisticUpdate(
    studentStats,
    async (updatedStat) => {
      await updateCSKHPaymentStatus(
        staffId,
        updatedStat.student.id,
        monthKey,
        updatedStat.paymentStatus,
        updatedStat.profitPercent
      );
      return updatedStat;
    },
    {
      successMessage: 'Đã cập nhật trạng thái thanh toán',
      errorMessage: 'Không thể cập nhật trạng thái thanh toán',
      onSuccess: () => {
        refetchCSKHDetail(); // Refetch để đồng bộ
      },
    }
  );

  const handlePaymentStatusChange = async (studentId: string, status: 'paid' | 'unpaid' | 'deposit') => {
    const studentStat = optimisticStats.find((s) => s.student.id === studentId);
    if (!studentStat) return;
    
    const updatedStat = { ...studentStat, paymentStatus: status };
    await updateList(optimisticStats, updatedStat, 'update', async (stat) => {
      await updateCSKHPaymentStatus(
        staffId,
        stat.student.id,
        monthKey,
        stat.paymentStatus,
        stat.profitPercent
      );
      return stat;
    });
  };

  return (
    <div>
      {optimisticStats.map((stat) => (
        <div key={stat.student.id} style={{
          opacity: isUpdating ? 0.7 : 1,
          transition: 'opacity 0.3s ease',
        }}>
          {/* Student stat display */}
        </div>
      ))}
    </div>
  );
}
```

## 4. Best Practices

### 4.1. Khi Nào Sử Dụng Optimistic Updates

✅ **Nên sử dụng khi**:
- Thao tác có khả năng thành công cao (>90%)
- Response time dự kiến >200ms
- UX quan trọng hơn accuracy tạm thời
- Có thể rollback dễ dàng

❌ **Không nên sử dụng khi**:
- Thao tác quan trọng (xóa dữ liệu, thanh toán)
- Validation phức tạp cần server
- Conflict resolution phức tạp

### 4.2. Visual Feedback

```typescript
// Highlight item đang được update
<div style={{
  opacity: isUpdating ? 0.6 : 1,
  backgroundColor: isUpdating ? 'var(--warning-light)' : 'transparent',
  transition: 'all 0.3s ease',
  animation: isUpdating ? 'pulse 1.5s ease-in-out infinite' : 'none',
}}>
  {/* Content */}
</div>

// Disable buttons khi đang update
<button disabled={isUpdating}>
  {isUpdating ? 'Đang xử lý...' : 'Lưu'}
</button>

// Loading indicator
{isUpdating && (
  <div className="loading-spinner" style={{ position: 'absolute', top: '50%', left: '50%' }}>
    <Spinner size="small" />
  </div>
)}
```

### 4.3. Error Handling

```typescript
const { data, update, isUpdating } = useOptimisticUpdate(
  initialData,
  updateFn,
  {
    onError: (error, rollbackData) => {
      // Custom error handling
      console.error('Update failed:', error);
      // Additional rollback logic if needed
      if (error.response?.status === 409) {
        toast.error('Dữ liệu đã bị thay đổi. Vui lòng làm mới trang.');
      }
    },
  }
);
```

## 5. Testing Checklist

### 5.1. Unit Tests

```typescript
// useOptimisticUpdate.test.ts
describe('useOptimisticUpdate', () => {
  it('should update UI immediately', async () => {
    // Test optimistic update
  });
  
  it('should rollback on error', async () => {
    // Test rollback
  });
  
  it('should call onSuccess callback', async () => {
    // Test success callback
  });
  
  it('should call onError callback', async () => {
    // Test error callback
  });
});
```

### 5.2. Integration Tests

```typescript
// StudentDetail.test.tsx
describe('StudentDetail - TopUpModal', () => {
  it('should update wallet balance optimistically', async () => {
    // Test optimistic update
  });
  
  it('should rollback on API error', async () => {
    // Test rollback
  });
});
```

### 5.3. E2E Tests

```typescript
// cypress/integration/student-detail.spec.ts
describe('Student Detail - Optimistic Updates', () => {
  it('should update wallet balance immediately when top up', () => {
    // E2E test
  });
});
```

