# Logic Lấy Lớp Đang Dạy và Nghỉ Dạy

## Tổng quan

Hệ thống hiển thị cả lớp đang dạy (active) và lớp nghỉ dạy (stopped) trong trang chi tiết nhân sự để giữ lịch sử thống kê.

## Backend Logic (`backend/src/services/staffService.ts`)

### Bước 1: Fetch Class IDs từ 2 nguồn

```typescript
// 1. Fetch từ class_teachers table (lớp đang dạy)
const classTeachersResult = await supabase
  .from('class_teachers')
  .select('class_id')
  .eq('teacher_id', staffId);

const activeClassIds = (classTeachersData || []).map((ct: any) => ct.class_id);
// → Danh sách class_id mà teacher hiện tại đang dạy (còn trong class_teachers)

// 2. Fetch từ sessions table (tất cả lớp teacher đã từng dạy)
const sessionsForClassIdsResult = await supabase
  .from('sessions')
  .select('class_id')
  .eq('teacher_id', staffId);

const allClassIdsFromSessions = (sessionsForClassIds || []).map((s: any) => s.class_id);
// → Danh sách class_id từ sessions (distinct) - bao gồm cả lớp đã dừng
```

### Bước 2: Gộp và loại trùng

```typescript
// Gộp cả 2 danh sách và loại trùng
const allClassIdsSet = new Set([...activeClassIds, ...allClassIdsFromSessions]);
const classIds = Array.from(allClassIdsSet);
// → Tất cả lớp teacher đã từng dạy (cả đang dạy và đã dừng)
```

### Bước 3: Fetch thông tin classes

```typescript
const classesResult = await supabase
  .from('classes')
  .select('id, name, tuition_per_session, custom_teacher_allowances, status')
  .in('id', classIds);
// → Lấy thông tin chi tiết của tất cả các lớp
```

### Bước 4: Xác định trạng thái `isActive`

```typescript
const teacherClassStats = (classes || []).map((cls: any) => {
  // ... tính toán thống kê ...
  
  // Check if teacher is active for this class
  const isActive = activeClassIds.includes(cls.id);
  // → true: Lớp còn trong class_teachers (đang dạy)
  // → false: Lớp không còn trong class_teachers nhưng có trong sessions (đã dừng)
  
  return {
    class: { id, name, status },
    totalMonth,
    totalPaid,
    totalUnpaid,
    monthSessionsCount,
    isActive, // ← Flag quan trọng
  };
});
```

## Frontend Logic (`frontend/src/pages/StaffDetail.tsx`)

### Nhận data từ backend

```typescript
const teacherClassStats = useMemo(() => {
  if (!staffDetailData) return [];
  
  // Sử dụng data từ backend (đã tính toán sẵn)
  return staffDetailData.teacherClassStats.map((stat) => {
    const cls = staffClasses.find((c) => c.id === stat.class.id) || stat.class;
    return {
      ...stat, // Bao gồm isActive từ backend
      class: cls,
    };
  });
}, [staffDetailData, staffClasses, ...]);
```

### Hiển thị UI

```typescript
{teacherClassStats.map((stat) => {
  const statusLabel = stat.isActive ? 'Dạy' : 'Dừng';
  const statusColor = stat.isActive ? '#059669' : '#dc2626';
  
  return (
    <tr
      style={{
        cursor: stat.isActive ? 'pointer' : 'not-allowed',
        opacity: stat.isActive ? 1 : 0.7,
        pointerEvents: stat.isActive ? 'auto' : 'none',
      }}
    >
      {/* Hiển thị badge */}
      <span style={{ color: statusColor }}>
        {statusLabel} {/* "Dạy" hoặc "Dừng" */}
      </span>
    </tr>
  );
})}
```

## Quy trình xác định trạng thái

### Lớp Đang Dạy (`isActive = true`)
1. Teacher có trong bảng `class_teachers` với `class_id` tương ứng
2. Có thể click vào để xem chi tiết lớp
3. Hiển thị badge "Dạy" màu xanh (#059669)
4. Opacity = 1, cursor = pointer

### Lớp Nghỉ Dạy (`isActive = false`)
1. Teacher KHÔNG còn trong bảng `class_teachers`
2. Nhưng có sessions trong quá khứ với `teacher_id` = staffId
3. Không thể click vào (pointerEvents = 'none')
4. Hiển thị badge "Dừng" màu đỏ (#dc2626)
5. Opacity = 0.7, cursor = not-allowed
6. Vẫn hiển thị thống kê (số buổi, tổng tháng, đã nhận, chưa nhận) để giữ lịch sử

## Kịch bản sử dụng

### Khi thêm teacher vào lớp:
1. Insert vào `class_teachers` → `isActive = true`
2. Cache được invalidate → UI cập nhật ngay

### Khi gỡ teacher khỏi lớp:
1. Delete khỏi `class_teachers` → `isActive = false`
2. Lớp vẫn hiển thị (từ sessions) nhưng với badge "Dừng"
3. Cache được invalidate → UI cập nhật ngay

### Khi teacher dạy lớp mới:
1. Tạo sessions với `teacher_id` → Lớp xuất hiện trong danh sách
2. Nếu có trong `class_teachers` → `isActive = true`
3. Nếu không có trong `class_teachers` → `isActive = false` (trường hợp hiếm)

## Lưu ý quan trọng

1. **Bảng `class_teachers`**: Quản lý quan hệ hiện tại (đang dạy)
2. **Bảng `sessions`**: Lưu lịch sử (tất cả lớp đã từng dạy)
3. **Logic gộp**: Đảm bảo không bỏ sót lớp nào teacher đã từng dạy
4. **Cache invalidation**: Khi thêm/gỡ teacher, cache được clear để cập nhật ngay

