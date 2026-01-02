# Quick Start: Tạo Bảng Cache Staff Stats

## Bước 1: Chạy Migration

1. Mở **Supabase Dashboard** → **SQL Editor**
2. Copy toàn bộ nội dung file: `supabase/migrations/create_staff_monthly_stats.sql`
3. Paste vào SQL Editor và chạy (Run)

## Bước 2: Kiểm Tra Bảng Đã Tạo

```sql
-- Kiểm tra bảng đã tạo thành công
SELECT * FROM staff_monthly_stats LIMIT 1;
```

## Bước 3: Cấu Trúc Bảng

Bảng `staff_monthly_stats` lưu các giá trị đã tính toán:

- **Classes stats** (cho teacher): `classes_total_month`, `classes_total_paid`, `classes_total_unpaid`
- **Work items stats**: `work_items_total_month`, `work_items_total_paid`, `work_items_total_unpaid`
- **Bonuses stats**: `bonuses_total_month`, `bonuses_total_paid`, `bonuses_total_unpaid`
- **Tổng hợp**: `total_month_all`, `total_paid_all`, `total_unpaid_all`, `total_paid_all_time`

## Bước 4: Cập Nhật Backend (Sẽ làm sau)

Backend sẽ được cập nhật để:
1. Đọc từ cache trước (nếu có)
2. Tính toán nếu cache không có hoặc đã cũ
3. Lưu kết quả vào cache
4. Cập nhật cache khi dữ liệu thay đổi

## Lưu Ý

- Cache sẽ được tính lại tự động khi dữ liệu thay đổi
- Có thể xóa cache cũ để tính lại: `DELETE FROM staff_monthly_stats WHERE calculated_at < NOW() - INTERVAL '30 days'`
- Version field giúp invalidate cache khi logic thay đổi

