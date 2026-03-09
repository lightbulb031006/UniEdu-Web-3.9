-- Xóa tất cả tài khoản admin giả, chỉ giữ lại admin chính: admin@edu.vn
-- Cách chạy: Supabase Dashboard → SQL Editor → dán nội dung dưới → Run

DELETE FROM users
WHERE role = 'admin'
  AND email != 'admin@edu.vn';
