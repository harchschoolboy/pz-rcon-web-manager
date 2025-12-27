# PZ Rcon Manager — Technical Details

## Tech Stack

| Component | Technology |
|-----------|------------|
| Backend | Python 3.11, FastAPI, SQLAlchemy |
| Frontend | React 18, TypeScript, Tailwind CSS, Zustand |
| Database | SQLite (async via aiosqlite) |
| Auth | JWT tokens + Fernet encryption for RCON passwords |
| Deployment | Docker (Alpine-based, ~150MB) |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Container                      │
│  ┌─────────────────┐     ┌─────────────────────────┐    │
│  │  React Frontend │────▶│   FastAPI Backend       │    │
│  │  (Static files) │     │   - REST API            │    │
│  └─────────────────┘     │   - WebSocket           │    │
│                          │   - RCON Client         │    │
│                          └──────────┬──────────────┘    │
│                                     │                    │
│                          ┌──────────▼──────────────┐    │
│                          │   SQLite Database       │    │
│                          │   /data/pz_webadmin.db  │    │
│                          └─────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼ RCON Protocol
                    ┌─────────────────────┐
                    │  PZ Server (RCON)   │
                    └─────────────────────┘
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AUTH_USERNAME` | Admin panel username | `admin` |
| `AUTH_PASSWORD` | Admin panel password | `admin` |
| `JWT_SECRET` | Secret key for JWT tokens | Auto-generated |
| `JWT_EXPIRE_HOURS` | Token expiration time | `24` |
| `ENCRYPTION_KEY` | Key for encrypting RCON passwords | Auto-generated |
| `DATABASE_URL` | SQLite database path | `sqlite+aiosqlite:////data/pz_webadmin.db` |

> **Security Note**: Auto-generated keys are saved to `/data/.encryption_key` and `/data/.jwt_secret`. If you delete these files, new keys will be generated, but existing encrypted passwords will become unreadable and active sessions will be invalidated.

## Data Persistence

Mount a volume to `/data` to persist:
- `pz_webadmin.db` — SQLite database with servers and mods
- `.encryption_key` — Fernet key for RCON password encryption
- `.jwt_secret` — JWT signing secret
- `exports/` — exported mod configurations

## Build Standalone EXE (Windows)

You can build a standalone Windows executable that doesn't require Docker or Python.

### Prerequisites
- Python 3.11+
- Node.js 18+

### Build
```bash
# Run the build script
build.bat
```

This will:
1. Build the React frontend
2. Bundle it with the Python backend using PyInstaller
3. Create `dist/pz_webadmin.exe` (~50-100MB)

### Run
1. Copy `pz_webadmin.exe` to desired location
2. (Optional) Create `.env` file next to exe with custom settings
3. Run `pz_webadmin.exe`
4. A browser window will open automatically (pywebview)

Data and auto-generated keys will be stored in `data/` folder next to the executable.

## API Endpoints

### Authentication
- `POST /api/token` — login, returns JWT token

### Servers
- `GET /api/servers` — list all servers
- `POST /api/servers` — add new server
- `DELETE /api/servers/{id}` — remove server
- `POST /api/servers/{id}/connect` — connect to RCON
- `POST /api/servers/{id}/disconnect` — disconnect
- `POST /api/servers/{id}/command` — execute RCON command

### Mods
- `GET /api/servers/{id}/mods` — list mods for server
- `POST /api/servers/{id}/mods` — add mod (by Workshop URL)
- `DELETE /api/servers/{id}/mods/{mod_id}` — remove mod
- `POST /api/servers/{id}/mods/sync` — sync mods from server
- `POST /api/servers/{id}/mods/apply` — apply mod config to server
- `GET /api/servers/{id}/mods/export` — export mod config
- `POST /api/servers/{id}/mods/import` — import mod config

### WebSocket
- `WS /api/ws/{server_id}` — real-time server status updates

## Docker Compose (Full)

```yaml
version: '3.8'
services:
  pz-webadmin:
    image: harchschoolboy/pz-rcon-server-manager:latest
    container_name: pz-webadmin
    ports:
      - "8000:8000"
    environment:
      - AUTH_USERNAME=admin
      - AUTH_PASSWORD=your_secure_password
      # Optional: set custom keys
      # - JWT_SECRET=your_jwt_secret
      # - ENCRYPTION_KEY=your_fernet_key
    volumes:
      - pz_webadmin_data:/data
    restart: unless-stopped

volumes:
  pz_webadmin_data:
```

## Development

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Security Considerations

- RCON passwords are encrypted with Fernet (AES-128-CBC)
- JWT tokens expire after configurable hours (default: 24)
- All API endpoints (except login) require authentication
- Passwords are never logged or exposed in API responses
