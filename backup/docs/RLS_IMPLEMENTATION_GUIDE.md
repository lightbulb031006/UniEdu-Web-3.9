# 🔒 Hướng dẫn Implement Row Level Security (RLS)

## 📋 Tổng quan

Đã tạo 2 migration files cho RLS:

1. **`enable_rls_block_anon.sql`** - Block anon key hoàn toàn (Khuyến nghị)
   - RLS enabled, NO policies = block tất cả
   - Chỉ service role key hoặc RPC functions có thể truy cập
   - Bảo mật cao nhất

2. **`enable_rls_simple.sql`** - Version tạm thời (Chỉ để test)
   - Có policies cho phép tất cả
   - ⚠️ Vẫn cho phép anon key
   - Chỉ dùng để test, sau đó chuyển sang block_anon

2. **`enable_rls_with_policies.sql`** - Version đầy đủ với role-based policies
   - Policies dựa trên role (admin, teacher, student, etc.)
   - Cần custom auth integration
   - Phức tạp hơn nhưng bảo mật tốt hơn

## 🚀 Bước 1: Apply RLS Block Anon (Khuyến nghị)

### 1.1 Chạy Migration

1. Mở Supabase Dashboard → SQL Editor
2. Copy nội dung từ `supabase/migrations/enable_rls_block_anon.sql`
3. Paste và chạy
4. ⚠️ **Lưu ý:** Sau khi chạy, anon key sẽ bị block hoàn toàn!

### 1.2 Test RLS

```javascript
// Test với anon key (should FAIL)
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(SUPABASE_URL, ANON_KEY);

const { data, error } = await supabase
  .from('students')
  .select('*');

console.log('Anon key result:', error); // Should have error
```

**Kết quả mong đợi:**
- ✅ Anon key bị block → Error hoặc empty result
- ✅ Service role key vẫn hoạt động (nếu dùng)

### 1.3 Update Application Code

Vì anon key bị block, bạn cần:

**Option A: Sử dụng Service Role Key (Backend only!)**
```javascript
// ⚠️ CHỈ dùng ở backend, KHÔNG expose trong client!
const supabase = createClient(
  SUPABASE_URL, 
  SERVICE_ROLE_KEY // ⚠️ Never expose this!
);
```

**Option B: Tạo Backend API Proxy**
```javascript
// Backend API (Node.js/Express)
app.post('/api/students', async (req, res) => {
  // Verify user authentication
  const user = await verifyUser(req.headers.authorization);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  
  // Use service role key
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  
  // Apply authorization logic
  if (user.role === 'student') {
    // Only return own data
    const { data } = await supabase
      .from('students')
      .select('*')
      .eq('id', user.linkId);
    return res.json(data);
  }
  
  // Admin can see all
  const { data } = await supabase.from('students').select('*');
  res.json(data);
});
```

## 🔐 Bước 2: Implement Role-Based Policies (Nâng cao)

### 2.1 Chạy Advanced Migration

1. Backup database trước!
2. Chạy `supabase/migrations/enable_rls_with_policies.sql`
3. Test từng policy

### 2.2 Set User Context

Vì dùng custom auth, cần set context trong RPC functions:

```sql
CREATE OR REPLACE FUNCTION get_students_for_user()
RETURNS TABLE(...) AS $$
BEGIN
    -- Set user context from JWT or parameters
    SET LOCAL app.current_user_role = current_setting('request.jwt.claims', true)::json->>'role';
    SET LOCAL app.current_user_id = current_setting('request.jwt.claims', true)::json->>'sub';
    
    -- Query sẽ tự động apply RLS policies
    RETURN QUERY SELECT * FROM students;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 2.3 Call RPC từ Application

```javascript
// From application
const { data, error } = await supabase.rpc('get_students_for_user', {
  user_role: currentUser.role,
  user_id: currentUser.id
});
```

## ⚠️ Lưu ý quan trọng

### Custom Auth Limitations

1. **RLS không tự động hoạt động với custom auth**
   - Cần set user context manually
   - Hoặc dùng service role key + application-level auth

2. **Khuyến nghị: Migrate to Supabase Auth**
   - RLS tự động hoạt động với JWT tokens
   - Không cần set context manually
   - Bảo mật tốt hơn

### Security Best Practices

1. **Never expose service role key**
   - Chỉ dùng ở backend
   - Không commit vào code
   - Sử dụng environment variables

2. **Implement application-level authorization**
   - Check user role trước khi query
   - Validate permissions
   - Log access attempts

3. **Monitor RLS violations**
   - Check Supabase logs
   - Alert on suspicious activity
   - Review policies regularly

## 📊 Testing Checklist

- [ ] Apply simple RLS migration
- [ ] Test anon key (should fail)
- [ ] Test service role key (should work)
- [ ] Update application code
- [ ] Test all CRUD operations
- [ ] Monitor logs for errors
- [ ] (Optional) Apply advanced RLS
- [ ] Test role-based policies
- [ ] Document any issues

## 🔄 Migration Path

### Current: Custom Auth + Simple RLS
```
Client → Application → Service Role Key → Supabase
                    ↓
            Application-level Auth
```

### Recommended: Supabase Auth + RLS
```
Client → Supabase Auth → JWT Token → Supabase (with RLS)
                              ↓
                    Automatic RLS enforcement
```

## 📚 Related Files

- `supabase/migrations/enable_rls_simple.sql` - Simple RLS
- `supabase/migrations/enable_rls_with_policies.sql` - Advanced RLS
- `supabase/migrations/README_RLS.md` - RLS documentation
- `docs/SECURITY_UPGRADE_PLAN.md` - Security upgrade plan

## ✅ Next Steps

1. **Immediate:** Apply simple RLS migration
2. **Short-term:** Implement backend API proxy
3. **Long-term:** Migrate to Supabase Auth
4. **Ongoing:** Monitor and adjust policies

---

**Lưu ý:** RLS là một layer bảo mật quan trọng, nhưng không thay thế application-level authorization. Nên implement cả hai!

