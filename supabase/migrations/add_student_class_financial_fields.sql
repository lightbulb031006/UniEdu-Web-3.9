-- Add financial fields to student_classes table
-- These fields track student-specific financial data for each class enrollment

ALTER TABLE student_classes
ADD COLUMN IF NOT EXISTS remaining_sessions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS student_fee_total INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS student_fee_sessions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS student_tuition_per_session INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_attended_sessions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS unpaid_sessions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_purchased_sessions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_paid_amount INTEGER DEFAULT 0;

-- Add comments for documentation
COMMENT ON COLUMN student_classes.remaining_sessions IS 'Số buổi học còn lại của học sinh trong lớp này';
COMMENT ON COLUMN student_classes.student_fee_total IS 'Tổng học phí đã đóng cho lớp này (override cho học sinh cụ thể)';
COMMENT ON COLUMN student_classes.student_fee_sessions IS 'Số buổi học tương ứng với student_fee_total';
COMMENT ON COLUMN student_classes.student_tuition_per_session IS 'Đơn giá mỗi buổi học cho học sinh này (override)';
COMMENT ON COLUMN student_classes.total_attended_sessions IS 'Tổng số buổi học đã tham gia';
COMMENT ON COLUMN student_classes.unpaid_sessions IS 'Số buổi học chưa thanh toán';
COMMENT ON COLUMN student_classes.total_purchased_sessions IS 'Tổng số buổi học đã mua (từ các lần gia hạn)';
COMMENT ON COLUMN student_classes.total_paid_amount IS 'Tổng số tiền đã thanh toán cho lớp này';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_student_classes_remaining_sessions ON student_classes(remaining_sessions) WHERE remaining_sessions > 0;

