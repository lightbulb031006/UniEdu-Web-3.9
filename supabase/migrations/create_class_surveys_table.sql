-- Migration: Create class_surveys table for survey reports
-- This table stores survey reports for classes

CREATE TABLE IF NOT EXISTS class_surveys (
    id TEXT PRIMARY KEY,
    class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    test_number INTEGER NOT NULL, -- Bài kiểm tra lần mấy
    responsible_person_id TEXT REFERENCES teachers(id) ON DELETE SET NULL, -- Người phụ trách
    report_date DATE NOT NULL, -- Ngày báo cáo
    content TEXT NOT NULL, -- Nội dung báo cáo
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_class_surveys_class_id ON class_surveys(class_id);
CREATE INDEX IF NOT EXISTS idx_class_surveys_responsible_person_id ON class_surveys(responsible_person_id);
CREATE INDEX IF NOT EXISTS idx_class_surveys_report_date ON class_surveys(report_date);

-- Add comment
COMMENT ON TABLE class_surveys IS 'Bảng lưu trữ báo cáo khảo sát cho các lớp học';
COMMENT ON COLUMN class_surveys.test_number IS 'Số thứ tự bài kiểm tra (lần mấy)';
COMMENT ON COLUMN class_surveys.responsible_person_id IS 'ID của người phụ trách (teacher)';
COMMENT ON COLUMN class_surveys.report_date IS 'Ngày báo cáo khảo sát';
COMMENT ON COLUMN class_surveys.content IS 'Nội dung báo cáo khảo sát';


