# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec file for PZ WebAdmin
Build command: pyinstaller pz_webadmin.spec
"""

import os
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
        'webview',
        'webview.platforms.winforms',
        'clr_loader',
        'pythonnet',
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
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
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
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,  # No console window - GUI mode with pywebview
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,  # Add icon path here if you have one: icon='icon.ico'
)
