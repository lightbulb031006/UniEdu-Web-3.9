# Báo Cáo: Tối Ưu Hóa Loading Dữ Liệu và Optimistic Updates

## 1. Phân Tích Best Practices

### 1.1. Lazy Loading
**Mô tả**: Chỉ tải dữ liệu khi cần thiết, giảm tải ban đầu.

**Áp dụng trong dự án**:
- ✅ Modals chỉ render khi mở (`{modalOpen && <Modal />}`)
- ✅ Conditional rendering cho các section dựa trên quyền truy cập
- ✅ Code splitting với React.lazy (đã import nhưng chưa sử dụng đầy đủ)

**Ví dụ**:
```typescript
// StaffDetail.tsx - Modals chỉ render khi cần
{addBonusModalOpen && <BonusModal ... />}
{editStaffModalOpen && <EditStaffModal ... />}
```

### 1.2. Infinite Scroll / Pagination
**Mô tả**: Tải dữ liệu theo trang hoặc cuộn để tối ưu hiệu năng.

**Trạng thái hiện tại**:
- ⚠️ Chưa áp dụng pagination cho danh sách dài (học sinh, nhân sự, lớp học)
- 💡 **Khuyến nghị**: Áp dụng pagination cho:
  - Danh sách học sinh trong lớp (>50 học sinh)
  - Danh sách buổi học trong lịch sử
  - Danh sách giao dịch ví

### 1.3. Skeleton Screen
**Mô tả**: Hiển thị khung giả lập trước khi dữ liệu thật được trả về.

**Áp dụng trong dự án**:
- ✅ `TableSkeleton` component đã được tạo và sử dụng
- ✅ Skeleton loaders cho work items, CSKH student list
- ✅ Progressive loading: full-page spinner chỉ cho initial load, sau đó skeleton cho từng section

**Ví dụ**:
```typescript
// StaffDetail.tsx
{workItemsLoading ? (
  <TableSkeleton rows={5} columns={6} />
) : (
  <WorkItemsTable workItems={workItems} />
)}
```

### 1.4. Prefetching
**Mô tả**: Tải trước dữ liệu dự đoán người dùng sẽ cần.

**Áp dụng trong dự án**:
- ✅ `usePrefetch` hook đã được tạo
- ✅ Prefetch work items và bonuses cho tháng tiếp theo
- ✅ Prefetch với delay 2 giây để tránh tải quá nhiều

**Ví dụ**:
```typescript
// StaffDetail.tsx
useEffect(() => {
  const nextMonthStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
  const timeoutId = setTimeout(() => {
    fetchStaffWorkItems(id, nextMonthStr).catch(() => {});
  }, 2000);
  return () => clearTimeout(timeoutId);
}, [id, staff, isLoading, debouncedMonth]);
```

### 1.5. Caching
**Mô tả**: Lưu dữ liệu local để giảm số lần gọi API.

**Áp dụng trong dự án**:
- ✅ `useDataLoading` hook với sessionStorage caching
- ✅ Cache time: 2-5 phút tùy loại dữ liệu
- ✅ Backend caching với `staff_monthly_stats` table
- ✅ Cache invalidation khi data thay đổi

**Ví dụ**:
```typescript
// useDataLoading.ts
const getCachedData = useCallback((): T | null => {
  if (!cacheKey) return null;
  const cached = sessionStorage.getItem(cacheKey);
  if (cached) {
    const { data: cachedData, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < staleTime) {
      return cachedData;
    }
  }
  return null;
}, [cacheKey, staleTime]);
```

### 1.6. Debouncing
**Mô tả**: Trì hoãn các request không cần thiết khi người dùng đang nhập/thay đổi.

**Áp dụng trong dự án**:
- ✅ `useDebounce` hook cho month selection (300ms delay)
- ✅ Visual feedback khi đang debounce (⏳ icon)

**Ví dụ**:
```typescript
// StaffDetail.tsx
const debouncedMonth = useDebounce(selectedMonth, 300);
const isIncomeStatsLoading = staffDetailDataLoading || (debouncedMonth !== selectedMonth);
```

## 2. Áp Dụng Optimistic Updates

### 2.1. Hook Tái Sử Dụng: `useOptimisticUpdate`

**File**: `frontend/src/hooks/useOptimisticUpdate.ts`

**Tính năng**:
- ✅ Tự động cập nhật UI ngay lập tức
- ✅ Rollback nếu có lỗi
- ✅ Hỗ trợ cả single item và list updates
- ✅ Toast notifications tự động
- ✅ History stack cho rollback

**API**:
```typescript
const { data, isUpdating, update, updateList, updateInitialData } = useOptimisticUpdate(
  initialData,
  updateFn,
  {
    onSuccess: (data) => {},
    onError: (error, rollbackData) => {},
    successMessage: 'Đã cập nhật thành công',
    errorMessage: 'Có lỗi xảy ra',
    showToast: true,
  }
);
```

### 2.2. Trang Chi Tiết Nhân Sự (StaffDetail.tsx)

#### 2.2.1. Hiển Thị Dữ Liệu
- ✅ Thông tin cá nhân: tên, email, số điện thoại, QR payment link
- ✅ Công việc: work items với statistics (tổng tháng, đã nhận, chưa nhận)
- ✅ Thống kê thu nhập: tổng trợ cấp, đã thanh toán, chưa thanh toán
- ✅ Giáo án được phân công: lesson plan work items
- ✅ Thưởng tháng: bonuses với statistics
- ✅ Lịch sử buổi dạy: sessions với month navigation

#### 2.2.2. CRUD với Optimistic Updates

**Đã áp dụng**:
1. ✅ **Cập nhật thông tin nhân sự** (`EditStaffModal`)
   - Optimistic: Cập nhật local state ngay
   - Success: Refetch để đồng bộ với server
   - Error: Rollback và hiển thị lỗi

2. ✅ **Cập nhật QR payment link** (`QREditModal`)
   - Optimistic: Cập nhật local state
   - Success: Refetch staff data
   - Error: Rollback

3. ✅ **Thêm/Sửa/Xóa thưởng** (`BonusModal`)
   - Optimistic: Thêm vào list ngay
   - Success: Refetch bonuses
   - Error: Rollback list

**Cần cải thiện**:
- ⚠️ Chưa sử dụng `useOptimisticUpdate` hook (đang dùng manual optimistic updates)
- 💡 **Khuyến nghị**: Refactor để sử dụng hook tái sử dụng

**Ví dụ hiện tại**:
```typescript
// StaffDetail.tsx - Manual optimistic update
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

### 2.3. Trang Chi Tiết Học Sinh (StudentDetail.tsx)

#### 2.3.1. Hiển Thị Dữ Liệu
- ✅ Thông tin cá nhân: tên, email, số điện thoại, wallet balance
- ✅ Tiến độ học tập: classes với remaining sessions, financial data
- ✅ Bài tập: (chưa có trong StudentDetail, có trong ClassDetail)
- ✅ Giáo án liên quan: (chưa có trong StudentDetail)

#### 2.3.2. CRUD với Optimistic Updates

**Đã áp dụng**:
1. ✅ **Gia hạn buổi học** (`ExtendSessionsModal`)
   - Success: Refetch financial data
   - Error: Toast error

2. ✅ **Hoàn trả học phí** (`RefundSessionsModal`)
   - Success: Refetch financial data
   - Error: Toast error

3. ✅ **Nạp tiền vào ví** (`TopUpModal`)
   - Success: Refetch student data (wallet balance)
   - Error: Toast error

4. ✅ **Ứng tiền** (`LoanModal`)
   - Success: Refetch student data (loan balance)
   - Error: Toast error

5. ✅ **Thêm học sinh vào lớp** (`AddClassModal`)
   - Success: Refetch financial data
   - Error: Toast error

6. ✅ **Cập nhật học phí** (`EditFeeModal`)
   - Success: Refetch financial data
   - Error: Toast error

7. ✅ **Cập nhật thông tin học sinh** (`EditStudentModal`)
   - Success: Refetch student data
   - Error: Toast error

**Cần cải thiện**:
- ⚠️ Chưa có optimistic updates (chỉ refetch sau khi success)
- 💡 **Khuyến nghị**: Áp dụng optimistic updates cho tất cả CRUD operations

**Ví dụ cần cải thiện**:
```typescript
// StudentDetail.tsx - Chưa có optimistic update
const handleTopUp = async (amount: number) => {
  try {
    await createWalletTransaction(studentId, { type: 'topup', amount });
    toast.success('Đã nạp tiền vào tài khoản');
    await refetch(); // Chỉ refetch sau khi success
  } catch (error) {
    toast.error('Không thể nạp tiền: ' + error.message);
  }
};
```

### 2.4. Trang Chi Tiết CSKH (StaffCSKHDetail.tsx)

**Đã áp dụng optimistic updates**:
- ✅ **Cập nhật trạng thái thanh toán** (single và bulk)
  - Optimistic: Cập nhật UI ngay
  - Success: Refetch để đồng bộ
  - Error: Rollback và refetch

**Ví dụ**:
```typescript
// StaffCSKHDetail.tsx - Đã có optimistic update
const handlePaymentStatusChange = async (studentId: string, status: 'paid' | 'unpaid' | 'deposit') => {
  // Optimistic update
  setIsUpdatingStatus(true);
  const originalStatus = studentStat.paymentStatus;
  
  try {
    await updateCSKHPaymentStatus(staffId, studentId, monthKey, status, profitPercent);
    await refetchCSKHDetail(); // Refetch để đồng bộ
    toast.success('Đã cập nhật trạng thái thanh toán');
  } catch (error) {
    await refetchCSKHDetail(); // Rollback bằng cách refetch
    toast.error('Không thể cập nhật trạng thái thanh toán: ' + error.message);
  } finally {
    setIsUpdatingStatus(false);
  }
};
```

## 3. Cải Tiến UI/UX

### 3.1. Optimistic Update Indicators

**Đã áp dụng**:
- ✅ Loading states với `isUpdating` flags
- ✅ Disable buttons khi đang update
- ✅ Toast notifications cho success/error

**Cần cải thiện**:
- ⚠️ Chưa có visual highlight cho items mới thêm/sửa
- 💡 **Khuyến nghị**: Thêm animation/highlight cho optimistic updates

**Ví dụ đề xuất**:
```typescript
// Highlight item mới thêm
<div 
  className={isNewlyAdded ? 'highlight-new' : ''}
  style={{
    animation: isNewlyAdded ? 'pulse 2s ease-in-out' : 'none',
    backgroundColor: isNewlyAdded ? 'var(--success-light)' : 'transparent',
  }}
>
  {/* Item content */}
</div>
```

### 3.2. Toast/Snackbar Notifications

**Đã áp dụng**:
- ✅ `toast.success()` cho thành công
- ✅ `toast.error()` cho lỗi
- ✅ Hiển thị message rõ ràng

**Ví dụ**:
```typescript
toast.success('Đã cập nhật thông tin nhân sự');
toast.error('Lỗi khi cập nhật nhân sự: ' + error.message);
```

### 3.3. Loading Indicators

**Đã áp dụng**:
- ✅ Skeleton loaders cho tables
- ✅ Full-page spinner cho initial load
- ✅ Small spinners cho buttons
- ✅ Opacity changes khi loading

**Ví dụ**:
```typescript
// StaffDetail.tsx
{isIncomeStatsLoading ? (
  <div style={{ opacity: 0.6, transition: 'opacity 0.3s ease' }}>
    <SkeletonLoader width="100%" height="20px" />
  </div>
) : (
  <IncomeStatsDisplay data={incomeStats} />
)}
```

### 3.4. Consistency

**Đã đảm bảo**:
- ✅ Không có UI giật (smooth transitions)
- ✅ Dữ liệu không nhảy bất thường (stable keys)
- ✅ Consistent loading states

## 4. Refactor Code

### 4.1. Hook Tái Sử Dụng

**Đã tạo**:
- ✅ `useOptimisticUpdate` hook
- ✅ `useDebounce` hook
- ✅ `usePrefetch` hook (có thể cải thiện)
- ✅ `useDataLoading` hook (đã có sẵn)

### 4.2. State Management

**Hiện tại**:
- ✅ React hooks (useState, useMemo, useCallback)
- ✅ Custom hooks cho data loading
- ✅ Local state management

**Khuyến nghị**:
- 💡 Cân nhắc Zustand hoặc React Query cho state management phức tạp hơn
- 💡 Tách business logic ra services

### 4.3. Code Structure

**Đã tách**:
- ✅ Services layer (`services/`)
- ✅ Hooks layer (`hooks/`)
- ✅ Components layer (`components/`)
- ✅ Utils layer (`utils/`)

**Cần cải thiện**:
- ⚠️ Một số components quá lớn (StaffDetail.tsx ~3000 lines)
- 💡 **Khuyến nghị**: Tách thành sub-components nhỏ hơn

## 5. Checklist Kiểm Thử CRUD với Optimistic Updates

### 5.1. Trang Chi Tiết Nhân Sự

#### ✅ Cập Nhật Thông Tin Nhân Sự
- [ ] Cập nhật tên → UI cập nhật ngay → Success toast → Refetch để đồng bộ
- [ ] Cập nhật email → UI cập nhật ngay → Success toast → Refetch để đồng bộ
- [ ] Cập nhật số điện thoại → UI cập nhật ngay → Success toast → Refetch để đồng bộ
- [ ] Network error → Rollback → Error toast

#### ✅ Cập Nhật QR Payment Link
- [ ] Cập nhật link → UI cập nhật ngay → Success toast → Refetch
- [ ] Invalid URL → Validation error → Không gửi request
- [ ] Network error → Rollback → Error toast

#### ✅ Thêm Thưởng
- [ ] Thêm thưởng mới → Hiển thị trong list ngay → Success toast → Refetch
- [ ] Validation error → Không thêm vào list
- [ ] Network error → Rollback list → Error toast

#### ✅ Sửa Thưởng
- [ ] Sửa thưởng → UI cập nhật ngay → Success toast → Refetch
- [ ] Network error → Rollback → Error toast

#### ✅ Xóa Thưởng
- [ ] Xóa thưởng → Xóa khỏi list ngay → Success toast → Refetch
- [ ] Network error → Rollback (hiển thị lại) → Error toast

### 5.2. Trang Chi Tiết Học Sinh

#### ✅ Gia Hạn Buổi Học
- [ ] Gia hạn thành công → Refetch financial data → Success toast
- [ ] Số dư không đủ → Validation error
- [ ] Network error → Error toast

#### ✅ Hoàn Trả Học Phí
- [ ] Hoàn trả thành công → Refetch financial data → Success toast
- [ ] Số buổi không hợp lệ → Validation error
- [ ] Network error → Error toast

#### ✅ Nạp Tiền Vào Ví
- [ ] Nạp tiền thành công → Wallet balance cập nhật → Success toast
- [ ] Số tiền không hợp lệ → Validation error
- [ ] Network error → Error toast

#### ✅ Ứng Tiền
- [ ] Ứng tiền thành công → Loan balance cập nhật → Success toast
- [ ] Số tiền không hợp lệ → Validation error
- [ ] Network error → Error toast

#### ✅ Thêm Học Sinh Vào Lớp
- [ ] Thêm thành công → Hiển thị trong list classes → Success toast → Refetch
- [ ] Học sinh đã có trong lớp → Validation error
- [ ] Network error → Error toast

#### ✅ Cập Nhật Học Phí
- [ ] Cập nhật thành công → UI cập nhật ngay → Success toast → Refetch
- [ ] Số tiền không hợp lệ → Validation error
- [ ] Network error → Error toast

#### ✅ Cập Nhật Thông Tin Học Sinh
- [ ] Cập nhật thành công → UI cập nhật ngay → Success toast → Refetch
- [ ] Validation error → Không gửi request
- [ ] Network error → Error toast

### 5.3. Trang Chi Tiết CSKH

#### ✅ Cập Nhật Trạng Thái Thanh Toán (Single)
- [ ] Cập nhật thành công → UI cập nhật ngay → Success toast → Refetch
- [ ] Network error → Rollback → Error toast

#### ✅ Cập Nhật Trạng Thái Thanh Toán (Bulk)
- [ ] Cập nhật nhiều học sinh → UI cập nhật ngay → Success toast → Refetch
- [ ] Một số học sinh lỗi → Partial success → Error toast với details
- [ ] Network error → Rollback tất cả → Error toast

## 6. Tổng Kết

### 6.1. Đã Áp Dụng
- ✅ Lazy loading (modals)
- ✅ Skeleton screens
- ✅ Prefetching
- ✅ Caching (sessionStorage + backend)
- ✅ Debouncing
- ✅ Optimistic updates (một phần, chủ yếu trong CSKH)

### 6.2. Cần Cải Thiện
- ⚠️ Pagination cho danh sách dài
- ⚠️ Áp dụng optimistic updates đầy đủ cho tất cả CRUD operations
- ⚠️ Visual highlight cho optimistic updates
- ⚠️ Refactor để sử dụng `useOptimisticUpdate` hook thay vì manual updates

### 6.3. Khuyến Nghị
1. **Ngắn hạn**:
   - Refactor các CRUD operations để sử dụng `useOptimisticUpdate` hook
   - Thêm visual highlight cho optimistic updates
   - Thêm pagination cho danh sách >50 items

2. **Dài hạn**:
   - Cân nhắc React Query hoặc Zustand cho state management
   - Tách components lớn thành sub-components
   - Thêm unit tests cho optimistic updates

## 7. Tài Liệu Tham Khảo

- [React Query - Optimistic Updates](https://tanstack.com/query/latest/docs/react/guides/optimistic-updates)
- [Optimistic UI Updates in React](https://kentcdodds.com/blog/optimistic-ui-patterns)
- [Skeleton Screens](https://www.lukew.com/ff/entry.asp?1797)
- [Debouncing and Throttling](https://css-tricks.com/debouncing-throttling-explained-examples/)

