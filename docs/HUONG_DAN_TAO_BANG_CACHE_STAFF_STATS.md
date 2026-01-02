# Hướng Dẫn Tạo Bảng Cache Staff Monthly Stats

## Mục đích

Bảng `staff_monthly_stats` được tạo để lưu trữ các giá trị đã tính toán sẵn cho trang chi tiết nhân sự, giúp tối ưu hóa hiệu suất và giảm thời gian tính toán.

## Cấu trúc Bảng

### Các cột chính:

1. **Bảng các lớp dạy (classes)** - chỉ cho teacher:
   - `classes_total_month`: Tổng tháng từ các lớp dạy
   - `classes_total_paid`: Đã nhận từ các lớp dạy
   - `classes_total_unpaid`: Chưa nhận từ các lớp dạy (2 tháng: tháng trước + tháng này)

2. **Bảng công việc (work_items)** - cho tất cả staff:
   - `work_items_total_month`: Tổng tháng từ công việc
   - `work_items_total_paid`: Đã nhận từ công việc
   - `work_items_total_unpaid`: Chưa nhận từ công việc (2 tháng)

3. **Bảng thưởng (bonuses)** - cho tất cả staff:
   - `bonuses_total_month`: Tổng tháng từ thưởng
   - `bonuses_total_paid`: Đã nhận từ thưởng
   - `bonuses_total_unpaid`: Chưa nhận từ thưởng (2 tháng)

4. **Tổng hợp (aggregated)**:
   - `total_month_all`: Tổng trợ cấp tháng (tất cả các bảng)
   - `total_paid_all`: Đã thanh toán (tất cả các bảng)
   - `total_unpaid_all`: Chưa thanh toán (tất cả các bảng, 2 tháng)
   - `total_paid_all_time`: Tổng nhận từ trước (trong năm hiện tại)

## Cách Sử Dụng

### 1. Chạy Migration

```sql
-- Chạy file migration trong Supabase SQL Editor
-- File: supabase/migrations/create_staff_monthly_stats.sql
```

### 2. Logic Cập Nhật Cache

Cache cần được cập nhật khi:
- **Sessions** được tạo/cập nhật/xóa (thay đổi `payment_status`, `allowance_amount`)
- **Work items** thay đổi (CSKH payment status, Lesson Plan outputs)
- **Bonuses** được tạo/cập nhật/xóa
- **Classes** được thêm/xóa khỏi teacher

### 3. Khi Nào Cần Tính Lại Cache

Cache cần được tính lại (recalculate) khi:
- Dữ liệu nguồn thay đổi (sessions, work items, bonuses)
- Logic tính toán thay đổi (tăng `version` để invalidate toàn bộ cache)
- Cache quá cũ (có thể set TTL)

### 4. Strategy Cập Nhật

**Option 1: Real-time Update (Recommended)**
- Cập nhật cache ngay khi dữ liệu thay đổi
- Sử dụng database triggers hoặc application logic
- Đảm bảo consistency cao

**Option 2: Background Job**
- Chạy job định kỳ (ví dụ: mỗi giờ) để tính lại cache
- Đơn giản hơn nhưng có thể không real-time

**Option 3: Lazy Calculation**
- Tính toán khi cần (on-demand)
- Lưu kết quả vào cache
- Phù hợp cho dữ liệu ít thay đổi

## Ví Dụ Code

### Đọc từ Cache:

```typescript
// Backend: staffService.ts
async function getStaffMonthlyStats(staffId: string, month: string) {
  const { data, error } = await supabase
    .from('staff_monthly_stats')
    .select('*')
    .eq('staff_id', staffId)
    .eq('month', month)
    .single();
  
  if (error || !data) {
    // Cache miss - tính toán và lưu vào cache
    return await calculateAndCacheStats(staffId, month);
  }
  
  // Kiểm tra version (nếu logic thay đổi)
  if (data.version < CURRENT_VERSION) {
    return await calculateAndCacheStats(staffId, month);
  }
  
  return data;
}
```

### Cập Nhật Cache:

```typescript
async function updateStaffMonthlyStats(
  staffId: string, 
  month: string, 
  stats: StaffMonthlyStats
) {
  const id = `SMS${staffId}-${month}`;
  
  await supabase
    .from('staff_monthly_stats')
    .upsert({
      id,
      staff_id: staffId,
      month,
      ...stats,
      last_updated_at: new Date().toISOString(),
      version: CURRENT_VERSION,
    });
}
```

## Lưu Ý

1. **Consistency**: Đảm bảo cache luôn đồng bộ với dữ liệu nguồn
2. **Versioning**: Sử dụng `version` để invalidate cache khi logic thay đổi
3. **Performance**: Indexes đã được tạo để tối ưu queries
4. **Cleanup**: Có thể xóa cache cũ (> 1 năm) để tiết kiệm không gian

## Migration Path

1. Tạo bảng `staff_monthly_stats`
2. Cập nhật backend logic để sử dụng cache
3. Tạo triggers/jobs để cập nhật cache tự động
4. Monitor performance và adjust nếu cần

