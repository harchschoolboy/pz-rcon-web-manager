@echo off

echo.
echo ============================================================
echo              PZ WebAdmin - Build EXE
echo ============================================================
echo.

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Please install Python 3.11+
    exit /b 1
)

REM Check if frontend is already built
if exist "frontend\dist\index.html" (
    echo [1/4] Frontend already built, skipping...
) else (
    REM Check if Node.js is available for building frontend
    node --version >nul 2>&1
    if errorlevel 1 (
        echo [ERROR] Node.js not found and frontend not built.
        echo         Either install Node.js 18+ or build frontend manually.
        exit /b 1
    )
    
    REM Step 1: Build frontend
    echo [1/4] Building frontend...
    cd frontend
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed
        exit /b 1
    )
    call npm run build
    if errorlevel 1 (
        echo [ERROR] Frontend build failed
        exit /b 1
    )
    cd ..
)

REM Step 2: Copy frontend build to backend/static
echo [2/4] Copying frontend to backend/static...
if exist "backend\static" rmdir /s /q "backend\static"
xcopy /E /I /Y "frontend\dist" "backend\static" >nul

REM Step 3: Install Python dependencies and PyInstaller
echo [3/4] Installing Python dependencies...
python -m pip install -r backend\requirements.txt
python -m pip install pyinstaller

REM Step 4: Build EXE
echo [4/4] Building EXE with PyInstaller...
python -m PyInstaller pz_webadmin.spec --noconfirm

if errorlevel 1 (
    echo [ERROR] PyInstaller build failed
    exit /b 1
)

echo.
echo ============================================================
echo                    Build Complete!
echo ============================================================
echo.
echo   Output: dist\pz_webadmin.exe
echo.
echo   To run:
echo     1. Copy pz_webadmin.exe to desired location
echo     2. Create .env file next to exe (optional)
echo     3. Run pz_webadmin.exe
echo     4. Open http://localhost:8000 in browser
echo.
echo   Data will be stored in 'data' folder next to exe
echo.
echo ============================================================

pause
