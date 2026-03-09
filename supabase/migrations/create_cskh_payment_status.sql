-- ============================================
-- CSKH PAYMENT STATUS TABLE
-- Lưu trạng thái thanh toán lợi nhuận CSKH cho từng học sinh theo tháng
-- ============================================
CREATE TABLE IF NOT EXISTS cskh_payment_status (
    id TEXT PRIMARY KEY DEFAULT ('CSKH_' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS') || '_' || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6)),
    staff_id TEXT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    month TEXT NOT NULL, -- Format: YYYY-MM
    payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('paid', 'unpaid', 'deposit')),
    profit_percent DECIMAL(5,2) DEFAULT 10.00, -- Phần trăm lợi nhuận cho học sinh này (mặc định 10%)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(staff_id, student_id, month)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_cskh_payment_status_staff_id ON cskh_payment_status(staff_id);
CREATE INDEX IF NOT EXISTS idx_cskh_payment_status_student_id ON cskh_payment_status(student_id);
CREATE INDEX IF NOT EXISTS idx_cskh_payment_status_month ON cskh_payment_status(month);
CREATE INDEX IF NOT EXISTS idx_cskh_payment_status_staff_month ON cskh_payment_status(staff_id, month);
CREATE INDEX IF NOT EXISTS idx_cskh_payment_status_status ON cskh_payment_status(payment_status);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_cskh_payment_status_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER trigger_update_cskh_payment_status_updated_at
    BEFORE UPDATE ON cskh_payment_status
    FOR EACH ROW
    EXECUTE FUNCTION update_cskh_payment_status_updated_at();

