@echo off
REM Script don gian de chay Backend server
REM Su dung: run-backend.bat

echo.
echo ========================================
echo    UNICORNS EDU - BACKEND SERVER
echo ========================================
echo.

cd backend

echo Dang khoi dong Backend server...
echo Backend se chay tren: http://localhost:3001
echo Nhan Ctrl+C de dung server
echo.

npm run dev

pause

