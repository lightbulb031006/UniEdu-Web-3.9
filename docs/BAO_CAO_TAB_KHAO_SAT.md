# Báo Cáo: Thêm Tab Khảo Sát vào Chi Tiết Lớp Học

## Tổng Quan

Đã hoàn thành việc thêm tab "Khảo sát" vào trang chi tiết lớp học, cho phép quản lý báo cáo khảo sát với đầy đủ chức năng CRUD (Create, Read, Update, Delete).

## 1. Phân Tích Trang Chi Tiết Lớp Học Hiện Tại

### Tab 1: Lịch sử buổi học (Giữ nguyên)
- **Cấu trúc**: Section collapsible với month navigation
- **UI/UX**: 
  - Header có icon và toggle để expand/collapse
  - Month navigation với popup chọn tháng/năm
  - Table hiển thị sessions với các thông tin: thời gian, nhận xét, thông tin buổi học
  - Bulk actions cho việc cập nhật trạng thái thanh toán
  - Stats grid hiển thị tổng số buổi và tổng trợ cấp
- **Logic**: 
  - Filter sessions theo tháng được chọn
  - Tính toán allowance dựa trên coefficient và custom allowances
  - Quản lý payment status (paid/unpaid/deposit)

## 2. Thiết Kế Tab Mới: Khảo Sát

### Cấu Trúc Tab System
- **Vị trí**: Bên cạnh tab "Lịch sử buổi học" trong cùng section
- **UI**: 
  - Tab navigation với 2 tabs: "Lịch sử buổi học" và "Khảo sát"
  - Active tab có border-bottom màu primary và font-weight 600
  - Smooth transition khi chuyển tab

### Form Báo Cáo Khảo Sát

#### Các Trường Hiển Thị:
1. **Bài kiểm tra lần mấy** (`test_number`)
   - Type: Number input
   - Required: Yes
   - Min: 1
   - Default: 1

2. **Người phụ trách** (`responsible_person_id`)
   - Type: Select dropdown
   - Required: No
   - Options: Danh sách teachers (filtered by teacher role)
   - Display: Full name của teacher

3. **Ngày báo cáo** (`report_date`)
   - Type: Date input
   - Required: Yes
   - Default: Ngày hiện tại
   - Format: YYYY-MM-DD

4. **Nội dung báo cáo** (`content`)
   - Type: Textarea
   - Required: Yes
   - Rows: 8
   - Placeholder: "Nhập nội dung báo cáo khảo sát..."
   - Resize: Vertical

#### Layout Form:
- Grid layout responsive cho các trường ngắn (test_number, report_date)
- Full width cho các trường dài (responsible_person, content)
- Form actions: Hủy và Lưu/Cập nhật buttons
- Loading state khi submit

## 3. Logic Dữ Liệu

### Database Schema
**Bảng `class_surveys`**:
```sql
- id: TEXT PRIMARY KEY
- class_id: TEXT (FK to classes)
- test_number: INTEGER
- responsible_person_id: TEXT (FK to teachers, nullable)
- report_date: DATE
- content: TEXT
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

### Backend Services
**File**: `backend/src/services/surveysService.ts`
- `getSurveysByClassId()`: Lấy tất cả surveys của một class
- `getSurveyById()`: Lấy survey theo ID
- `createSurvey()`: Tạo survey mới
- `updateSurvey()`: Cập nhật survey
- `deleteSurvey()`: Xóa survey

**Features**:
- Auto-join với teachers table để lấy thông tin người phụ trách
- Sort by report_date và test_number (descending)
- Error handling đầy đủ

### Backend Routes
**File**: `backend/src/routes/surveys.ts`
- `GET /api/surveys/class/:classId`: Lấy surveys của class
- `GET /api/surveys/:id`: Lấy survey theo ID
- `POST /api/surveys`: Tạo survey mới
- `PUT /api/surveys/:id`: Cập nhật survey
- `DELETE /api/surveys/:id`: Xóa survey

**Đã đăng ký trong**: `backend/src/app.ts` → `/api/surveys`

### Frontend Services
**File**: `frontend/src/services/surveysService.ts`
- `fetchSurveysByClassId()`: Fetch surveys của class
- `fetchSurveyById()`: Fetch survey theo ID
- `createSurvey()`: Tạo survey mới
- `updateSurvey()`: Cập nhật survey
- `deleteSurvey()`: Xóa survey

### Optimistic Updates
**Implementation**:
1. **Create**: 
   - Tạo temporary ID và add vào local state ngay lập tức
   - Gọi API
   - Khi thành công: Replace với data từ server
   - Khi lỗi: Rollback bằng cách refetch

2. **Update**:
   - Update local state ngay lập tức
   - Gọi API
   - Khi thành công: Confirm update
   - Khi lỗi: Rollback bằng cách refetch

3. **Delete**:
   - Remove khỏi local state ngay lập tức
   - Gọi API
   - Khi thành công: Confirm delete
   - Khi lỗi: Rollback bằng cách refetch

**Lợi ích**:
- UI responsive ngay lập tức
- Better UX (không phải chờ API response)
- Auto-rollback nếu có lỗi

## 4. Refactor Code

### Component Structure
**File**: `frontend/src/components/SurveyTab.tsx`
- **Main Component**: `SurveyTab`
  - Props: `classId`, `canManage`
  - State: modals, editing survey
  - Handlers: create, update, delete với optimistic updates

- **Sub Component**: `SurveyForm`
  - Props: `classId`, `teachers`, `survey` (optional), `onSubmit`, `onCancel`
  - Form state management
  - Validation
  - Submit handler

### Integration với ClassDetail
**File**: `frontend/src/pages/ClassDetail.tsx`
- **Changes**:
  - Import `SurveyTab` component
  - Thêm state `activeTab` ('sessions' | 'surveys')
  - Thay đổi header từ "Lịch sử buổi học" → "Lịch sử & Khảo sát"
  - Thêm tab navigation UI
  - Conditional rendering: sessions tab hoặc surveys tab

### Code Organization
- **Separation of Concerns**: 
  - SurveyTab là component độc lập, dễ maintain
  - Form logic tách riêng trong SurveyForm
  - Services tách riêng backend và frontend

- **Reusability**:
  - SurveyTab có thể reuse ở nơi khác nếu cần
  - SurveyForm có thể dùng cho cả create và edit

## 5. UI/UX Improvements

### Responsive Design
- **Desktop**: 
  - Tab navigation horizontal
  - Table full width với các cột rõ ràng
  - Form grid layout 2 columns cho các trường ngắn

- **Mobile**:
  - Tab navigation vẫn horizontal nhưng có thể scroll
  - Table có thể scroll horizontal nếu cần
  - Form grid chuyển thành 1 column trên mobile

### Visual Consistency
- **Colors**: Sử dụng CSS variables (--primary, --muted, --border, etc.)
- **Spacing**: Sử dụng --spacing-* variables
- **Typography**: Consistent với các component khác
- **Icons**: SVG icons giống với các phần khác

### User Experience
- **Loading States**: Hiển thị "Đang tải..." khi fetch data
- **Empty States**: 
  - Icon và message khi chưa có surveys
  - Button "Thêm báo cáo đầu tiên" nếu có permission
- **Error Handling**: Toast notifications cho mọi actions
- **Confirmation**: Confirm dialog trước khi delete

## 6. Checklist Kiểm Thử CRUD

### ✅ Create (Tạo mới)
- [ ] Click "Thêm báo cáo" → Modal mở
- [ ] Nhập đầy đủ thông tin → Submit → Tạo thành công
- [ ] Nhập thiếu required fields → Validation error
- [ ] Chọn người phụ trách từ dropdown → Hiển thị đúng
- [ ] Optimistic update: Survey xuất hiện ngay trong list
- [ ] Nếu API lỗi → Rollback và hiển thị error message

### ✅ Read (Đọc)
- [ ] Load trang → Surveys hiển thị trong table
- [ ] Sort đúng: report_date và test_number descending
- [ ] Hiển thị đầy đủ thông tin: test_number, responsible_person, report_date, content
- [ ] Format date đúng định dạng
- [ ] Truncate content nếu quá dài (2 lines với ellipsis)
- [ ] Empty state hiển thị khi chưa có surveys

### ✅ Update (Cập nhật)
- [ ] Click "Chỉnh sửa" → Modal mở với data đã điền sẵn
- [ ] Sửa thông tin → Submit → Cập nhật thành công
- [ ] Optimistic update: Changes hiển thị ngay
- [ ] Nếu API lỗi → Rollback và hiển thị error message
- [ ] Validation: Required fields không được để trống

### ✅ Delete (Xóa)
- [ ] Click "Xóa" → Confirm dialog hiển thị
- [ ] Confirm → Survey bị xóa khỏi list
- [ ] Cancel → Không xóa
- [ ] Optimistic update: Survey biến mất ngay
- [ ] Nếu API lỗi → Rollback và hiển thị error message

### ✅ Tab Navigation
- [ ] Click "Lịch sử buổi học" → Hiển thị sessions
- [ ] Click "Khảo sát" → Hiển thị surveys
- [ ] Active tab có styling đúng (border-bottom, color, font-weight)
- [ ] Smooth transition khi chuyển tab

### ✅ Permissions
- [ ] User có permission → Thấy buttons Create/Edit/Delete
- [ ] User không có permission → Chỉ thấy Read-only view

## 7. Files Đã Tạo/Sửa

### Backend
1. **Migration**: `supabase/migrations/create_class_surveys_table.sql`
   - Tạo bảng `class_surveys`
   - Tạo indexes
   - Add comments

2. **Service**: `backend/src/services/surveysService.ts`
   - CRUD operations
   - Join với teachers table

3. **Routes**: `backend/src/routes/surveys.ts`
   - API endpoints
   - Error handling

4. **App**: `backend/src/app.ts`
   - Đăng ký surveys routes

### Frontend
1. **Service**: `frontend/src/services/surveysService.ts`
   - API calls
   - Type definitions

2. **Component**: `frontend/src/components/SurveyTab.tsx`
   - Main component với list và modals
   - SurveyForm sub-component
   - Optimistic updates

3. **Page**: `frontend/src/pages/ClassDetail.tsx`
   - Thêm tab system
   - Integrate SurveyTab

## 8. Next Steps (Nếu cần)

1. **Export/Import**: 
   - Export surveys ra Excel/PDF
   - Import surveys từ file

2. **Search/Filter**:
   - Search theo nội dung
   - Filter theo người phụ trách, ngày báo cáo

3. **Rich Text Editor**:
   - Thay textarea bằng rich text editor cho content
   - Support formatting, images, etc.

4. **Attachments**:
   - Upload files đính kèm với survey
   - Download attachments

5. **Notifications**:
   - Notify khi có survey mới
   - Remind về survey cần làm

## 9. Kết Luận

Đã hoàn thành đầy đủ yêu cầu:
- ✅ Tab "Khảo sát" được thêm vào ClassDetail
- ✅ Form CRUD đầy đủ với validation
- ✅ Optimistic updates cho better UX
- ✅ Code được refactor và organize tốt
- ✅ UI/UX đồng bộ với design system hiện tại
- ✅ Responsive trên cả desktop và mobile
- ✅ Error handling và loading states đầy đủ

Code sẵn sàng để test và deploy!


