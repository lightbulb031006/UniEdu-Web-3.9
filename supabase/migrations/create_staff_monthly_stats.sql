-- Create staff_monthly_stats table to cache calculated values for staff detail page
-- This table stores pre-calculated statistics to optimize performance

CREATE TABLE IF NOT EXISTS staff_monthly_stats (
    id TEXT PRIMARY KEY,
    staff_id TEXT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    month TEXT NOT NULL, -- Format: YYYY-MM
    
    -- Bảng các lớp dạy (teacher classes) - chỉ cho teacher
    classes_total_month INTEGER DEFAULT 0, -- Tổng tháng từ các lớp dạy
    classes_total_paid INTEGER DEFAULT 0, -- Đã nhận từ các lớp dạy
    classes_total_unpaid INTEGER DEFAULT 0, -- Chưa nhận từ các lớp dạy (2 tháng: tháng trước + tháng này)
    
    -- Bảng công việc (work items) - cho tất cả staff
    work_items_total_month INTEGER DEFAULT 0, -- Tổng tháng từ công việc
    work_items_total_paid INTEGER DEFAULT 0, -- Đã nhận từ công việc
    work_items_total_unpaid INTEGER DEFAULT 0, -- Chưa nhận từ công việc (2 tháng)
    
    -- Bảng thưởng (bonuses) - cho tất cả staff
    bonuses_total_month INTEGER DEFAULT 0, -- Tổng tháng từ thưởng
    bonuses_total_paid INTEGER DEFAULT 0, -- Đã nhận từ thưởng
    bonuses_total_unpaid INTEGER DEFAULT 0, -- Chưa nhận từ thưởng (2 tháng)
    
    -- Tổng hợp (aggregated)
    total_month_all INTEGER DEFAULT 0, -- Tổng trợ cấp tháng (tất cả các bảng)
    total_paid_all INTEGER DEFAULT 0, -- Đã thanh toán (tất cả các bảng)
    total_unpaid_all INTEGER DEFAULT 0, -- Chưa thanh toán (tất cả các bảng, 2 tháng)
    
    -- Tổng nhận trong năm hiện tại (từ đầu năm đến tháng này)
    total_paid_all_time INTEGER DEFAULT 0, -- Tổng nhận từ trước (trong năm hiện tại)
    
    -- Metadata
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- Thời gian tính toán
    last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- Thời gian cập nhật lần cuối
    version INTEGER DEFAULT 1, -- Version để invalidate cache khi logic thay đổi
    
    UNIQUE(staff_id, month)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_staff_monthly_stats_staff_id ON staff_monthly_stats(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_monthly_stats_month ON staff_monthly_stats(month);
CREATE INDEX IF NOT EXISTS idx_staff_monthly_stats_staff_month ON staff_monthly_stats(staff_id, month);
CREATE INDEX IF NOT EXISTS idx_staff_monthly_stats_calculated_at ON staff_monthly_stats(calculated_at);

-- Add comment
COMMENT ON TABLE staff_monthly_stats IS 'Cache table for staff monthly statistics to optimize staff detail page performance';
COMMENT ON COLUMN staff_monthly_stats.classes_total_unpaid IS 'Chưa nhận từ các lớp dạy - tính từ 2 tháng (tháng trước + tháng này)';
COMMENT ON COLUMN staff_monthly_stats.work_items_total_unpaid IS 'Chưa nhận từ công việc - tính từ 2 tháng (tháng trước + tháng này)';
COMMENT ON COLUMN staff_monthly_stats.bonuses_total_unpaid IS 'Chưa nhận từ thưởng - tính từ 2 tháng (tháng trước + tháng này)';
COMMENT ON COLUMN staff_monthly_stats.total_unpaid_all IS 'Tổng chưa thanh toán từ tất cả các bảng - tính từ 2 tháng';

