#!/usr/bin/env bash
set -e

echo ""
echo "============================================================"
echo "         PZ WebAdmin - Build Linux Binary"
echo "============================================================"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "[ERROR] Python3 not found. Install: sudo apt install python3 python3-pip python3-venv"
    exit 1
fi

# Create/activate venv to avoid system package conflicts
VENV_DIR="$SCRIPT_DIR/.venv-build"
if [ ! -d "$VENV_DIR" ]; then
    echo "[0/4] Creating virtual environment..."
    if ! python3 -m venv "$VENV_DIR"; then
        echo "[ERROR] Failed to create venv. Install python3-venv:"
        echo "        sudo apt install python3-venv"
        exit 1
    fi
fi

if [ ! -f "$VENV_DIR/bin/activate" ]; then
    echo "[ERROR] venv is broken. Delete and retry:"
    echo "        rm -rf $VENV_DIR"
    echo "        sudo apt install python3-venv"
    exit 1
fi

source "$VENV_DIR/bin/activate"

# Step 1: Build frontend (or skip if already built)
if [ -f "frontend/dist/index.html" ]; then
    echo "[1/4] Frontend already built, skipping..."
else
    if ! command -v node &> /dev/null; then
        echo "[ERROR] Node.js not found and frontend not built."
        echo "        Install Node.js 18+ or build frontend manually."
        exit 1
    fi

    echo "[1/4] Building frontend..."
    cd frontend
    npm install
    npm run build
    cd ..
fi

# Step 2: Copy frontend build to backend/static
echo "[2/4] Copying frontend to backend/static..."
rm -rf backend/static
cp -r frontend/dist backend/static

# Step 3: Install Python dependencies and PyInstaller (skip pywebview - no GUI on Linux server)
echo "[3/4] Installing Python dependencies..."
pip install --upgrade pip
grep -v 'pywebview' backend/requirements.txt | pip install -r /dev/stdin
pip install pyinstaller

# Step 4: Build Linux binary
echo "[4/4] Building Linux binary with PyInstaller..."
pyinstaller pz_webadmin_linux.spec --noconfirm

if [ $? -ne 0 ]; then
    echo "[ERROR] PyInstaller build failed"
    exit 1
fi

# Deactivate venv
deactivate

echo ""
echo "============================================================"
echo "                   Build Complete!"
echo "============================================================"
echo ""
echo "  Output: dist/pz_webadmin"
echo ""
echo "  To run:"
echo "    1. Copy pz_webadmin to desired location"
echo "    2. Create .env file next to binary (optional)"
echo "    3. chmod +x pz_webadmin && ./pz_webadmin"
echo "    4. Open http://localhost:8000 in browser"
echo ""
echo "  Data will be stored in 'data' folder next to binary"
echo ""
echo "============================================================"
