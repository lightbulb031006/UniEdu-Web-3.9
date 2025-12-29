# 🚀 Hướng dẫn Deploy lên Vercel

## ✅ Vercel TỰ ĐỘNG cài đặt thư viện!

**Đúng rồi!** Vercel sẽ:
1. ✅ Tự động chạy `npm install` khi deploy
2. ✅ Tự động build project
3. ✅ **KHÔNG CẦN** commit `node_modules`
4. ✅ Hỗ trợ cả Backend (Serverless Functions) và Frontend

---

## 🎯 CÁCH HOẠT ĐỘNG

### **Khi bạn push code lên Git:**

```
1. Push code → GitHub/GitLab/Bitbucket
2. Vercel detect changes
3. Vercel tự động:
   - Clone repository
   - Chạy `npm install` (tạo node_modules)
   - Chạy `npm run build`
   - Deploy
```

**Bạn chỉ cần:**
- ✅ Commit code source
- ✅ Commit `package.json`
- ❌ **KHÔNG** commit `node_modules` (Vercel tự cài)

---

## 📋 DEPLOY BACKEND

### **Bước 1: Chuẩn bị**

Đảm bảo `backend/package.json` có script `build`:

```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/app.js"
  }
}
```

### **Bước 2: Tạo vercel.json**

Tạo file `backend/vercel.json`:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

### **Bước 3: Deploy**

**Cách 1: Vercel CLI (Recommended)**

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy backend
cd backend
vercel

# Follow prompts:
# - Set up and deploy? Yes
# - Which scope? (chọn account)
# - Link to existing project? No
# - Project name? uniedu-backend
# - Directory? ./
# - Override settings? No
```

**Cách 2: Vercel Dashboard**

1. Vào https://vercel.com
2. Click "New Project"
3. Import Git repository
4. **Root Directory:** `backend`
5. **Framework Preset:** Other
6. **Build Command:** `npm run build`
7. **Output Directory:** `dist`
8. **Install Command:** `npm install`
9. Click "Deploy"

### **Bước 4: Cấu hình Environment Variables**

Trong Vercel Dashboard → Project → Settings → Environment Variables:

```
SUPABASE_URL = https://vfbmdmspxkaatwzuprbt.supabase.co
SUPABASE_SERVICE_ROLE_KEY = eyJhbGci...
JWT_SECRET = UniEdu2024SecureJWTSecretKeyForAuthentication32Chars
FRONTEND_URL = https://your-frontend.vercel.app
NODE_ENV = production
```

**⚠️ QUAN TRỌNG:** 
- Không commit `.env` vào Git
- Set environment variables trong Vercel Dashboard

---

## 📋 DEPLOY FRONTEND

### **Bước 1: Chuẩn bị**

Đảm bảo `frontend/package.json` có script `build`:

```json
{
  "scripts": {
    "build": "tsc && vite build",
    "preview": "vite preview"
  }
}
```

### **Bước 2: Tạo vercel.json (Optional)**

Tạo file `frontend/vercel.json`:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### **Bước 3: Deploy**

**Cách 1: Vercel CLI**

```bash
cd frontend
vercel

# Follow prompts:
# - Project name? uniedu-frontend
# - Directory? ./
```

**Cách 2: Vercel Dashboard**

1. Click "New Project"
2. Import Git repository
3. **Root Directory:** `frontend`
4. **Framework Preset:** Vite
5. Vercel tự detect settings
6. Click "Deploy"

### **Bước 4: Cấu hình Environment Variables**

Trong Vercel Dashboard → Project → Settings → Environment Variables:

```
VITE_API_URL = https://your-backend.vercel.app/api
VITE_APP_NAME = UniEdu
VITE_APP_VERSION = 4.0.0
```

**⚠️ LƯU Ý:** 
- Vercel rebuild khi thay đổi environment variables
- Frontend cần rebuild để nhận biến mới

---

## 🔄 WORKFLOW HOÀN CHỈNH

### **1. Development (Local)**

```bash
# Backend
cd backend
npm install          # Cài dependencies
npm run dev         # Chạy local

# Frontend
cd frontend
npm install          # Cài dependencies
npm run dev         # Chạy local
```

### **2. Deploy (Vercel)**

```bash
# Push code lên Git
git add .
git commit -m "Update features"
git push

# Vercel tự động:
# 1. Detect changes
# 2. npm install (tự động)
# 3. npm run build (tự động)
# 4. Deploy (tự động)
```

**Bạn KHÔNG cần:**
- ❌ Commit `node_modules`
- ❌ Chạy `npm install` trên Vercel
- ❌ Build thủ công

---

## 📁 CẤU TRÚC PROJECT CHO VERCEL

### **Option 1: Monorepo (Recommended)**

```
your-repo/
├── backend/
│   ├── src/
│   ├── package.json
│   ├── vercel.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   ├── package.json
│   ├── vercel.json
│   └── vite.config.ts
└── .gitignore
```

**Deploy:**
- Backend: Root Directory = `backend`
- Frontend: Root Directory = `frontend`

### **Option 2: Separate Repos**

```
backend-repo/
└── (backend files)

frontend-repo/
└── (frontend files)
```

**Deploy:**
- Mỗi repo là một Vercel project riêng

---

## ⚙️ CẤU HÌNH NÂNG CAO

### **Backend: Serverless Functions**

Vercel tự động convert Express app thành Serverless Functions.

**File: `backend/api/index.ts`** (cho Vercel):

```typescript
import app from '../src/app';

export default app;
```

**File: `backend/vercel.json`:**

```json
{
  "version": 2,
  "builds": [
    {
      "src": "api/index.ts",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/api/index.ts"
    }
  ]
}
```

### **Frontend: Environment Variables**

Vercel tự động inject `VITE_*` variables vào build.

**Trong code:**
```typescript
const API_URL = import.meta.env.VITE_API_URL;
```

**Trong Vercel Dashboard:**
```
VITE_API_URL = https://api.example.com
```

---

## 🧪 TEST SAU KHI DEPLOY

### **Backend:**

```bash
# Test health endpoint
curl https://your-backend.vercel.app/api/health

# Test login
curl -X POST https://your-backend.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'
```

### **Frontend:**

1. Mở: `https://your-frontend.vercel.app`
2. Test login
3. Kiểm tra console (F12) xem có lỗi không

---

## 🐛 TROUBLESHOOTING

### **Lỗi: "Module not found"**

**Nguyên nhân:** Dependencies chưa được cài

**Giải pháp:**
- Kiểm tra `package.json` có đúng không
- Kiểm tra Vercel build logs
- Đảm bảo `npm install` chạy thành công

### **Lỗi: "Environment variable not found"**

**Nguyên nhân:** Chưa set environment variables

**Giải pháp:**
1. Vào Vercel Dashboard
2. Project → Settings → Environment Variables
3. Add variables
4. Redeploy

### **Lỗi: "Build failed"**

**Nguyên nhân:** Build command sai hoặc có lỗi

**Giải pháp:**
- Kiểm tra build logs trong Vercel
- Test build local: `npm run build`
- Fix lỗi và push lại

---

## 📊 SO SÁNH

| | Local Development | Vercel Deployment |
|---|------------------|-------------------|
| **node_modules** | Cài thủ công (`npm install`) | Vercel tự cài |
| **Build** | Chạy thủ công (`npm run build`) | Vercel tự build |
| **Deploy** | Manual | Tự động (khi push Git) |
| **Environment** | File `.env` | Vercel Dashboard |

---

## ✅ CHECKLIST

### **Trước khi deploy:**

- [ ] Code đã push lên Git
- [ ] `package.json` có script `build`
- [ ] `.gitignore` có `node_modules/`
- [ ] Test build local thành công

### **Sau khi deploy:**

- [ ] Set environment variables trong Vercel
- [ ] Test API endpoints
- [ ] Test frontend
- [ ] Kiểm tra logs

---

## 🎯 TÓM TẮT

1. ✅ **Vercel tự động cài `node_modules`** khi deploy
2. ✅ **KHÔNG CẦN** commit `node_modules`
3. ✅ **Chỉ cần** commit code và `package.json`
4. ✅ **Set environment variables** trong Vercel Dashboard
5. ✅ **Auto-deploy** khi push Git

---

**🎉 Vercel làm tất cả cho bạn! Chỉ cần push code và set environment variables!**

