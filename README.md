# PZ WebAdmin

Web-based administration panel for Project Zomboid dedicated servers. Manage your servers, mods, and settings through a modern web interface using RCON protocol.

## Features

- **Multi-server support** — manage multiple PZ servers from a single panel
- **Mods management** — add mods by Steam Workshop URL, manage mod lists per server, export/import configurations
- **RCON console** — execute commands directly on the server
- **Server settings** — view and modify server options in real-time
- **Authentication** — secure access with username/password
- **Real-time status** — WebSocket-based connection status and player count

## Tech Stack

- **Backend**: Python, FastAPI, SQLAlchemy, SQLite
- **Frontend**: React, TypeScript, Tailwind CSS, Zustand
- **Deployment**: Single Docker image (~150MB)

## Quick Start (Local Build)

1. Clone the repository:
```bash
git clone https://github.com/harchschoolboy/pz-rcon-web-manager.git
cd pz-rcon-web-manager
```

2. (Optional) Create `.env` file to customize settings:
```bash
cp .env.example .env
```

```env
AUTH_USERNAME=admin
AUTH_PASSWORD=your_secure_password
# JWT_SECRET and ENCRYPTION_KEY are auto-generated if not provided
```

3. Run:
```bash
docker-compose up -d 
```

4. Open http://localhost:8000 and login with your credentials.

> **Note**: `ENCRYPTION_KEY` and `JWT_SECRET` are automatically generated on first run and saved to `/data/.encryption_key` and `/data/.jwt_secret`. You only need to set them manually if you want to use specific values or migrate data between instances.

## Quick Start (Docker Hub)

```bash
docker run -d \
  --name pz-webadmin \
  -p 8000:8000 \
  -e AUTH_USERNAME=admin \
  -e AUTH_PASSWORD=your_secure_password \
  -v pz_webadmin_data:/data \
  harchschoolboy/pz-rcon-server-manager:latest
```

> **Note**: Keys are auto-generated and stored in the `/data` volume.

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

## Usage

1. **Add a server** — go to Connections tab, click "Add Server", enter RCON host, port, and password
2. **Connect** — click on the server and press Connect button
3. **Manage mods** — go to Mods tab, paste Steam Workshop URL to add mods
4. **Apply mods** — select mods to enable and click Apply to send configuration to server

## Build Standalone EXE (Windows)

You can build a standalone Windows executable that doesn't require Docker or Python:

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
2. Bundle it with the Python backend
3. Create `dist/pz_webadmin.exe` (~50-100MB)

### Run
1. Copy `pz_webadmin.exe` to desired location
2. (Optional) Create `.env` file next to exe with custom settings
3. Run `pz_webadmin.exe`
4. A browser window will open automatically

Data and auto-generated keys will be stored in `data/` folder next to the executable.

## FYI
If you run app in docker in WSL on windows to access local server, use host.docker.internal instead of localhost

Mod page shows APP state of Mods, not Server State. To update APP state of mods from server, use SYNC button.

Sync button will merge lists, and all mods currently present on server will be in enabled state.

Currently if workshop id have multiple mods, but server have enabled only one mod, you will see only one ModID on Mod Page, if you want have multiple ids, remove it from app, and add as new, in this case, it will be added to APP with all modIds.

If your 8000 is busy, change 
    ports:
      - "8000:8000"
to
    ports:
      - "your_port:8000"

<img width="2560" height="1279" alt="image" src="https://github.com/user-attachments/assets/470d4a1f-1577-43d5-b05f-b1e82061d774" />


## License

GPL



