# Lịch sử thay đổi (Changelog)

Mỗi khi đẩy phiên bản mới lên git, cập nhật file này để ghi lại nội dung thay đổi.  
Định dạng dựa trên [Keep a Changelog](https://keepachangelog.com/vi/1.0.0/).

---

## Quy ước giao tiếp khi làm việc nhóm (Git)

**Mục đích:** Để người cùng repo biết bạn đã thay đổi những gì mỗi lần push.

**Chuẩn cần làm mỗi lần có thay đổi và đẩy lên git:**

1. **Cập nhật CHANGELOG.md** trước khi commit:
   - Nếu chưa ra version mới: ghi vào mục **[Unreleased]** (Đã thêm / Đã thay đổi / Đã sửa / Bảo mật, v.v.).
   - Khi release version: chuyển nội dung [Unreleased] thành mục version mới (vd. `[4.5.6] - 2025-03`) rồi để [Unreleased] trống cho lần sau.

2. **Commit message** nên rõ ràng, ví dụ:
   - `feat: thêm API xyz`
   - `fix: sửa lỗi đăng nhập trên mobile`
   - `docs: cập nhật README mục API`
   - `chore: cập nhật CHANGELOG cho v4.5.6`

3. **Người pull về:** Đọc **CHANGELOG.md** (mục [Unreleased] hoặc version mới nhất) để biết nội dung thay đổi thay vì phải đọc từng commit/diff.

---

## [Unreleased]

_Thay đổi chưa phát hành — thêm vào đây trước khi tag version._

---

## [4.6.1] - 2026-03

### Đã thay đổi
- **supabase/schema.sql:** Đồng bộ đầy đủ với các migration đang dùng — thêm cột thiếu và bảng mới: `classes` (teacher_ids, scale_amount, max_allowance_per_session, student_tuition_per_session, tuition_package_*), `teachers` (active_class_ids, taught_class_ids), `students` (cskh_*), `class_teachers` (status, removed_at), `student_classes` (remaining_sessions, student_fee_*, total_*), `sessions` (tuition_fee), `attendance` (status), `costs` (date, status), `wallet_transactions` (type extend/refund), `lesson_outputs` (source, original_link); thêm bảng `class_surveys`, `staff_monthly_stats`, `cskh_payment_status`, `action_history`; thêm index và RLS/trigger tương ứng.

---

## [4.6.0] - 2025-03

### Đã thêm
- CHANGELOG: mục **Quy ước giao tiếp khi làm việc nhóm** — chuẩn cập nhật CHANGELOG + commit message mỗi lần push để đồng đội biết thay đổi.
- Cursor rule `.cursor/rules/changelog.mdc`: từ nay khi AI/agent thay đổi dự án sẽ tự cập nhật CHANGELOG.

### Bảo mật
- **Nhân sự (staff):** Giáo viên chỉ được truy cập hồ sơ cá nhân của mình. Backend kiểm tra `id` trong URL phải trùng `linkId` trong JWT; nếu đổi đuôi route sang id nhân sự khác sẽ trả 403. Admin vẫn xem được mọi hồ sơ.
- JWT bổ sung `linkId` cho role teacher (login + refresh). Tất cả API `/api/staff/:id/*` và POST `/api/staff/unpaid-amounts` yêu cầu đăng nhập; teacher chỉ được gọi với `:id` = chính mình (hoặc unpaid-amounts chỉ trả dữ liệu của mình).
- Frontend: StaffDetail và StaffCSKHDetail redirect giáo viên về `/staff/{linkId}` (hoặc `/staff/{linkId}/cskh`) nếu họ truy cập `/staff/{id khác}`.
- **Fix vẫn xem được hồ sơ người khác khi đổi ID trên URL:** (1) Backend GET `/api/teachers` và GET `/api/teachers/:id`: với role teacher chỉ trả về bản ghi của chính mình (linkId); teacher gọi với :id khác → 404. (2) Backend staff + teachers: khi token cũ chưa có linkId thì load `link_id` từ DB rồi kiểm tra. (3) Frontend: gọi `/auth/me` khi teacher chưa có linkId để lấy linkId rồi redirect; chỉ bật fetch dữ liệu hồ sơ khi `id === user.linkId`; giáo viên không dùng cache danh sách teachers để tránh hiển thị nhầm.

---

## [4.5.5] - 2025

### Đã thêm
- README chuyên nghiệp: mục lục, tổng quan, bảng tính năng, tech stack, cấu hình env, API & modules, bảo mật, tài liệu.

### Đã thay đổi
- README: viết lại đầy đủ, dễ tra cứu.

### Bảo mật
- .gitignore: thêm `.agents/`, `skills-lock.json` để không đẩy lên git.

---

## Cách xem thay đổi bằng Git

### Xem danh sách commit (nội dung thay đổi từng lần push)
```bash
git log --oneline -20
```

### Xem chi tiết thay đổi giữa 2 commit
```bash
git diff <commit-cũ> <commit-mới>
# Ví dụ: git diff 3793b06 5099dca
```

### Xem thay đổi của 1 commit cụ thể
```bash
git show <commit-hash>
```

### Nếu dùng tag theo version (vd: v4.5.5)
```bash
# Tạo tag cho phiên bản hiện tại
git tag -a v4.5.5 -m "Release 4.5.5"

# Đẩy tag lên remote
git push origin v4.5.5

# Xem thay đổi giữa 2 version
git log v4.5.4..v4.5.5 --oneline
git diff v4.5.4..v4.5.5
```

---

[Unreleased]: https://github.com/Hanguy21/UniEdu-Web-3.9/compare/v4.6.1...HEAD
[4.6.1]: https://github.com/Hanguy21/UniEdu-Web-3.9/compare/v4.6.0...v4.6.1
[4.6.0]: https://github.com/Hanguy21/UniEdu-Web-3.9/compare/v4.5.5...v4.6.0
[4.5.5]: https://github.com/Hanguy21/UniEdu-Web-3.9/compare/v4.5.4...v4.5.5
