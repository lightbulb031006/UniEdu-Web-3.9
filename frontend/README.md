# UniEdu Frontend

Frontend React application cho hệ thống quản lý giáo dục UniEdu.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Environment Variables

Copy `env.example.txt` to `.env`:

```bash
# Windows PowerShell
Copy-Item env.example.txt .env
```

Chỉnh sửa `.env` và đảm bảo `VITE_API_URL` trỏ đến backend:

```env
VITE_API_URL=http://localhost:3001/api
```

### 3. Run Development Server

```bash
npm run dev
```

App sẽ chạy tại `http://localhost:5173`

## 📁 Cấu trúc Project

```
frontend/
├── src/
│   ├── components/      # Reusable components
│   ├── pages/          # Page components
│   ├── services/       # API services
│   ├── store/         # State management (Zustand)
│   ├── App.tsx        # Main app component
│   └── main.tsx       # Entry point
├── public/            # Static files
├── .env               # Environment variables
└── package.json
```

## 🛠️ Development

```bash
# Development mode
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🎨 Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **React Router** - Routing
- **Zustand** - State management
- **Axios** - HTTP client
- **Tailwind CSS** - Styling

## 📝 Notes

- Frontend giao tiếp với backend qua REST API
- Authentication sử dụng JWT tokens
- Tokens được lưu trong localStorage (có thể chuyển sang httpOnly cookies)
- Protected routes tự động redirect về login nếu chưa authenticated

