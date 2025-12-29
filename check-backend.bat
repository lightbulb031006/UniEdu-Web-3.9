@echo off
REM Script kiem tra Backend server co dang chay khong
REM Su dung: check-backend.bat

echo.
echo ========================================
echo    KIEM TRA BACKEND SERVER
echo ========================================
echo.

REM Kiem tra port 3001
netstat -ano | findstr ":3001" >nul 2>&1

if %ERRORLEVEL% EQU 0 (
    echo OK: BACKEND DANG CHAY!
    echo    Port 3001: Dang duoc su dung
    echo.
    echo Dang kiem tra ket noi...
    curl -s http://localhost:3001/api/health >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo    OK: Backend phan hoi thanh cong
        echo    OK: Backend URL: http://localhost:3001
    ) else (
        echo    WARNING: Backend chua san sang (co the dang khoi dong)
    )
) else (
    echo ERROR: BACKEND CHUA CHAY!
    echo    Port 3001: Khong co process nao
    echo.
    echo De chay backend:
    echo    1. Double-click: run-backend.bat
    echo    2. Hoac chay: start-backend.ps1
    echo    3. Hoac chay thu cong: cd backend ^&^& npm run dev
)

echo.
pause

