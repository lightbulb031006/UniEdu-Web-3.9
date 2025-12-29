@echo off
REM Script khoi dong Backend va Frontend cung luc
REM Su dung: start-server.bat

echo.
echo ========================================
echo    UNICORNS EDU - START SERVER
echo ========================================
echo.

REM Kiem tra Node.js
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js chua duoc cai dat!
    echo Vui long cai dat Node.js tu: https://nodejs.org/
    pause
    exit /b 1
)

REM Kiem tra npm
where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: npm chua duoc cai dat!
    pause
    exit /b 1
)

REM Kiem tra thu muc backend va frontend
if not exist "backend" (
    echo ERROR: Khong tim thay thu muc backend!
    pause
    exit /b 1
)

if not exist "frontend" (
    echo ERROR: Khong tim thay thu muc frontend!
    pause
    exit /b 1
)

REM Kiem tra node_modules
echo Dang kiem tra dependencies...
echo.

if not exist "backend\node_modules" (
    echo WARNING: Backend chua co node_modules. Dang cai dat...
    cd backend
    call npm install
    cd ..
    echo OK: Backend dependencies da duoc cai dat
    echo.
)

if not exist "frontend\node_modules" (
    echo WARNING: Frontend chua co node_modules. Dang cai dat...
    cd frontend
    call npm install
    cd ..
    echo OK: Frontend dependencies da duoc cai dat
    echo.
)

REM Kiem tra .env files
echo Dang kiem tra cau hinh...
echo.

if not exist "backend\.env" (
    echo WARNING: Backend chua co file .env
    echo   Vui long tao file backend\.env voi cac bien moi truong can thiet
    echo.
)

if not exist "frontend\.env" (
    echo WARNING: Frontend chua co file .env
    echo   Vui long tao file frontend\.env voi cac bien moi truong can thiet
    echo.
)

echo ========================================
echo    DANG KHOI DONG SERVERS...
echo ========================================
echo.

REM Khoi dong Backend trong cua so moi
echo Khoi dong Backend (port 3001)...
start "Backend Server" cmd /k "cd backend && npm run dev"

REM Doi mot chut de backend khoi dong
timeout /t 3 /nobreak >nul

REM Khoi dong Frontend trong cua so moi
echo Khoi dong Frontend (port 3000)...
start "Frontend Server" cmd /k "cd frontend && npm run dev"

REM Doi mot chut de frontend khoi dong
timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo    SERVERS DA KHOI DONG!
echo ========================================
echo.
echo OK Backend:  http://localhost:3001
echo OK Frontend: http://localhost:3000
echo.
echo Nhan phim bat ky de dong cua so nay...
echo (Cac server van tiep tuc chay trong cua so khac)
echo.
pause
