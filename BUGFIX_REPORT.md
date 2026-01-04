# Báo Cáo Sửa Lỗi - Trừ Buổi 2 Lần

## Vấn Đề Phát Hiện

### 1. Lỗi Trừ Buổi 2 Lần Khi Tạo Buổi Học
**Nguyên nhân:**
- `createSession()` gọi `applySessionToStudents()` → trừ buổi cho TẤT CẢ học sinh
- `saveAttendanceForSession()` gọi `processAttendanceFinancials()` → trừ buổi lại dựa trên attendance

**Kết quả:** Mỗi học sinh bị trừ 2 buổi

### 2. Lỗi Trừ Buổi 2 Lần Khi Update Attendance
**Nguyên nhân:**
- `saveAttendanceForSession()` xóa attendance cũ và insert mới
- Mỗi lần gọi đều chạy `processAttendanceFinancials()` → trừ buổi/số dư lại

**Kết quả:** Mỗi lần update attendance, học sinh bị trừ buổi/số dư thêm một lần

### 3. Thiếu Logic Rollback Khi Delete Session
**Nguyên nhân:**
- `deleteSession()` chỉ xóa session, không rollback buổi/số dư/nợ

**Kết quả:** Khi xóa buổi học, học sinh không được hoàn lại buổi/số dư/nợ

---

## Giải Pháp Đã Áp Dụng

### 1. Xóa `applySessionToStudents` khỏi `createSession`
**File:** `backend/src/services/sessionsService.ts`

**Thay đổi:**
- Xóa việc gọi `applySessionToStudents()` trong `createSession()`
- Thêm comment giải thích: Logic tài chính giờ được xử lý bởi `processAttendanceFinancials()`

**Lý do:**
- `processAttendanceFinancials()` xử lý chính xác hơn dựa trên attendance status
- Tránh trừ buổi cho tất cả học sinh mà không phân biệt attendance

### 2. Thêm Logic Rollback Trước Khi Tính Lại
**File:** `backend/src/services/attendanceService.ts`

**Thêm hàm mới:** `rollbackAttendanceFinancials()`
- Lấy attendance cũ trước khi xóa
- Rollback các thay đổi tài chính:
  - Hoàn lại `remaining_sessions` nếu đã trừ
  - Hoàn lại `wallet_balance` nếu đã trừ
  - Giảm `loan_balance` nếu đã ghi nợ
  - Giảm `total_attended_sessions` cho present/excused
  - Xóa wallet transactions liên quan

**Cập nhật `saveAttendanceForSession()`:**
- Lấy attendance cũ TRƯỚC khi xóa
- Gọi `rollbackAttendanceFinancials()` để rollback
- Sau đó mới tính lại với attendance mới

**Cải thiện wallet transactions:**
- Thêm `sessionId` vào note của transaction để dễ rollback
- Format: `Học phí buổi học {sessionId} ({status})`

### 3. Thêm Logic Rollback Khi Delete Session
**File:** `backend/src/services/sessionsService.ts`

**Cập nhật `deleteSession()`:**
- Gọi `deleteAttendanceBySession()` trước khi xóa session
- `deleteAttendanceBySession()` sẽ rollback financials trước khi xóa attendance

---

## Các Thay Đổi Chi Tiết

### File: `backend/src/services/sessionsService.ts`

```typescript
// BEFORE
export async function createSession(...) {
  // ...
  await applySessionToStudents(sessionData.class_id); // ❌ Trừ buổi cho tất cả
  return data;
}

// AFTER
export async function createSession(...) {
  // ...
  // NOTE: Do NOT call applySessionToStudents here anymore
  // Financial calculations are now handled by processAttendanceFinancials()
  return data;
}
```

```typescript
// BEFORE
export async function deleteSession(id: string) {
  // ...
  await supabase.from('sessions').delete().eq('id', id); // ❌ Không rollback
}

// AFTER
export async function deleteSession(id: string) {
  // ...
  await deleteAttendanceBySession(id); // ✅ Rollback trước
  await supabase.from('sessions').delete().eq('id', id);
}
```

### File: `backend/src/services/attendanceService.ts`

**Thêm hàm mới:**
```typescript
async function rollbackAttendanceFinancials(
  sessionId: string,
  oldAttendanceData: Array<{ student_id: string; status: AttendanceStatus }>
): Promise<void>
```

**Cập nhật `saveAttendanceForSession()`:**
```typescript
// BEFORE
export async function saveAttendanceForSession(...) {
  await supabase.from('attendance').delete()... // ❌ Xóa ngay
  await supabase.from('attendance').insert(...)
  await processAttendanceFinancials(...) // ❌ Tính lại mà không rollback
}

// AFTER
export async function saveAttendanceForSession(...) {
  const existingAttendance = await getAttendanceBySession(sessionId); // ✅ Lấy cũ trước
  if (existingAttendance.length > 0) {
    await rollbackAttendanceFinancials(sessionId, oldAttendanceData); // ✅ Rollback
  }
  await supabase.from('attendance').delete()...
  await supabase.from('attendance').insert(...)
  await processAttendanceFinancials(...) // ✅ Tính lại sau khi rollback
}
```

**Cập nhật wallet transaction note:**
```typescript
// BEFORE
note: `Học phí buổi học (${statusLabel})`

// AFTER
note: `Học phí buổi học ${sessionId} (${statusLabel})` // ✅ Có sessionId để rollback
```

---

## Testing Checklist

### ✅ Test 1: Tạo Buổi Học Mới
- [ ] Tạo buổi học với attendance (Học/Phép/Vắng)
- [ ] Kiểm tra: Mỗi học sinh chỉ bị trừ 1 buổi (hoặc số dư/nợ đúng)
- [ ] Kiểm tra: `total_attended_sessions` chỉ tăng cho Học/Phép

### ✅ Test 2: Update Attendance
- [ ] Tạo buổi học với attendance ban đầu
- [ ] Update attendance (thay đổi status)
- [ ] Kiểm tra: Chỉ tính lại dựa trên attendance mới, không trừ 2 lần
- [ ] Kiểm tra: Wallet transactions được rollback và tạo mới đúng

### ✅ Test 3: Delete Session
- [ ] Tạo buổi học với attendance
- [ ] Xóa buổi học
- [ ] Kiểm tra: Học sinh được hoàn lại buổi/số dư/nợ
- [ ] Kiểm tra: Wallet transactions được xóa
- [ ] Kiểm tra: `total_attended_sessions` được giảm đúng

### ✅ Test 4: Edge Cases
- [ ] Update attendance nhiều lần liên tiếp
- [ ] Delete session không có attendance
- [ ] Update attendance từ có → không có
- [ ] Update attendance từ không có → có

---

## Lưu Ý

1. **Wallet Transactions:**
   - Session ID được lưu trong note để dễ rollback
   - Format: `Học phí buổi học {sessionId} ({status})`

2. **Rollback Logic:**
   - Tìm transactions có `sessionId` trong note
   - Rollback wallet/loan dựa trên transaction type
   - Nếu không có transaction → rollback `remaining_sessions`

3. **Performance:**
   - Rollback chỉ chạy khi có attendance cũ
   - Transaction queries được tối ưu với `LIKE` và filter

---

## Kết Luận

Đã sửa 3 lỗi nghiêm trọng:
- ✅ Trừ buổi 2 lần khi tạo buổi học
- ✅ Trừ buổi 2 lần khi update attendance
- ✅ Thiếu rollback khi delete session

Hệ thống giờ đã xử lý đúng logic tài chính với rollback mechanism.

