# Hướng dẫn chạy web Unicorns Edu thủ công

## Cách 1: Chạy bằng Python HTTP Server (Khuyến nghị)

### Yêu cầu:
- Python 3 đã được cài đặt trên máy

### Các bước:

1. **Mở Terminal/PowerShell/Command Prompt** và di chuyển đến thư mục dự án:
   ```bash
   cd E:\App\UniEdu3.0
   ```

2. **Chạy server Python:**
   ```bash
   python -m http.server 3000
   ```
   hoặc
   ```bash
   python server.py
   ```

3. **Mở trình duyệt** và truy cập:
   ```
   http://localhost:3000
   ```

4. **Dừng server:** Nhấn `Ctrl+C` trong terminal

---

## Cách 2: Chạy bằng Node.js (nếu có)

1. **Cài đặt http-server** (chỉ cần cài 1 lần):
   ```bash
   npm install -g http-server
   ```

2. **Chạy server:**
   ```bash
   cd E:\App\UniEdu3.0
   http-server -p 3000
   ```

3. **Mở trình duyệt:** `http://localhost:3000`

---

## Cách 3: Mở trực tiếp file HTML (Không khuyến nghị)

**Lưu ý:** Một số tính năng có thể không hoạt động do CORS và localStorage restrictions.

1. Tìm file `index.html` trong thư mục dự án
2. Double-click để mở bằng trình duyệt

---

## Cách 4: Sử dụng Live Server (VS Code Extension)

1. Cài đặt extension "Live Server" trong VS Code
2. Click chuột phải vào file `index.html`
3. Chọn "Open with Live Server"

---

## Troubleshooting

### Lỗi "Port already in use"
- Đổi cổng khác: `python -m http.server 8000`
- Hoặc tìm và đóng process đang dùng cổng 3000

### Lỗi "Python not found"
- Kiểm tra Python đã được cài đặt: `python --version`
- Hoặc thử: `python3 -m http.server 3000`

### Trang web không hiển thị đúng
- Mở Developer Tools (F12) để kiểm tra lỗi
- Đảm bảo đang truy cập qua `http://localhost:3000` (không phải `file://`)

---

## Thông tin thêm

- **Cổng mặc định:** 3000
- **Dữ liệu:** Lưu trong localStorage của trình duyệt
- **Hỗ trợ:** Light/Dark mode toggle ở sidebar

