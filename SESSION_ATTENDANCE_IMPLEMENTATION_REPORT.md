# Báo Cáo Triển Khai: Hệ Thống Điểm Danh & Tính Toán Học Phí

## Tổng Quan

Báo cáo này tóm tắt các thay đổi và cải tiến đã được triển khai cho hệ thống điểm danh và tính toán học phí trong trang chi tiết lớp học.

---

## 1. Thay Đổi UI/UX - Role-Based Access Control

### 1.1. Ẩn Số Buổi Còn Lại (Remaining Sessions)
- **Vị trí:** Bảng danh sách học sinh trong trang chi tiết lớp
- **Logic:** 
  - Admin: Hiển thị cột "Còn lại" với số buổi còn lại của từng học sinh
  - Nhân sự (staff): Ẩn hoàn toàn cột "Còn lại"
- **File thay đổi:** `frontend/src/pages/ClassDetail.tsx`
- **Implementation:**
  ```typescript
  const showStudentRemainingSessions = isAdmin;
  // Conditional rendering based on showStudentRemainingSessions
  ```

### 1.2. Hiển Thị Học Phí (Tuition Fee)
- **Vị trí:** Form tạo/chỉnh sửa buổi học
- **Logic:**
  - Admin: Hiển thị trường "Học phí" (tuition_fee) trong form
  - Nhân sự: Không hiển thị trường này
  - Backend: Chỉ trả về `tuition_fee` nếu `user.role === 'admin'`
- **Files thay đổi:**
  - `frontend/src/pages/ClassDetail.tsx` (AddSessionModal, EditSessionModal)
  - `backend/src/services/sessionsService.ts` (getSessions, getSessionById)
  - `backend/src/routes/sessions.ts` (pass user role to service)

---

## 2. Hệ Thống Điểm Danh 3 Trạng Thái

### 2.1. Icon & Màu Sắc
- **Học (Present):** ✅ Icon tích xanh (#10b981)
- **Phép (Excused):** ✅ Icon tích vàng (#f59e0b) 
- **Vắng (Absent):** ❌ Icon X đỏ (#ef4444)

### 2.2. Component AttendanceIcon
- **File:** `frontend/src/components/AttendanceIcon.tsx`
- **Chức năng:**
  - Hiển thị icon và màu sắc phù hợp với từng trạng thái
  - Tooltip rõ ràng: "Đi học", "Nghỉ có phép", "Vắng mặt"
  - Responsive và có animation mượt mà

---

## 3. Trường Học Phí (Tuition Fee)

### 3.1. Database Migration
- **File:** `supabase/migrations/add_session_tuition_fee.sql`
- **Thay đổi:**
  ```sql
  ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS tuition_fee INTEGER;
  ```
- **Mô tả:** Lưu số tiền học phí học sinh đóng cho buổi học đó

### 3.2. Frontend Implementation
- **AddSessionModal:**
  - Trường `tuitionFee` (number | undefined)
  - Auto-calculate dựa trên attendance (present + excused)
  - Hiển thị ước tính ở header modal (màu xanh)
  - Chỉ admin mới thấy và chỉnh sửa được
- **EditSessionModal:**
  - Prefill `tuitionFee` từ session hiện tại
  - Cho phép chỉnh sửa thủ công
  - Chỉ admin mới thấy

### 3.3. Backend Implementation
- **Role-based filtering:** Chỉ trả về `tuition_fee` nếu user là admin
- **Storage:** Lưu `tuition_fee` khi tạo/cập nhật session

---

## 4. Logic Tính Toán Học Phí & Nợ

### 4.1. Backend Service: `processAttendanceFinancials`

**File:** `backend/src/services/attendanceService.ts`

#### 4.1.1. Học (Present)
- ✅ Nếu còn số buổi gia hạn → trừ 1 buổi gia hạn
- ✅ Nếu không còn → trừ vào số dư (`wallet_balance`)
- ✅ Nếu số dư hết → cộng nợ (`loan_balance`) = học phí 1 buổi
- ✅ Tính cho gia sư: 1 học sinh gia hạn (weighted count = 1)
- ✅ Tăng `total_attended_sessions`

#### 4.1.2. Phép (Excused)
- ✅ Nếu còn số buổi gia hạn → trừ 1 buổi gia hạn
- ✅ Nếu không còn → trừ vào số dư
- ✅ **Validation:** Không cho chọn nếu `walletBalance === 0` và `remainingSessions === 0`
- ✅ Tính cho gia sư: 0.5 học sinh gia hạn (weighted count = 0.5)
- ✅ Tăng `total_attended_sessions`

#### 4.1.3. Vắng (Absent) - **CẬP NHẬT MỚI**
- ✅ Nếu còn số buổi gia hạn → trừ 1 buổi gia hạn
- ✅ Nếu không còn → trừ vào số dư
- ✅ Nếu số dư hết → cộng nợ = học phí 1 buổi
- ❌ **KHÔNG** tăng `total_attended_sessions`
- ❌ **KHÔNG** tính cho gia sư (weighted count = 0)

### 4.2. Tính Học Phí Từng Học Sinh
- **Priority:**
  1. `student_tuition_per_session` (từ `student_classes`)
  2. Tính từ `student_fee_total / student_fee_sessions`
  3. Fallback: `session.tuition_fee / số học sinh eligible`

### 4.3. Wallet Transactions
- Tạo transaction cho mỗi giao dịch:
  - Type: `extend` (trừ số dư) hoặc `loan` (ghi nợ)
  - Note: Ghi rõ trạng thái (Học/Phép/Vắng)

---

## 5. Optimistic UI Updates

### 5.1. Implementation
- **State management:**
  ```typescript
  const [optimisticSessions, setOptimisticSessions] = useState<Session[]>([]);
  const [optimisticOperations, setOptimisticOperations] = useState<Set<string>>(new Set());
  ```

### 5.2. Create Session
- ✅ Thêm session vào UI ngay lập tức
- ✅ Gửi request lên DB
- ✅ Sync lại khi DB trả về
- ✅ Rollback nếu có lỗi

### 5.3. Update Session
- ✅ Cập nhật UI ngay lập tức
- ✅ Sync với DB response
- ✅ Rollback nếu lỗi

### 5.4. Delete Session
- ✅ Xóa khỏi UI ngay lập tức
- ✅ Sync với DB response
- ✅ Rollback nếu lỗi

---

## 6. Code Refactoring

### 6.1. Hook: `useSessionFinancials`
**File:** `frontend/src/hooks/useSessionFinancials.ts`

**Chức năng:**
- Tính `weightedCount` (present = 1, excused = 0.5)
- Tính `estimatedTuitionFee` (tổng học phí present + excused)
- Tính `allowancePreview` (trợ cấp gia sư)

**Helper Functions:**
- `calculateWeightedCount()`
- `calculateEstimatedTuitionFee()`
- `calculateAllowance()`

**Lợi ích:**
- ✅ Tái sử dụng logic
- ✅ Dễ bảo trì
- ✅ Nhất quán giữa Add và Edit modal

### 6.2. Hook: `useAttendance` (Cải Tiến)
**File:** `frontend/src/hooks/useAttendance.ts`

**Tính năng mới:**
- Validation cho trạng thái "excused"
- Options: `validateExcused`, `onValidationError`
- Tự động skip "excused" nếu không đủ điều kiện

### 6.3. Component: `AttendanceIcon`
- Chuẩn hóa icon, màu sắc, tooltip
- Animation mượt mà khi chuyển đổi trạng thái

---

## 7. Công Thức Tính Trợ Cấp

### 7.1. Hiển Thị Công Thức
**Vị trí:** Dưới ô ước tính trợ cấp trong form buổi học

**Format:**
```
Học sinh: 2 × 1 + 1 × 0.5 = 2.5
Trợ cấp: (150.000 ₫ × 1 × 2.5) + 0 ₫ = 375.000 ₫
```

**Logic:**
- **Học sinh:** Hiển thị công thức tính weighted count
- **Trợ cấp:** Hiển thị công thức tính tiền trợ cấp
  - Base allowance × Coefficient × Weighted count
  - + Scale amount (nếu có)
  - = Kết quả cuối cùng

---

## 8. Checklist Kiểm Thử

### 8.1. Role-Based UI
- [ ] **Ẩn số buổi với nhân sự:**
  - Đăng nhập bằng tài khoản nhân sự
  - Vào trang chi tiết lớp
  - Kiểm tra: Cột "Còn lại" không hiển thị
  - Đăng nhập bằng admin: Cột "Còn lại" hiển thị bình thường

- [ ] **Học phí chỉ hiển thị với admin:**
  - Đăng nhập bằng nhân sự
  - Mở form thêm/chỉnh sửa buổi học
  - Kiểm tra: Không thấy trường "Học phí"
  - Đăng nhập bằng admin: Trường "Học phí" hiển thị

### 8.2. Điểm Danh 3 Trạng Thái
- [ ] **Icon và màu sắc:**
  - Học: Icon tích xanh
  - Phép: Icon tích vàng
  - Vắng: Icon X đỏ
  - Tooltip hiển thị đúng

- [ ] **Toggle attendance:**
  - Click vào icon điểm danh
  - Kiểm tra: Chuyển đổi mượt mà giữa 3 trạng thái
  - Animation không bị giật

### 8.3. Logic Tính Toán Học Phí & Nợ

- [ ] **Học (Present):**
  - Học sinh có remaining sessions > 0
  - Chọn "Học" → Kiểm tra: remaining sessions giảm 1
  - Học sinh không còn remaining sessions, có wallet balance
  - Chọn "Học" → Kiểm tra: wallet balance giảm đúng học phí
  - Học sinh không còn remaining sessions, wallet balance = 0
  - Chọn "Học" → Kiểm tra: loan balance tăng đúng học phí
  - Kiểm tra: total_attended_sessions tăng 1
  - Kiểm tra: Teacher allowance tính đúng (weighted count = 1)

- [ ] **Phép (Excused):**
  - Học sinh có remaining sessions > 0
  - Chọn "Phép" → Kiểm tra: remaining sessions giảm 1
  - Học sinh không còn remaining sessions, có wallet balance
  - Chọn "Phép" → Kiểm tra: wallet balance giảm đúng học phí
  - Học sinh không còn remaining sessions, wallet balance = 0
  - Chọn "Phép" → Kiểm tra: loan balance tăng đúng học phí
  - **Validation:** Học sinh remaining sessions = 0, wallet balance = 0
  - Chọn "Phép" → Kiểm tra: Hiển thị lỗi, không cho chọn
  - Kiểm tra: total_attended_sessions tăng 1
  - Kiểm tra: Teacher allowance tính đúng (weighted count = 0.5)

- [ ] **Vắng (Absent):**
  - Học sinh có remaining sessions > 0
  - Chọn "Vắng" → Kiểm tra: remaining sessions giảm 1
  - Học sinh không còn remaining sessions, có wallet balance
  - Chọn "Vắng" → Kiểm tra: wallet balance giảm đúng học phí
  - Học sinh không còn remaining sessions, wallet balance = 0
  - Chọn "Vắng" → Kiểm tra: loan balance tăng đúng học phí
  - Kiểm tra: total_attended_sessions **KHÔNG** tăng
  - Kiểm tra: Teacher allowance **KHÔNG** tính (weighted count = 0)

### 8.4. CRUD Buổi Học

- [ ] **Create (Optimistic Update):**
  - Tạo buổi học mới
  - Kiểm tra: Buổi học xuất hiện ngay trong UI
  - Kiểm tra: Sau khi DB trả về, dữ liệu được sync chính xác
  - Simulate lỗi DB → Kiểm tra: UI rollback, hiển thị lỗi

- [ ] **Update (Optimistic Update):**
  - Chỉnh sửa buổi học
  - Kiểm tra: Thay đổi hiển thị ngay trong UI
  - Kiểm tra: Sau khi DB trả về, dữ liệu được sync chính xác
  - Simulate lỗi DB → Kiểm tra: UI rollback, hiển thị lỗi

- [ ] **Delete (Optimistic Update):**
  - Xóa buổi học
  - Kiểm tra: Buổi học biến mất ngay trong UI
  - Kiểm tra: Sau khi DB trả về, dữ liệu được sync chính xác
  - Simulate lỗi DB → Kiểm tra: Buổi học xuất hiện lại, hiển thị lỗi

### 8.5. Công Thức Tính Trợ Cấp
- [ ] Hiển thị đúng công thức "Học sinh" và "Trợ cấp"
- [ ] Công thức tính đúng với dữ liệu thực tế
- [ ] Cập nhật real-time khi thay đổi attendance

---

## 9. Files Đã Thay Đổi

### Backend
- `backend/src/services/attendanceService.ts` - Logic tính toán học phí & nợ
- `backend/src/services/sessionsService.ts` - Role-based tuition_fee filtering
- `backend/src/routes/sessions.ts` - Pass user role to service
- `supabase/migrations/add_session_tuition_fee.sql` - Database migration

### Frontend
- `frontend/src/pages/ClassDetail.tsx` - Main implementation
- `frontend/src/components/AttendanceIcon.tsx` - Icon component
- `frontend/src/hooks/useSessionFinancials.ts` - Financial calculations hook
- `frontend/src/hooks/useAttendance.ts` - Attendance state management
- `frontend/src/services/sessionsService.ts` - Session service interface
- `frontend/src/components/Modal.tsx` - Header extra prop

---

## 10. Kết Luận

Tất cả các yêu cầu đã được triển khai thành công:
- ✅ Role-based UI (ẩn số buổi, học phí)
- ✅ 3 trạng thái điểm danh với icon/màu sắc rõ ràng
- ✅ Trường học phí với role-based access
- ✅ Logic tính toán học phí & nợ chính xác cho cả 3 trạng thái
- ✅ Optimistic UI updates với rollback
- ✅ Code refactoring thành hooks/components tái sử dụng
- ✅ Công thức tính trợ cấp hiển thị rõ ràng

Hệ thống đã sẵn sàng cho testing và deployment.

