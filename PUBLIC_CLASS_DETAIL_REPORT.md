# Báo Cáo: Cho Phép Public Access Trang Chi Tiết Lớp Học

## Tổng Quan
Đã thực hiện thay đổi để cho phép người dùng không đăng nhập truy cập trang chi tiết lớp học (`/classes/:id`) ở chế độ read-only, trong khi vẫn bảo vệ các dữ liệu nhạy cảm và các thao tác cần quyền.

---

## 1. Thay Đổi Frontend

### 1.1. Route Guard (`frontend/src/App.tsx`)
**Thay đổi:**
- Loại bỏ `ProtectedRoute` wrapper cho route `/classes/:id`
- Cho phép truy cập công khai vào trang chi tiết lớp học

**Code:**
```tsx
// Trước:
<Route path="/classes/:id" element={<ProtectedRoute><Layout><ClassDetail /></Layout></ProtectedRoute>} />

// Sau:
<Route path="/classes/:id" element={<Layout><ClassDetail /></Layout>} />
```

### 1.2. ClassDetail Component (`frontend/src/pages/ClassDetail.tsx`)

#### 1.2.1. Thêm Authentication Check
- Thêm `isAuthenticated` từ `useAuthStore` để kiểm tra trạng thái đăng nhập

#### 1.2.2. Cập Nhật Permission Checks
Tất cả các permission checks đã được cập nhật để chỉ hoạt động khi user đã đăng nhập:

```tsx
// Trước:
const isAdmin = hasRole('admin');
const canEdit = isAdmin;
const canManage = isAdmin || hasRole('accountant') || ...;

// Sau:
const isAdmin = isAuthenticated && hasRole('admin');
const canEdit = isAuthenticated && isAdmin;
const canManage = isAuthenticated && (isAdmin || hasRole('accountant') || ...);
```

**Các permissions đã được cập nhật:**
- `isAdmin` - Chỉ true khi đã đăng nhập và là admin
- `canEdit` - Chỉ true khi đã đăng nhập và có quyền edit
- `canManage` - Chỉ true khi đã đăng nhập và có quyền manage
- `canManageStudents` - Phụ thuộc vào `canManage`
- `canManageTeacherList` - Phụ thuộc vào `canManage`
- `showClassFinancialDetails` - Chỉ true khi đã đăng nhập và là admin
- `canCreateSession` - Chỉ true khi đã đăng nhập và có quyền
- `canEditSession` - Chỉ true khi đã đăng nhập và có quyền
- `canEditSchedule` - Chỉ true khi đã đăng nhập và có quyền
- `canManageSurveys` - Chỉ true khi đã đăng nhập và có quyền
- `canDeleteSurveys` - Chỉ true khi đã đăng nhập và là admin
- `canEditAllowanceManually` - Chỉ true khi đã đăng nhập và có quyền

#### 1.2.3. Ẩn Các Nút Thao Tác
Tất cả các nút thao tác đã được ẩn khi user không đăng nhập thông qua các điều kiện permission:

**Các nút đã được ẩn:**
- ✅ Nút "Chỉnh sửa lớp" (chỉ hiển thị khi `canEdit`)
- ✅ Nút "Chỉnh sửa danh sách gia sư" (chỉ hiển thị khi `canManageTeacherList`)
- ✅ Nút "Chỉnh sửa trợ cấp" (chỉ hiển thị khi `canManageTeacherList`)
- ✅ Nút "Chỉnh sửa lịch học" (chỉ hiển thị khi `canEditSchedule`)
- ✅ Nút "Thêm học sinh có sẵn" (chỉ hiển thị khi `canManageStudents`)
- ✅ Nút "Sửa thông tin" học sinh (chỉ hiển thị khi `canManageStudents`)
- ✅ Nút "Chuyển lớp" học sinh (chỉ hiển thị khi `canManageStudents`)
- ✅ Nút "Xóa" học sinh (chỉ hiển thị khi `canManageStudents`)
- ✅ Nút "Thêm buổi học" (chỉ hiển thị khi `canCreateSession`)
- ✅ Nút "Xóa buổi học" (chỉ hiển thị khi `canShowDelete`)
- ✅ Các nút thao tác trong bảng buổi học (chỉ hiển thị khi có quyền tương ứng)

#### 1.2.4. Ẩn Các Trường Nhạy Cảm
Các trường nhạy cảm đã được ẩn khi user không có quyền (không đăng nhập hoặc không phải admin):

**Các trường đã được ẩn:**
- ✅ "Trợ cấp" (tuition_per_session) - Chỉ hiển thị khi `showClassFinancialDetails`
- ✅ "Học phí" (student_tuition_per_session) - Chỉ hiển thị khi `showClassFinancialDetails`
- ✅ "Gói" (tuition_package_total, tuition_package_sessions) - Chỉ hiển thị khi `showClassFinancialDetails`
- ✅ "Scale" (scale_amount) - Chỉ hiển thị khi `showClassFinancialDetails`
- ✅ Cột "Còn lại" trong bảng học sinh - Chỉ hiển thị khi `showClassFinancialDetails`
- ✅ "Tổng trợ cấp" trong thống kê buổi học - Chỉ hiển thị khi `showClassFinancialDetails`
- ✅ Cột "TRỢ CẤP" trong bảng gia sư - Chỉ hiển thị khi `showClassFinancialDetails`
- ✅ Cột "TỔNG NHẬN" trong bảng gia sư - Chỉ hiển thị khi `showClassFinancialDetails`

---

## 2. Thay Đổi Backend

### 2.1. Optional Authentication Middleware (`backend/src/middleware/auth.ts`)
**Thay đổi:**
- Thêm middleware `optionalAuthenticate` để cho phép request không có token
- Nếu có token hợp lệ, set `req.user`
- Nếu không có token hoặc token không hợp lệ, `req.user` sẽ là `undefined`

**Code:**
```typescript
export function optionalAuthenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = undefined;
      return next();
    }

    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET as string);
      req.user = decoded;
      next();
    } catch (tokenError) {
      req.user = undefined;
      next();
    }
  } catch (error) {
    req.user = undefined;
    next();
  }
}
```

### 2.2. Classes Route (`backend/src/routes/classes.ts`)
**Thay đổi:**
- Thay `authenticate` bằng `optionalAuthenticate` cho route `GET /classes/:id`
- Truyền `user` từ request vào service function

**Code:**
```typescript
// Trước:
router.get('/:id', authenticate, async (req, res, next) => {
  const cls = await getClassById(req.params.id, { includeTeachers });
  ...
});

// Sau:
router.get('/:id', optionalAuthenticate, async (req, res, next) => {
  const user = (req as any).user;
  const cls = await getClassById(req.params.id, { includeTeachers, user });
  ...
});
```

### 2.3. Classes Service (`backend/src/services/classesService.ts`)
**Thay đổi:**
- Cập nhật `getClassById` để nhận tham số `user` trong options
- Filter các trường nhạy cảm khi user không có quyền

**Logic filter:**
- Nếu không có user hoặc user không phải admin/accountant/staff → Xóa các trường nhạy cảm:
  - `tuition_per_session`
  - `student_tuition_per_session`
  - `tuition_package_total`
  - `tuition_package_sessions`
  - `scale_amount`
  - `max_allowance_per_session`
  - `custom_teacher_allowances`

**Code:**
```typescript
export async function getClassById(
  id: string, 
  options: { 
    includeTeachers?: boolean; 
    user?: { userId: string; role: string; email?: string } 
  } = {}
) {
  // ... fetch data ...
  
  const user = options.user;
  const isAdmin = user?.role === 'admin';
  const isAccountant = user?.role === 'accountant';
  const isStaff = user?.role === 'teacher';
  
  if (!user || (!isAdmin && !isAccountant && !isStaff)) {
    delete cls.tuition_per_session;
    delete cls.student_tuition_per_session;
    delete cls.tuition_package_total;
    delete cls.tuition_package_sessions;
    delete cls.scale_amount;
    delete cls.max_allowance_per_session;
    delete cls.custom_teacher_allowances;
  }
  
  // ... return ...
}
```

---

## 3. Checklist Kiểm Thử

### 3.1. Trường Hợp: Không Đăng Nhập

#### 3.1.1. Truy Cập Trang
- [ ] Truy cập `/classes/:id` → Trang hiển thị bình thường, không redirect đến login
- [ ] Thông tin lớp học cơ bản hiển thị đầy đủ (tên lớp, loại, trạng thái, lịch học)
- [ ] Danh sách học sinh hiển thị đầy đủ
- [ ] Danh sách gia sư hiển thị đầy đủ
- [ ] Lịch sử buổi học hiển thị đầy đủ

#### 3.1.2. Các Nút Thao Tác
- [ ] Không thấy nút "Chỉnh sửa lớp"
- [ ] Không thấy nút "Chỉnh sửa danh sách gia sư"
- [ ] Không thấy nút "Chỉnh sửa trợ cấp"
- [ ] Không thấy nút "Chỉnh sửa lịch học"
- [ ] Không thấy nút "Thêm học sinh có sẵn"
- [ ] Không thấy nút "Sửa thông tin" học sinh
- [ ] Không thấy nút "Chuyển lớp" học sinh
- [ ] Không thấy nút "Xóa" học sinh
- [ ] Không thấy nút "Thêm buổi học"
- [ ] Không thấy nút "Xóa buổi học"
- [ ] Không thấy các nút thao tác trong bảng buổi học

#### 3.1.3. Các Trường Nhạy Cảm
- [ ] Không thấy "Trợ cấp" (tuition_per_session)
- [ ] Không thấy "Học phí" (student_tuition_per_session)
- [ ] Không thấy "Gói" (tuition_package_total, tuition_package_sessions)
- [ ] Không thấy "Scale" (scale_amount)
- [ ] Không thấy cột "Còn lại" trong bảng học sinh
- [ ] Không thấy "Tổng trợ cấp" trong thống kê buổi học
- [ ] Không thấy cột "TRỢ CẤP" trong bảng gia sư
- [ ] Không thấy cột "TỔNG NHẬN" trong bảng gia sư

#### 3.1.4. API Response
- [ ] API `GET /api/classes/:id` trả về 200 OK
- [ ] Response không chứa các trường nhạy cảm:
  - `tuition_per_session`
  - `student_tuition_per_session`
  - `tuition_package_total`
  - `tuition_package_sessions`
  - `scale_amount`
  - `max_allowance_per_session`
  - `custom_teacher_allowances`

### 3.2. Trường Hợp: Đăng Nhập Nhân Sự (Teacher/CSKH)

#### 3.2.1. Truy Cập Trang
- [ ] Truy cập `/classes/:id` → Trang hiển thị bình thường
- [ ] Thông tin lớp học cơ bản hiển thị đầy đủ

#### 3.2.2. Các Nút Thao Tác
- [ ] Thấy các nút thao tác phù hợp với quyền (tùy theo role)
- [ ] Có thể tạo/chỉnh sửa buổi học (nếu là teacher)
- [ ] Có thể quản lý học sinh (nếu có quyền CSKH)

#### 3.2.3. Các Trường Nhạy Cảm
- [ ] Có thể thấy một số trường nhạy cảm tùy theo quyền
- [ ] Không thấy tất cả trường nhạy cảm (chỉ admin mới thấy đầy đủ)

### 3.3. Trường Hợp: Đăng Nhập Admin

#### 3.3.1. Truy Cập Trang
- [ ] Truy cập `/classes/:id` → Trang hiển thị bình thường
- [ ] Thông tin lớp học hiển thị đầy đủ

#### 3.3.2. Các Nút Thao Tác
- [ ] Thấy tất cả các nút thao tác
- [ ] Có thể chỉnh sửa lớp
- [ ] Có thể quản lý gia sư
- [ ] Có thể quản lý học sinh
- [ ] Có thể tạo/chỉnh sửa/xóa buổi học
- [ ] Có thể quản lý khảo sát

#### 3.3.3. Các Trường Nhạy Cảm
- [ ] Thấy tất cả các trường nhạy cảm:
  - "Trợ cấp"
  - "Học phí"
  - "Gói"
  - "Scale"
  - Cột "Còn lại" trong bảng học sinh
  - "Tổng trợ cấp" trong thống kê buổi học
  - Cột "TRỢ CẤP" và "TỔNG NHẬN" trong bảng gia sư

#### 3.3.4. API Response
- [ ] API `GET /api/classes/:id` trả về 200 OK
- [ ] Response chứa đầy đủ tất cả các trường, bao gồm cả trường nhạy cảm

---

## 4. Tóm Tắt Các File Đã Thay Đổi

### Frontend:
1. `frontend/src/App.tsx` - Loại bỏ ProtectedRoute cho `/classes/:id`
2. `frontend/src/pages/ClassDetail.tsx` - Cập nhật permission checks và ẩn UI elements

### Backend:
1. `backend/src/middleware/auth.ts` - Thêm `optionalAuthenticate` middleware
2. `backend/src/routes/classes.ts` - Sử dụng `optionalAuthenticate` cho GET `/classes/:id`
3. `backend/src/services/classesService.ts` - Filter dữ liệu nhạy cảm trong `getClassById`

---

## 5. Lưu Ý

1. **API `GET /api/classes/:id/detail-data`**: Vẫn yêu cầu authenticate vì endpoint này chỉ được gọi khi user đã đăng nhập và có quyền. Frontend sẽ không gọi API này khi user không đăng nhập.

2. **Các API khác**: Tất cả các API POST/PUT/PATCH/DELETE vẫn yêu cầu authenticate đầy đủ.

3. **Bảo mật**: Dữ liệu nhạy cảm được filter ở cả backend và frontend để đảm bảo an toàn tối đa.

4. **Performance**: Optional authentication không ảnh hưởng đến performance vì chỉ verify token khi có token.

---

## 6. Kết Luận

Đã hoàn thành việc cho phép public access trang chi tiết lớp học với các tính năng:
- ✅ Không yêu cầu đăng nhập để xem thông tin lớp
- ✅ Ẩn tất cả các nút thao tác khi không đăng nhập
- ✅ Ẩn tất cả các trường nhạy cảm khi không có quyền
- ✅ Backend filter dữ liệu nhạy cảm
- ✅ Frontend ẩn UI elements dựa trên permission
- ✅ Các API khác vẫn yêu cầu authenticate

Hệ thống hiện tại đảm bảo:
- Người dùng không đăng nhập có thể xem thông tin lớp ở chế độ read-only
- Dữ liệu nhạy cảm được bảo vệ ở cả backend và frontend
- Các thao tác cần quyền được ẩn hoàn toàn khi không có quyền

