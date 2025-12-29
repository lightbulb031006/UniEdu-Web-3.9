@echo off
REM Script don gian de chay Frontend server
REM Su dung: run-frontend.bat

echo.
echo ========================================
echo    UNICORNS EDU - FRONTEND SERVER
echo ========================================
echo.

cd frontend

echo Dang khoi dong Frontend server...
echo Frontend se chay tren: http://localhost:3000
echo Nhan Ctrl+C de dung server
echo.

npm run dev

pause

