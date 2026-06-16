# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec file for PZ WebAdmin (Linux)
Build command: pyinstaller pz_webadmin_linux.spec
"""

import os
import sys
from pathlib import Path

block_cipher = None

# Get absolute paths
BASE_DIR = Path(SPECPATH)
BACKEND_DIR = BASE_DIR / 'backend'
STATIC_DIR = BACKEND_DIR / 'static'

# Collect all necessary data files
datas = []

# Add static files (React build)
if STATIC_DIR.exists():
    datas.append((str(STATIC_DIR), 'static'))

# Add .env.example as template
if (BASE_DIR / '.env.example').exists():
    datas.append((str(BASE_DIR / '.env.example'), '.'))

a = Analysis(
    ['build_exe.py'],
    pathex=[str(BACKEND_DIR)],
    binaries=[],
    datas=datas,
    hiddenimports=[
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        'uvicorn.lifespan.off',
        'aiosqlite',
        'sqlalchemy.ext.asyncio',
        'pydantic_settings',
        'cryptography',
        'httpx',
        'bcrypt',
        'dotenv',
        'app',
        'app.main',
        'app.config',
        'app.database',
        'app.models',
        'app.schemas',
        'app.auth',
        'app.crypto',
        'app.rcon_client',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # Exclude Windows-only modules
        'webview.platforms.winforms',
        'clr_loader',
        'pythonnet',
    ],
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='pz_webadmin',
    debug=False,
    bootloader_ignore_signals=False,
    strip=True,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,  # Linux server - console mode
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
