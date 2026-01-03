# Báo Cáo: Thay Đổi Cảnh Báo Dashboard

## 📋 Tổng Quan

Đã thay thế cảnh báo "Lớp chưa có giáo viên" bằng cảnh báo mới "Lớp chưa báo cáo lần x" với logic tính toán dựa trên báo cáo khảo sát.

---

## 🔍 Phân Tích Phần Dashboard Hiện Tại

### Cảnh báo cũ:
- **Tiêu đề**: "Lớp chưa có giáo viên"
- **Logic**: Tìm các lớp không có giáo viên được gán (dựa trên bảng `class_teachers`)
- **Vị trí**: Dashboard alerts section
- **Dữ liệu**: Chỉ hiển thị tên lớp, không có thông tin giáo viên

### Vấn đề:
- Cảnh báo không phản ánh trạng thái báo cáo khảo sát
- Không có thông tin giáo viên phụ trách trong danh sách

---

## ✅ Các Thay Đổi Đã Thực Hiện

### 1. **Backend Changes** (`backend/src/services/dashboardService.ts`)

#### a. Thêm fetch surveys:
```typescript
surveysResult = await supabase.from('class_surveys').select('*');
const surveys = surveysResult.data || [];
```

#### b. Logic tính toán mới:
- **Tính max test_number**: Tìm giá trị `test_number` lớn nhất trong tất cả surveys
  ```typescript
  let maxTestNumber = 0;
  if (surveys.length > 0) {
    maxTestNumber = Math.max(...surveys.map((s: any) => Number(s.test_number) || 0));
  }
  ```

- **Group surveys theo class**: Tạo map `class_id -> max test_number` của lớp đó
  ```typescript
  const classSurveyMap = new Map<string, number>();
  surveys.forEach((s: any) => {
    const classId = s.class_id;
    const testNumber = Number(s.test_number) || 0;
    const currentMax = classSurveyMap.get(classId) || 0;
    if (testNumber > currentMax) {
      classSurveyMap.set(classId, testNumber);
    }
  });
  ```

- **Tìm lớp chưa báo cáo**: Lọc các lớp có `maxTestNumber < maxTestNumber` (toàn hệ thống)
  ```typescript
  const classesWithoutSurvey = classes
    .filter((cls: any) => {
      const classMaxTestNumber = classSurveyMap.get(cls.id) || 0;
      return classMaxTestNumber < maxTestNumber;
    })
    .map((cls: any) => {
      // Lấy danh sách giáo viên của lớp
      const teacherIds = (classTeachers || [])
        .filter((ct: any) => ct.class_id === cls.id)
        .map((ct: any) => ct.teacher_id);
      
      const classTeachersList = teachers
        .filter((t: any) => teacherIds.includes(t.id))
        .map((t: any) => ({
          id: t.id,
          fullName: t.full_name || t.fullName || '',
        }));

      return {
        id: cls.id,
        name: cls.name || cls.id,
        teachers: classTeachersList,
      };
    });
  ```

#### c. Cập nhật response structure:
```typescript
alerts: {
  classesWithoutSurvey: {
    maxTestNumber,
    classes: classesWithoutSurvey,
  },
  // ... other alerts
}
```

### 2. **Frontend Changes**

#### a. Cập nhật Interface (`frontend/src/services/dashboardService.ts`):
```typescript
classesWithoutSurvey: {
  maxTestNumber: number;
  classes: Array<{
    id: string;
    name: string;
    teachers: Array<{
      id: string;
      fullName: string;
    }>;
  }>;
};
```

#### b. Tạo Component Mới (`frontend/src/components/DashboardAlert.tsx`):
- **Component tái sử dụng** cho các cảnh báo dashboard
- **Props linh hoạt**: title, count, icon, colors, items
- **Hiển thị giáo viên**: 
  - 1 giáo viên: hiển thị tên đầy đủ
  - Nhiều giáo viên: hiển thị tên đầu + "+N" (ví dụ: "Nguyễn Văn A +2")
- **Click handler**: Navigate đến chi tiết lớp khi click vào item

#### c. Cập nhật Dashboard (`frontend/src/pages/Dashboard.tsx`):
- **Xóa**: Cảnh báo "Lớp chưa có giáo viên" cũ
- **Thêm**: Cảnh báo mới sử dụng `DashboardAlert` component
- **Điều kiện hiển thị**: Chỉ hiển thị khi `maxTestNumber > 0` (đã có ít nhất 1 lớp có báo cáo)

---

## 🎨 UI/UX Improvements

### 1. **Component DashboardAlert**:
- ✅ Tái sử dụng được cho các cảnh báo khác
- ✅ Responsive design
- ✅ Hover effects
- ✅ Scrollable list (max-height: 200px)
- ✅ Badge hiển thị số lượng mục

### 2. **Hiển thị thông tin giáo viên**:
- ✅ Tên lớp (font-weight: 600)
- ✅ Danh sách giáo viên phụ trách (font-size nhỏ hơn, màu muted)
- ✅ Format gọn: "Tên giáo viên +N" khi có nhiều giáo viên

### 3. **Navigation**:
- ✅ Click vào item → Navigate đến `/classes/{classId}`
- ✅ Hover effect để người dùng biết có thể click

---

## 📊 Logic Tính Toán

### Công thức:
```
x = max(test_number) từ tất cả surveys trong hệ thống
```

### Ví dụ:
- Lớp A có báo cáo: lần 1, lần 2, lần 3 → max = 3
- Lớp B có báo cáo: lần 1, lần 2 → max = 2
- Lớp C có báo cáo: lần 1 → max = 1
- **→ x = max(3, 2, 1) = 3**

### Lớp chưa báo cáo lần 3:
- Lớp B (chỉ có đến lần 2)
- Lớp C (chỉ có đến lần 1)
- Lớp D (chưa có báo cáo nào)

---

## ✅ Checklist Kiểm Thử

### 1. Tính toán đúng giá trị x
- [ ] Kiểm tra khi không có survey nào → không hiển thị cảnh báo
- [ ] Kiểm tra khi có 1 survey → x = test_number của survey đó
- [ ] Kiểm tra khi có nhiều surveys → x = max(test_number)
- [ ] Kiểm tra với test_number = 0 → xử lý đúng

### 2. Dashboard hiển thị đúng danh sách lớp chưa báo cáo lần x
- [ ] Hiển thị đúng các lớp có maxTestNumber < x
- [ ] Không hiển thị các lớp đã có báo cáo lần x
- [ ] Hiển thị đúng số lượng trong badge
- [ ] Hiển thị message "Tất cả các lớp đã có báo cáo" khi không có lớp nào

### 3. Hiển thị đúng số lượng giáo viên phụ trách
- [ ] Lớp có 1 giáo viên → hiển thị tên đầy đủ
- [ ] Lớp có 2 giáo viên → hiển thị "Tên giáo viên 1 +1"
- [ ] Lớp có 3+ giáo viên → hiển thị "Tên giáo viên 1 +N"
- [ ] Lớp không có giáo viên → không hiển thị dòng giáo viên

### 4. Click vào lớp → ra chi tiết lớp
- [ ] Click vào tên lớp → navigate đến `/classes/{classId}`
- [ ] Click vào phần giáo viên → cũng navigate đến chi tiết lớp
- [ ] URL đúng format
- [ ] Trang chi tiết load đúng dữ liệu

### 5. Responsive & Performance
- [ ] Hiển thị đúng trên desktop
- [ ] Hiển thị đúng trên mobile
- [ ] Scroll hoạt động khi danh sách dài
- [ ] Không có lỗi console
- [ ] Performance tốt (không lag khi render)

---

## 📝 Files Changed

### Backend:
1. `backend/src/services/dashboardService.ts`
   - Thêm fetch `class_surveys`
   - Thêm logic tính `maxTestNumber`
   - Thêm logic tìm `classesWithoutSurvey`
   - Cập nhật response structure

### Frontend:
1. `frontend/src/services/dashboardService.ts`
   - Cập nhật interface `DashboardData`
   - Thay `classesWithoutTeacher` bằng `classesWithoutSurvey`

2. `frontend/src/components/DashboardAlert.tsx` (NEW)
   - Component mới tái sử dụng được
   - Hiển thị danh sách với giáo viên

3. `frontend/src/pages/Dashboard.tsx`
   - Import `DashboardAlert` component
   - Thay thế cảnh báo cũ bằng cảnh báo mới

---

## 🚀 Deployment Notes

1. **Database**: Không cần migration (đã có bảng `class_surveys`)
2. **Backend**: Cần restart để load logic mới
3. **Frontend**: Build và deploy như bình thường
4. **Cache**: Dashboard cache sẽ tự động refresh sau 2 phút

---

## 🔄 Rollback Plan

Nếu cần rollback:
1. Revert các thay đổi trong `dashboardService.ts` (backend)
2. Revert các thay đổi trong `Dashboard.tsx` (frontend)
3. Xóa file `DashboardAlert.tsx` nếu không dùng
4. Restore interface cũ trong `dashboardService.ts` (frontend)

---

## 📌 Notes

- Cảnh báo chỉ hiển thị khi `maxTestNumber > 0` (đã có ít nhất 1 lớp có báo cáo)
- Nếu tất cả các lớp đều chưa có báo cáo → không hiển thị cảnh báo
- Component `DashboardAlert` có thể tái sử dụng cho các cảnh báo khác trong tương lai

