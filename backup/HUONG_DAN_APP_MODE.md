# Hướng dẫn chuyển đổi APP_MODE (Dev ↔ Prod)

## Cách 1: Sử dụng URL Parameter (Khuyến nghị - Nhanh nhất)

### Chuyển sang DEV mode:
```
http://localhost:3000?appMode=dev
```

### Chuyển sang PROD mode:
```
http://localhost:3000?appMode=prod
```

**Lưu ý:** 
- Giá trị sẽ được lưu vào `localStorage` và tự động áp dụng cho các lần truy cập sau
- Chỉ cần set 1 lần, sau đó F5 sẽ giữ nguyên mode

---

## Cách 2: Xóa override và về mặc định

### Về mặc định (localhost = dev):
```
http://localhost:3000?appMode=clearmode
```

Sau khi chạy lệnh này, app sẽ về mặc định:
- **localhost/127.0.0.1** → `dev`
- **Các domain khác** → `prod`

---

## Cách 3: Sử dụng Browser Console (Nâng cao)

Mở Developer Tools (F12) và chạy:

### Chuyển sang DEV:
```javascript
localStorage.setItem('unicorns.forceAppMode', 'dev');
location.reload();
```

### Chuyển sang PROD:
```javascript
localStorage.setItem('unicorns.forceAppMode', 'prod');
location.reload();
```

### Xóa override:
```javascript
localStorage.removeItem('unicorns.forceAppMode');
location.reload();
```

---

## Kiểm tra APP_MODE hiện tại

Mở Developer Tools (F12) và chạy:
```javascript
console.log('APP_MODE:', window.APP_MODE);
console.log('ALLOW_SENSITIVE_LOCAL_CACHE:', window.ALLOW_SENSITIVE_LOCAL_CACHE);
```

**Kết quả:**
- **DEV mode**: `ALLOW_SENSITIVE_LOCAL_CACHE = true` (cho phép cache dữ liệu nhạy cảm)
- **PROD mode**: `ALLOW_SENSITIVE_LOCAL_CACHE = false` (chặn cache dữ liệu nhạy cảm)

---

## Sự khác biệt giữa DEV và PROD

### DEV Mode:
- ✅ Cho phép lưu dữ liệu nhạy cảm vào localStorage
- ✅ Console hiển thị warning: `[AppMode] DEV mode active`
- ✅ Dễ debug và phát triển

### PROD Mode:
- ❌ Chặn lưu dữ liệu nhạy cảm vào localStorage
- ✅ Console hiển thị: `[AppMode] PROD mode active`
- ✅ Bảo mật tốt hơn cho production

---

## Ví dụ sử dụng

### Scenario 1: Test production behavior trên localhost
```
1. Mở: http://localhost:3000?appMode=prod
2. Test các tính năng bảo mật
3. Kiểm tra xem có dữ liệu nhạy cảm nào bị chặn không
```

### Scenario 2: Development với full access
```
1. Mở: http://localhost:3000?appMode=dev
2. Hoặc không cần set (mặc định localhost = dev)
3. Phát triển và debug thoải mái
```

### Scenario 3: Reset về mặc định
```
1. Mở: http://localhost:3000?appMode=clearmode
2. App sẽ về mặc định (localhost = dev)
```

---

## Troubleshooting

### APP_MODE không đổi sau khi set?
- **Giải pháp**: Xóa cache và reload:
  ```javascript
  localStorage.removeItem('unicorns.forceAppMode');
  location.reload();
  ```

### Muốn xóa tất cả localStorage?
- **Cẩn thận**: Sẽ xóa tất cả dữ liệu local
  ```javascript
  localStorage.clear();
  location.reload();
  ```

---

## Quick Reference

| Thao tác | URL |
|----------|-----|
| **DEV mode** | `?appMode=dev` |
| **PROD mode** | `?appMode=prod` |
| **Reset về mặc định** | `?appMode=clearmode` |
| **Kiểm tra mode** | F12 → `window.APP_MODE` |

