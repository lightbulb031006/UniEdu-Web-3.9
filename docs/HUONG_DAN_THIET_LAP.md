# 📋 Hướng dẫn Thiết lập - Các bước cần làm với bên ngoài

Tài liệu này liệt kê **các bước bạn cần tự làm** khi liên quan đến bên ngoài (Supabase, deploy, etc.)

---

## ✅ ĐÃ HOÀN THÀNH TỰ ĐỘNG

Tôi đã tự động tạo:

1. ✅ **Backend structure** - Toàn bộ cấu trúc backend với Express + TypeScript
2. ✅ **Frontend structure** - Toàn bộ cấu trúc frontend với React + TypeScript
3. ✅ **Authentication system** - JWT auth, login/register endpoints
4. ✅ **Security middleware** - Rate limiting, error handling, validation
5. ✅ **Configuration files** - TypeScript config, package.json, etc.

---

## 🔧 CÁC BƯỚC BẠN CẦN LÀM

### **Bước 1: Cài đặt Dependencies**

#### Backend:
```bash
cd backend
npm install
```

#### Frontend:
```bash
cd frontend
npm install
```

---

### **Bước 2: Cấu hình Supabase (QUAN TRỌNG!)**

Bạn cần lấy các thông tin sau từ **Supabase Dashboard**:

1. **Mở Supabase Dashboard**: https://app.supabase.com
2. **Chọn project** của bạn
3. **Vào Settings → API**

#### Lấy SUPABASE_URL:
- Copy **Project URL** (ví dụ: `https://xxxxx.supabase.co`)

#### Lấy SUPABASE_SERVICE_ROLE_KEY:
- ⚠️ **QUAN TRỌNG**: Copy **Service Role Key** (KHÔNG phải anon key!)
- Service Role Key có quyền bypass RLS (chỉ dùng trong backend)

#### Tạo file `.env` trong thư mục `backend/`:

```bash
cd backend
# Copy file mẫu
Copy-Item env.example.txt .env
```

Mở file `.env` và điền:

```env
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# ⚠️ ĐIỀN CÁC GIÁ TRỊ TỪ SUPABASE:
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Tạo JWT secret (ít nhất 32 ký tự):
JWT_SECRET=your_very_long_and_secure_secret_key_here_at_least_32_chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
LOG_LEVEL=info
```

#### Tạo JWT Secret:

Bạn có thể tạo JWT secret bằng cách:

**Windows PowerShell:**
```powershell
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes([System.Guid]::NewGuid().ToString() + [System.Guid]::NewGuid().ToString()))
```

**Hoặc dùng online tool:**
- https://generate-secret.vercel.app/32
- Tạo một string ngẫu nhiên ít nhất 32 ký tự

---

### **Bước 3: Cấu hình Frontend**

Tạo file `.env` trong thư mục `frontend/`:

```bash
cd frontend
# Copy file mẫu
Copy-Item env.example.txt .env
```

Mở file `.env` và điền:

```env
VITE_API_URL=http://localhost:3001/api
VITE_APP_NAME=UniEdu
VITE_APP_VERSION=4.0.0
```

---

### **Bước 4: Chạy Backend**

```bash
cd backend
npm run dev
```

Backend sẽ chạy tại `http://localhost:3001`

**Kiểm tra:**
- Mở browser: http://localhost:3001/api/health
- Nếu thấy `{"status":"ok",...}` là thành công!

---

### **Bước 5: Chạy Frontend**

Mở terminal mới:

```bash
cd frontend
npm run dev
```

Frontend sẽ chạy tại `http://localhost:5173`

**Kiểm tra:**
- Mở browser: http://localhost:5173
- Bạn sẽ thấy trang login

---

### **Bước 6: Test Authentication**

1. **Đăng ký tài khoản mới:**
   - Tạo endpoint `/api/auth/register` (cần implement thêm UI)
   - Hoặc test bằng Postman/curl

2. **Đăng nhập:**
   - Vào http://localhost:5173/login
   - Nhập email và password
   - Nếu thành công, sẽ redirect về dashboard

---

## ⚠️ LƯU Ý QUAN TRỌNG

### **Supabase Service Role Key:**
- ⚠️ **KHÔNG BAO GIỜ** commit Service Role Key vào Git
- ⚠️ **KHÔNG BAO GIỜ** expose Service Role Key trong client-side code
- ⚠️ Chỉ dùng trong backend server

### **JWT Secret:**
- ⚠️ Phải là một string ngẫu nhiên, dài ít nhất 32 ký tự
- ⚠️ **KHÔNG BAO GIỜ** commit vào Git
- ⚠️ Mỗi môi trường (dev/prod) nên có secret khác nhau

### **Environment Variables:**
- ✅ File `.env` đã được thêm vào `.gitignore`
- ✅ Chỉ commit `.env.example` (không có giá trị thực)

---

## 🐛 TROUBLESHOOTING

### **Backend không chạy:**
- Kiểm tra PORT 3001 có bị chiếm không: `netstat -ano | findstr :3001`
- Kiểm tra `.env` file có đúng format không
- Kiểm tra Supabase credentials có đúng không

### **Frontend không kết nối được API:**
- Kiểm tra backend có đang chạy không
- Kiểm tra `VITE_API_URL` trong `.env` có đúng không
- Kiểm tra CORS settings trong backend

### **Authentication không work:**
- Kiểm tra JWT_SECRET có set không
- Kiểm tra Supabase connection có thành công không
- Kiểm tra user có tồn tại trong database không

---

## 📝 CHECKLIST

- [ ] Cài đặt dependencies (backend + frontend)
- [ ] Lấy Supabase URL và Service Role Key
- [ ] Tạo JWT secret
- [ ] Tạo file `.env` cho backend
- [ ] Tạo file `.env` cho frontend
- [ ] Chạy backend và test health endpoint
- [ ] Chạy frontend và test login
- [ ] Test authentication flow

---

## 🚀 NEXT STEPS

Sau khi setup xong:

1. **Implement thêm CRUD APIs** (students, teachers, classes, etc.)
2. **Migrate UI components** từ app cũ
3. **Add more features** (reports, payments, etc.)
4. **Deploy** lên production (Vercel, Railway, etc.)

Xem `KE_HOACH_TAI_CAU_TRUC.md` để có kế hoạch chi tiết.

---

**Lưu ý:** Nếu gặp lỗi, kiểm tra console logs và đảm bảo tất cả environment variables đã được set đúng.

