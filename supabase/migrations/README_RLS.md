# Row Level Security (RLS) Implementation

## 📋 Tổng quan

Migration này implement Row Level Security (RLS) cho tất cả các tables trong database, đảm bảo users chỉ có thể truy cập dữ liệu phù hợp với role của họ.

## 🔐 Security Model

### Roles và Permissions

1. **Admin**
   - ✅ Full access to all tables
   - ✅ Can insert/update/delete any record
   - ✅ Can view all data

2. **Teacher**
   - ✅ Read: Own profile, all classes, all students (for rosters)
   - ✅ Write: Own profile, sessions they teach, attendance for their sessions
   - ❌ Cannot modify: Payments, payroll (except own), costs

3. **Student**
   - ✅ Read: Own profile, own classes, own payments, own wallet transactions
   - ✅ Update: Own profile (limited fields)
   - ❌ Cannot modify: Other students' data, payments, classes

4. **Assistant**
   - ✅ Read: All data (for their work)
   - ✅ Write: Based on `assistant_type`:
     - `lesson_plan`: Can CRUD lesson_resources, lesson_tasks, lesson_outputs
     - `technical`: Can view technical tasks
   - ❌ Cannot modify: Financial data, other users' data

5. **Visitor**
   - ✅ Read: Public data only (home_posts, categories)
   - ❌ Cannot modify: Any data

## 🚀 Cách sử dụng

### 1. Apply Migration

Chạy migration trong Supabase SQL Editor:

```sql
-- Copy và paste nội dung từ enable_rls_with_policies.sql
```

### 2. Set User Context (cho Custom Auth)

Vì ứng dụng sử dụng custom auth (không phải Supabase Auth), bạn cần set user context trước khi query:

```sql
-- Set user context (ví dụ trong RPC function)
SET LOCAL app.current_user_role = 'admin';
SET LOCAL app.current_user_id = 'user@example.com';
```

### 3. Test Policies

```sql
-- Test với anon key (should fail nếu RLS working)
SELECT * FROM students;

-- Test với admin role
SET LOCAL app.current_user_role = 'admin';
SET LOCAL app.current_user_id = 'admin@edu.vn';
SELECT * FROM students; -- Should work

-- Test với student role
SET LOCAL app.current_user_role = 'student';
SET LOCAL app.current_user_id = 'S001';
SELECT * FROM students WHERE id = 'S001'; -- Should work
SELECT * FROM students WHERE id = 'S002'; -- Should work (read all allowed)
```

## ⚠️ Lưu ý quan trọng

### Custom Auth Limitations

RLS policies hiện tại sử dụng helper functions (`get_user_role()`, `get_user_id()`) để lấy user context từ:
1. JWT claims (nếu dùng Supabase Auth)
2. Session variables (`app.current_user_role`, `app.current_user_id`)

**Với custom auth, bạn cần:**

1. **Option 1: Set context trong RPC functions**
   ```sql
   CREATE OR REPLACE FUNCTION my_function()
   RETURNS TABLE(...) AS $$
   BEGIN
       SET LOCAL app.current_user_role = current_setting('request.jwt.claims', true)::json->>'role';
       SET LOCAL app.current_user_id = current_setting('request.jwt.claims', true)::json->>'sub';
       -- Your query here
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;
   ```

2. **Option 2: Migrate to Supabase Auth** (Khuyến nghị)
   - Sử dụng Supabase Auth thay vì custom auth
   - RLS sẽ tự động hoạt động với JWT tokens
   - Xem: `docs/SECURITY_UPGRADE_PLAN.md`

### Testing RLS

Sau khi apply migration:

1. **Test với anon key:**
   ```javascript
   const { data, error } = await supabase
     .from('students')
     .select('*');
   // Should fail hoặc return empty nếu RLS working
   ```

2. **Test với authenticated user:**
   ```javascript
   // Set user context via RPC hoặc service role
   const { data, error } = await supabase
     .from('students')
     .select('*');
   // Should return data based on user role
   ```

## 🔄 Migration Path

### Current State (Custom Auth)
- ✅ RLS enabled
- ⚠️ Requires manual context setting
- ⚠️ Less secure than Supabase Auth

### Recommended: Migrate to Supabase Auth
1. Implement Supabase Auth
2. Update RLS policies to use `auth.uid()` and `auth.role()`
3. Remove custom auth helpers
4. Test thoroughly

## 📚 Related Documentation

- `docs/SECURITY_AUDIT.md` - Full security audit
- `docs/SECURITY_UPGRADE_PLAN.md` - Security upgrade plan
- `docs/SECURITY_FIX_API_LEAK.md` - API leak fix guide

## ✅ Checklist

- [ ] Apply migration to database
- [ ] Test policies với anon key (should fail)
- [ ] Test policies với admin role
- [ ] Test policies với teacher role
- [ ] Test policies với student role
- [ ] Test policies với assistant role
- [ ] Update application code to set user context
- [ ] Monitor logs for RLS violations
- [ ] Adjust policies based on usage patterns

---

**Lưu ý:** RLS policies này là baseline. Bạn có thể cần điều chỉnh dựa trên requirements cụ thể của ứng dụng.

