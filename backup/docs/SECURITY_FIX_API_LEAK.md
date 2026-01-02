# 🔧 Hướng dẫn Fix Lỗi Rò Rỉ API Database

## 🚨 Vấn đề

Supabase URL và anon key đang được hardcode trong `assets/js/supabase-config.js`, file này được load công khai trong client-side, dẫn đến rò rỉ credentials.

---

## ✅ Giải pháp

### **Option 1: Environment Variables (Khuyến nghị cho Production)**

#### Bước 1: Tạo file `.env` (KHÔNG commit vào git)

```bash
# .env (thêm vào .gitignore)
SUPABASE_URL=https://vfbmdmspxkaatwzuprbt.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Bước 2: Sử dụng build tool để inject env variables

**Nếu dùng Vite:**
```javascript
// vite.config.js
export default {
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(process.env.SUPABASE_URL),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(process.env.SUPABASE_ANON_KEY)
  }
}
```

**Nếu dùng Webpack:**
```javascript
// webpack.config.js
const webpack = require('webpack');
module.exports = {
  plugins: [
    new webpack.DefinePlugin({
      'process.env.SUPABASE_URL': JSON.stringify(process.env.SUPABASE_URL),
      'process.env.SUPABASE_ANON_KEY': JSON.stringify(process.env.SUPABASE_ANON_KEY)
    })
  ]
}
```

#### Bước 3: Update `supabase-config.js`

```javascript
// assets/js/supabase-config.js
window.SUPABASE_CONFIG = {
    url: import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
    enabled: !!(import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL)
};
```

---

### **Option 2: Backend Proxy (Khuyến nghị cho Production cao cấp)**

Tạo một backend API để proxy requests đến Supabase, ẩn credentials khỏi client.

#### Kiến trúc:
```
Client → Your Backend API → Supabase
```

#### Backend API Example (Node.js/Express):

```javascript
// backend/routes/supabase-proxy.js
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Dùng service role key ở backend
);

// Proxy các requests
router.post('/query', async (req, res) => {
  const { table, action, data, filters } = req.body;
  
  // Validate user authentication
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // Validate user permissions
  // ... your authorization logic ...
  
  try {
    let result;
    switch (action) {
      case 'select':
        result = await supabase.from(table).select('*').match(filters);
        break;
      case 'insert':
        result = await supabase.from(table).insert(data);
        break;
      // ... other actions ...
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

#### Client-side:

```javascript
// assets/js/supabase-adapter.js
// Thay vì gọi Supabase trực tiếp, gọi backend API
async function querySupabase(table, action, data) {
  const response = await fetch('/api/supabase-proxy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify({ table, action, data })
  });
  return response.json();
}
```

---

### **Option 3: Runtime Configuration (Tạm thời - Không khuyến nghị)**

Load config từ server endpoint (vẫn cần authentication).

```javascript
// assets/js/supabase-config.js
async function loadSupabaseConfig() {
  try {
    const response = await fetch('/api/config/supabase', {
      credentials: 'include'
    });
    const config = await response.json();
    window.SUPABASE_CONFIG = config;
  } catch (error) {
    console.error('Failed to load Supabase config:', error);
    window.SUPABASE_CONFIG = { enabled: false };
  }
}

loadSupabaseConfig();
```

---

## 🔐 Bảo vệ Anon Key với RLS

**QUAN TRỌNG:** Dù có fix rò rỉ, vẫn cần đảm bảo RLS (Row Level Security) được enable.

### Kiểm tra RLS:

```sql
-- Kiểm tra RLS đã enable chưa
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- Enable RLS cho table
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
-- ... các tables khác
```

### Tạo RLS Policies:

```sql
-- Ví dụ: Chỉ cho phép user đọc dữ liệu của chính họ
CREATE POLICY "Users can view own data"
ON students
FOR SELECT
USING (auth.uid() = user_id);

-- Ví dụ: Admin có thể đọc tất cả
CREATE POLICY "Admins can view all"
ON students
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
);
```

### Test RLS:

```javascript
// Test với anon key
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(SUPABASE_URL, ANON_KEY);

// Nên fail nếu không có authentication
const { data, error } = await supabase
  .from('students')
  .select('*');
  
if (error) {
  console.log('✅ RLS working - access denied');
} else {
  console.log('⚠️ RLS not working - data exposed!');
}
```

---

## 🔄 Rotate Keys (Sau khi fix)

1. **Tạo anon key mới** trong Supabase Dashboard
2. **Update config** với key mới
3. **Revoke key cũ** sau 24-48h (để đảm bảo không có service nào còn dùng)
4. **Monitor logs** để đảm bảo không có lỗi

---

## ✅ Checklist

- [ ] Di chuyển credentials ra khỏi client-side code
- [ ] Thêm `.env` vào `.gitignore`
- [ ] Enable RLS cho tất cả tables
- [ ] Tạo và test RLS policies
- [ ] Rotate anon key
- [ ] Test lại toàn bộ ứng dụng
- [ ] Monitor logs sau khi deploy

---

## 📚 Tài liệu tham khảo

- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Environment Variables Best Practices](https://12factor.net/config)
- [OWASP API Security](https://owasp.org/www-project-api-security/)

