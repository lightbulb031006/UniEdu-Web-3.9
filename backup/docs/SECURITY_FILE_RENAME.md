# 🔒 Security Fix: File Rename

**Ngày:** 2025-01-XX  
**Vấn đề:** File `supabase-config.js` có tên rõ ràng, dễ bị phát hiện trong Developer Tools

---

## 🚨 Vấn đề

File `supabase-config.js` có tên rõ ràng cho thấy đây là file chứa cấu hình Supabase, khiến:
- Dễ bị phát hiện trong Developer Tools > Sources
- Attacker có thể nhanh chóng tìm thấy file chứa credentials
- Tên file tiết lộ mục đích và nội dung

---

## ✅ Giải pháp

### 1. Đổi tên file
- **Cũ:** `assets/js/supabase-config.js`
- **Mới:** `assets/js/app-init.js`

### 2. Lý do chọn tên mới
- `app-init.js` là tên generic, không tiết lộ nội dung
- Vẫn dễ hiểu cho developers (app initialization)
- Không gợi ý về Supabase hoặc credentials

### 3. Cập nhật references
- ✅ `index.html` - Updated script tag
- ✅ Comments trong file - Updated để không quá rõ ràng

---

## 📋 Files Changed

1. **Renamed:**
   - `assets/js/supabase-config.js` → `assets/js/app-init.js`

2. **Updated:**
   - `index.html:516` - Script tag reference
   - `assets/js/app-init.js` - Comments (less revealing)

---

## ⚠️ Lưu ý

**Đây chỉ là biện pháp bảo mật cơ bản (security through obscurity).**

Các biện pháp bảo mật thực sự:
1. ✅ **Row Level Security (RLS)** - QUAN TRỌNG NHẤT
2. ✅ Environment variables trong production
3. ✅ Backend proxy cho sensitive operations
4. ✅ Rotate keys định kỳ

**File rename chỉ giúp:**
- Giảm khả năng attacker nhanh chóng tìm thấy file
- Không phải là giải pháp bảo mật chính
- Vẫn cần RLS và các biện pháp khác

---

## 🔗 Related

- `docs/SECURITY_AUDIT.md` - Full security audit
- `docs/SECURITY_FIX_API_LEAK.md` - API leak fix guide
- `docs/SECURITY_UPGRADE_PLAN.md` - Security upgrade plan

