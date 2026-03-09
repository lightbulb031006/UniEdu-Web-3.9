# UniEdu — Hệ thống Quản lý Giáo dục

Hệ thống quản lý giáo dục toàn diện với kiến trúc Backend/Frontend tách biệt, xác thực JWT, và cơ sở dữ liệu Supabase (PostgreSQL).

---

## Mục lục

- [Tổng quan](#tổng-quan)
- [Tính năng chính](#tính-năng-chính)
- [Kiến trúc & Cấu trúc dự án](#kiến-trúc--cấu-trúc-dự-án)
- [Công nghệ sử dụng](#công-nghệ-sử-dụng)
- [Yêu cầu hệ thống](#yêu-cầu-hệ-thống)
- [Cài đặt & Chạy dự án](#cài-đặt--chạy-dự-án)
- [Cấu hình môi trường](#cấu-hình-môi-trường)
- [API & Modules](#api--modules)
- [Cơ sở dữ liệu](#cơ-sở-dữ-liệu)
- [Bảo mật](#bảo-mật)
- [Tài liệu](#tài-liệu)
- [Giấy phép](#giấy-phép)

---

## Tổng quan

UniEdu là nền tảng quản lý giáo dục hỗ trợ:

- **Quản lý học viên, lớp học, giáo viên** — CRUD, gán lớp, theo dõi học phí, buổi học còn lại.
- **Tài chính** — Thu chi, ví (wallet), thanh toán, trợ cấp, thống kê.
- **Nhân sự & CSKH** — Quản lý nhân viên, thù lao, trạng thái thanh toán CSKH, thống kê theo tháng.
- **Lịch & Điểm danh** — Buổi học (sessions), điểm danh theo phiên.
- **Giáo án & Tài liệu** — Kế hoạch bài học, chủ đề, bài tập, tài nguyên, tài liệu, liên kết.
- **Khảo sát** — Khảo sát theo lớp.
- **Lịch sử thao tác** — Ghi log và hoàn tác (undo) thao tác quan trọng.
- **Dashboard** — Tổng quan, cảnh báo, thống kê nhanh.

Frontend dùng React (Vite), state Zustand, lazy loading; Backend dùng Express + TypeScript, kết nối Supabase.

---

## Tính năng chính

| Nhóm | Tính năng |
|------|-----------|
| **Xác thực** | Đăng nhập, đăng ký, JWT, refresh token, quản lý profile, danh sách user |
| **Học viên** | Danh sách, chi tiết, tài chính theo lớp, gia hạn/hoàn tiền buổi, gỡ khỏi lớp, cập nhật học phí |
| **Lớp học** | CRUD lớp, chi tiết lớp, học viên + buổi còn lại, thêm/xóa/chuyển học viên, thêm/xóa giáo viên, dữ liệu chi tiết |
| **Giáo viên** | CRUD giáo viên |
| **Nhân sự** | Danh sách staff, chi tiết, khoản chưa thanh toán, work items, thưởng, link QR thanh toán, CSKH (trạng thái thanh toán, % lợi nhuận, bulk, chi tiết) |
| **Buổi học** | CRUD sessions, xem công khai (optional auth) |
| **Điểm danh** | Theo session, tạo/xóa điểm danh |
| **Thanh toán** | CRUD payments, thống kê |
| **Ví** | CRUD wallet transactions |
| **Chi phí** | CRUD costs |
| **Thưởng** | CRUD bonuses |
| **Khảo sát** | CRUD, theo lớp, xem theo class/id |
| **Giáo án** | Lesson plans, topics, outputs, tasks, resources, topic links, documents, categories; bulk update status, bulk order |
| **Trang chủ** | Bài viết (posts) theo category, CRUD (có auth) |
| **Dashboard** | Tổng quan, quick-view |
| **Lịch sử** | Action history, undo |
| **Lịch** | Trang Schedule |
| **Giao diện** | Sidebar responsive, modal, chart (Bar, Pie, DualLine), skeleton loader, bảo vệ route |

---

## Kiến trúc & Cấu trúc dự án

```
UniEdu3.0/
├── backend/                 # REST API (Node.js + Express + TypeScript)
│   ├── src/
│   │   ├── config/          # env, database (Supabase client)
│   │   ├── middleware/      # auth, rateLimit, errorHandler
│   │   ├── routes/          # Định tuyến API (auth, dashboard, students, classes, ...)
│   │   ├── services/        # Logic nghiệp vụ, gọi Supabase
│   │   ├── utils/           # logger, errors, supabaseError
│   │   ├── scripts/         # migrate-user, create-admin, debug-login, check-admin
│   │   └── app.ts           # Entry, mount routes
│   └── package.json
├── frontend/                # SPA (React 18 + TypeScript + Vite)
│   ├── src/
│   │   ├── components/       # Layout, Sidebar, Modal, AuthModal, Charts, ...
│   │   ├── pages/           # Home, Dashboard, Students, Classes, Staff, ...
│   │   ├── utils/           # clearCache, ...
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── package.json
├── supabase/
│   └── migrations/         # SQL migrations (RLS, bảng, cột)
├── docs/                    # Tài liệu tiếng Việt (setup, deploy, báo cáo, logic)
└── README.md
```

- **Backend**: API REST tại `/api/*`, health check `/api/health`.
- **Frontend**: SPA với React Router, route bảo vệ (`ProtectedRoute`), lazy load trang.

---

## Công nghệ sử dụng

### Backend

| Công nghệ | Mục đích |
|-----------|----------|
| Node.js + Express | HTTP server, REST API |
| TypeScript | Type safety |
| Supabase (PostgreSQL) | Cơ sở dữ liệu, client `@supabase/supabase-js` |
| JWT (jsonwebtoken) | Access & refresh token |
| bcryptjs | Mã hóa mật khẩu |
| Zod | Validation dữ liệu |
| Helmet | Security headers |
| express-rate-limit | Giới hạn tần suất request |
| dotenv | Biến môi trường |

### Frontend

| Công nghệ | Mục đích |
|-----------|----------|
| React 18 | UI |
| TypeScript | Type safety |
| Vite | Build & dev server |
| React Router v6 | Định tuyến, lazy loading |
| Zustand | State management |
| Axios | HTTP client |
| Tailwind CSS | Styling |
| PostCSS, Autoprefixer | CSS tooling |

### Cơ sở dữ liệu & DevOps

- **Supabase**: PostgreSQL, RLS (Row Level Security), migrations trong `supabase/migrations/`.
- **Deploy**: Hướng dẫn deploy frontend lên Vercel trong `docs/`.

---

## Yêu cầu hệ thống

- **Node.js** ≥ 18 (khuyến nghị LTS)
- **npm** hoặc **yarn**
- **Tài khoản Supabase** (Project URL + Service Role Key cho backend)

---

## Cài đặt & Chạy dự án

### 1. Clone và cài dependency

```bash
# Backend
cd backend
npm install

# Frontend (từ thư mục gốc dự án)
cd frontend
npm install
```

### 2. Cấu hình môi trường

- **Backend**: Tạo `backend/.env` từ `env.example.txt`, điền `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `FRONTEND_URL`, v.v. (xem [Cấu hình môi trường](#cấu-hình-môi-trường)).
- **Frontend**: Tạo `frontend/.env` với `VITE_API_URL`, `VITE_APP_NAME`, `VITE_APP_VERSION`.

### 3. Chạy development

**Terminal 1 — Backend**

```bash
cd backend
npm run dev
```

API: **http://localhost:3001** (mặc định).

**Terminal 2 — Frontend**

```bash
cd frontend
npm run dev
```

Giao diện: **http://localhost:5173**.

### 4. Build production

```bash
# Backend
cd backend && npm run build && npm start

# Frontend
cd frontend && npm run build
```

Output frontend nằm trong `frontend/dist/`, có thể deploy tĩnh (ví dụ Vercel).

---

## Cấu hình môi trường

### Backend (`backend/.env`)

| Biến | Mô tả |
|------|--------|
| `PORT` | Cổng server (mặc định 3001) |
| `NODE_ENV` | `development` / `production` |
| `FRONTEND_URL` | URL frontend (CORS) |
| `SUPABASE_URL` | Project URL từ Supabase Dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role Key (không dùng anon key) |
| `JWT_SECRET` | Secret ký JWT (≥ 32 ký tự) |
| `JWT_EXPIRES_IN` | Thời hạn access token (vd: 15m) |
| `JWT_REFRESH_EXPIRES_IN` | Thời hạn refresh token (vd: 7d) |
| `RATE_LIMIT_*` | Cấu hình rate limit |
| `LOG_LEVEL` | Mức log |

### Frontend (`frontend/.env`)

| Biến | Mô tả |
|------|--------|
| `VITE_API_URL` | Base URL API (vd: http://localhost:3001/api) |
| `VITE_APP_NAME` | Tên ứng dụng |
| `VITE_APP_VERSION` | Phiên bản hiển thị |

Chi tiết từng bước (tạo JWT secret, lấy Supabase keys): xem **docs/HUONG_DAN_THIET_LAP.md**.

---

## API & Modules

Các route API được mount dưới tiền tố `/api`:

| Tiền tố | Mô tả |
|---------|--------|
| `/api/health` | Health check (GET) |
| `/api/auth` | Login, register, me, users, refresh, profile |
| `/api/dashboard` | Dashboard, quick-view |
| `/api/students` | CRUD, class-financial-data, extend/refund/remove-class, class-fee |
| `/api/classes` | CRUD, students-with-remaining, add/remove-student, remove-teacher, move-student, detail-data |
| `/api/teachers` | CRUD |
| `/api/staff` | unpaid, unpaid-amounts, work-items, bonuses, qr-payment-link, login-info, cskh/*, detail-data |
| `/api/sessions` | CRUD |
| `/api/attendance` | List, post/delete theo session |
| `/api/payments` | CRUD, statistics |
| `/api/wallet-transactions` | CRUD |
| `/api/costs` | CRUD |
| `/api/bonuses` | CRUD |
| `/api/surveys` | By class, CRUD |
| `/api/action-history` | List, create, undo |
| `/api/lesson-plans` | CRUD |
| `/api/lesson-topics` | initialize-defaults, CRUD |
| `/api/lesson-outputs` | CRUD, bulk-update-status |
| `/api/lesson-tasks` | CRUD, bulk-update-status |
| `/api/lesson-resources` | CRUD |
| `/api/lesson-topic-links` | CRUD, bulk, bulk-order, delete by-topic-and-output |
| `/api/documents` | CRUD |
| `/api/categories` | CRUD |
| `/api/home` | posts (get by category), CRUD posts |

Đa số endpoint bảo vệ bằng middleware `authenticate`; một số dùng `optionalAuthenticate` (vd: xem lớp, session, survey).

---

## Cơ sở dữ liệu

- **PostgreSQL** trên Supabase.
- **Migrations**: Thư mục `supabase/migrations/` chứa các file `.sql` (bảng, cột, RLS, policy).
- Một số migration đáng chú ý: RLS (enable_rls_*), bảng khảo sát lớp, trạng thái điểm danh, loại giao dịch ví, cache dashboard/staff stats, lịch sử thao tác, học phí session, trợ cấp, cột nguồn/liên kết bài học, v.v.

Chạy migrations theo hướng dẫn trong **docs/HUONG_DAN_CHAY_MIGRATIONS.md** (và các file HUONG_DAN_CHAY_MIGRATION_* nếu có).

---

## Bảo mật

- **JWT**: Access + refresh token, kiểm tra qua middleware.
- **Mật khẩu**: Băm bằng bcrypt (backend).
- **Rate limiting**: Giới hạn request theo IP/window.
- **CORS**: Chỉ cho phép origin cấu hình (development/production, bao gồm Vercel và custom domain).
- **Helmet**: Security headers.
- **Validation**: Zod cho dữ liệu đầu vào.
- **RLS**: Row Level Security trên Supabase; backend dùng Service Role khi cần.

---

## Theo dõi thay đổi giữa các phiên bản

- **CHANGELOG.md** — Ghi lại nội dung thay đổi mỗi lần phát hành (thêm/sửa tính năng, sửa lỗi, v.v.). Mỗi khi đẩy version mới, cập nhật CHANGELOG rồi mới commit/push.
- **Git:** Xem lịch sử commit: `git log --oneline`; xem diff giữa 2 commit: `git diff <commit-cũ> <commit-mới>`; nếu dùng tag (vd. `v4.5.5`): `git log v4.5.4..v4.5.5 --oneline`. Chi tiết trong **CHANGELOG.md**.

---

## Tài liệu

| Tài liệu | Nội dung |
|----------|----------|
| **docs/HUONG_DAN_THIET_LAP.md** | Thiết lập dự án, Supabase, .env, chạy backend/frontend |
| **docs/HUONG_DAN_DEPLOY_VERCEL.md** | Deploy frontend lên Vercel |
| **docs/HUONG_DAN_CHAY_MIGRATIONS.md** | Chạy migrations Supabase |
| **docs/HUONG_DAN_CHAY_MIGRATION_*.md** | Hướng dẫn migration cụ thể (attendance, wallet types, ...) |
| **docs/HUONG_DAN_*.md** | Cache, invalidate cache, staff stats, v.v. |
| **docs/LOGIC_*.md** | Logic nghiệp vụ (lớp đang dạy, khảo sát, ...) |
| **docs/BAO_CAO_*.md** | Báo cáo tính năng (dashboard alert, tab khảo sát, sidebar, optimistic updates, ...) |
| **docs/VI_DU_AP_DUNG_OPTIMISTIC_UPDATE.md** | Ví dụ optimistic update |
| **docs/ATTENDANCE_STATUS_UPDATE_REPORT.md** | Báo cáo cập nhật trạng thái điểm danh |

---

## Giấy phép

Dự án sử dụng giấy phép **MIT**.

---

**Phiên bản:** 4.6.1  
**Cập nhật:** 2025
