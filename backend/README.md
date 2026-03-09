# UniEdu Backend API

Backend REST API cho hệ thống quản lý giáo dục UniEdu.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Environment Variables

Copy `.env.example` to `.env` và điền các giá trị:

```bash
cp .env.example .env
```

**⚠️ QUAN TRỌNG:** Bạn cần lấy các giá trị sau từ Supabase:

1. **SUPABASE_URL**: Từ Supabase Dashboard → Settings → API → Project URL
2. **SUPABASE_SERVICE_ROLE_KEY**: Từ Supabase Dashboard → Settings → API → Service Role Key (⚠️ SECRET!)
3. **JWT_SECRET**: Tạo một secret key mạnh (ít nhất 32 ký tự)

### 3. Generate JWT Secret

```bash
# Windows PowerShell
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes([System.Guid]::NewGuid().ToString() + [System.Guid]::NewGuid().ToString()))

# Hoặc dùng online tool: https://generate-secret.vercel.app/32
```

### 4. Run Development Server

```bash
npm run dev
```

Server sẽ chạy tại `http://localhost:3001`

## 📁 Cấu trúc Project

```
backend/
├── src/
│   ├── config/          # Configuration files
│   ├── middleware/      # Express middleware
│   ├── routes/         # API routes
│   ├── services/       # Business logic
│   ├── utils/          # Utility functions
│   └── app.ts          # Express app
├── .env.example        # Environment template
├── package.json
└── tsconfig.json
```

## 🔐 API Endpoints

### Authentication

- `POST /api/auth/login` - Đăng nhập
- `POST /api/auth/register` - Đăng ký
- `GET /api/auth/me` - Lấy thông tin user hiện tại (cần token)

### Health Check

- `GET /api/health` - Kiểm tra server status

## 🛠️ Development

```bash
# Development mode (with hot reload)
npm run dev

# Build for production
npm run build

# Run production build
npm start
```

## 🔒 Security

- ✅ JWT authentication
- ✅ Rate limiting
- ✅ Input validation (Zod)
- ✅ CORS protection
- ✅ Security headers (Helmet)
- ✅ Password hashing (bcrypt)

## 📝 Notes

- Backend sử dụng **SERVICE_ROLE_KEY** để bypass RLS (chỉ dùng trong backend)
- JWT tokens expire sau 15 phút (có thể config trong `.env`)
- Rate limiting: 100 requests/15 phút (general), 5 login attempts/15 phút (auth)

