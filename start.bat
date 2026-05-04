@echo off
echo Starting PROJECT MILLION Ecosystem...

echo.
echo [1/3] Syncing database structure...
cd backend
call npx prisma generate
cd ..

echo.
echo [2/3] Launching Backend Server...
start cmd /k "cd backend && npm run dev"

timeout /t 2 >nul

echo.
echo [3/3] Launching Kiosk Frontend...
start cmd /k "cd frontend && npm run dev"

echo.
echo ========================================
echo   All services are starting up!
echo ========================================
echo  - Kiosk: http://localhost:5173/
echo  - Admin: http://localhost:5173/admin
echo  - Cashier: http://localhost:5173/cashier
echo  - Kitchen: http://localhost:5173/kitchen
echo  - Queue: http://localhost:5173/queue
echo ========================================
echo.
pause
