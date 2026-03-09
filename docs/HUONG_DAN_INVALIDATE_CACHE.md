# Hướng Dẫn Invalidate Cache Staff Monthly Stats

## Khi Nào Cần Invalidate Cache?

Cache cần được invalidate (xóa) khi dữ liệu nguồn thay đổi, để đảm bảo tính chính xác của các giá trị đã tính toán.

## Các Trường Hợp Cần Invalidate

### 1. Khi Sessions Thay Đổi

**Khi nào:**
- Tạo session mới
- Cập nhật session (payment_status, allowance_amount, date)
- Xóa session

**Code mẫu:**
```typescript
import { invalidateStaffMonthlyStats } from './services/staffMonthlyStatsService';

// Sau khi tạo/cập nhật/xóa session
const sessionMonth = session.date.slice(0, 7); // Extract YYYY-MM
await invalidateStaffMonthlyStats(session.teacher_id, sessionMonth);

// Nếu session date thay đổi, cần invalidate cả tháng cũ và tháng mới
if (oldDate && oldDate !== session.date) {
  const oldMonth = oldDate.slice(0, 7);
  await invalidateStaffMonthlyStats(session.teacher_id, oldMonth);
}
```

### 2. Khi Bonuses Thay Đổi

**Khi nào:**
- Tạo bonus mới
- Cập nhật bonus (amount, status, month)
- Xóa bonus

**Code mẫu:**
```typescript
// Sau khi tạo/cập nhật/xóa bonus
await invalidateStaffMonthlyStats(bonus.staff_id, bonus.month);

// Nếu month thay đổi, cần invalidate cả tháng cũ
if (oldMonth && oldMonth !== bonus.month) {
  await invalidateStaffMonthlyStats(bonus.staff_id, oldMonth);
}
```

### 3. Khi CSKH Payment Status Thay Đổi

**Khi nào:**
- Cập nhật payment status cho học sinh CSKH
- Bulk update payment status

**Code mẫu:**
```typescript
// Sau khi cập nhật CSKH payment status
await invalidateStaffMonthlyStats(staffId, month);

// Nếu bulk update nhiều tháng
await invalidateStaffMonthlyStatsForMonths(staffId, affectedMonths);
```

### 4. Khi Lesson Plan Outputs Thay Đổi

**Khi nào:**
- Tạo lesson output mới
- Cập nhật lesson output (status, cost, date)
- Xóa lesson output

**Code mẫu:**
```typescript
// Sau khi tạo/cập nhật/xóa lesson output
const outputMonth = output.date.slice(0, 7);
await invalidateStaffMonthlyStats(output.assistant_id, outputMonth);
```

### 5. Khi Class Teachers Thay Đổi

**Khi nào:**
- Thêm teacher vào class
- Xóa teacher khỏi class

**Code mẫu:**
```typescript
// Sau khi thêm/xóa teacher khỏi class
// Cần invalidate tất cả các tháng có sessions của class này
const affectedMonths = await getAffectedMonthsForClass(classId);
for (const month of affectedMonths) {
  await invalidateStaffMonthlyStats(teacherId, month);
}
```

### 6. Khi Wallet Transactions Thay Đổi (CSKH)

**Khi nào:**
- Tạo transaction mới (topup)
- Cập nhật transaction date

**Code mẫu:**
```typescript
// Sau khi tạo/cập nhật wallet transaction
const transactionMonth = transaction.date.slice(0, 7);
// Cần invalidate cache của CSKH staff assigned cho student này
const cskhStaff = await getCSKHStaffForStudent(transaction.student_id);
if (cskhStaff) {
  await invalidateStaffMonthlyStats(cskhStaff.id, transactionMonth);
}
```

## Invalidate Toàn Bộ Năm

Khi tính toán `total_paid_all_time` thay đổi (tổng nhận trong năm), cần invalidate tất cả các tháng trong năm:

```typescript
import { invalidateStaffMonthlyStatsForYear } from './services/staffMonthlyStatsService';

// Khi có thay đổi ảnh hưởng đến tổng nhận trong năm
await invalidateStaffMonthlyStatsForYear(staffId, currentYear);
```

## Best Practices

1. **Invalidate ngay sau khi dữ liệu thay đổi** - không chờ đến lần request tiếp theo
2. **Invalidate cả tháng cũ và tháng mới** - nếu date/month thay đổi
3. **Batch invalidate** - nếu có nhiều tháng bị ảnh hưởng, dùng `invalidateStaffMonthlyStatsForMonths`
4. **Error handling** - invalidate không nên throw error, chỉ log warning
5. **Background job** - có thể chạy job định kỳ để tính lại cache cho các tháng cũ

## Ví Dụ Hoàn Chỉnh

```typescript
// Trong sessionsService.ts
export async function updateSession(sessionId: string, updates: Partial<Session>) {
  // Get old session
  const oldSession = await getSessionById(sessionId);
  
  // Update session
  const updated = await supabase.from('sessions').update(updates).eq('id', sessionId);
  
  // Invalidate cache
  if (oldSession) {
    const oldMonth = oldSession.date.slice(0, 7);
    await invalidateStaffMonthlyStats(oldSession.teacher_id, oldMonth);
  }
  
  if (updates.date) {
    const newMonth = updates.date.slice(0, 7);
    if (newMonth !== oldSession?.date.slice(0, 7)) {
      await invalidateStaffMonthlyStats(oldSession.teacher_id, newMonth);
    }
  }
  
  if (updates.payment_status || updates.allowance_amount) {
    const month = updates.date ? updates.date.slice(0, 7) : oldSession.date.slice(0, 7);
    await invalidateStaffMonthlyStats(oldSession.teacher_id, month);
  }
  
  return updated;
}
```

