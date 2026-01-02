@echo off
echo ========================================
echo   Unicorns Edu - Starting Server
echo ========================================
echo.

REM Check if Python is available
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python không được tìm thấy!
    echo Vui lòng cài đặt Python hoặc sử dụng Live Server extension trong VS Code
    echo.
    pause
    exit /b 1
)

echo [INFO] Đang khởi động server...
echo.
python server.py


