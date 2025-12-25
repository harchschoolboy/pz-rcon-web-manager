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
git clone <REPOSITORY_URL>
cd pz-webadmin
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Configure authentication in `.env`:
```env
AUTH_USERNAME=admin
AUTH_PASSWORD=your_secure_password
JWT_SECRET=your_random_secret_string
ENCRYPTION_KEY=<generate_with_command_below>
```

Generate encryption key:
```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

4. Build and run:
```bash
docker-compose up -d --build
```

5. Open http://localhost:8000 and login with your credentials.

## Quick Start (Docker Hub)

```bash
docker run -d \
  --name pz-webadmin \
  -p 8000:8000 \
  -e AUTH_USERNAME=admin \
  -e AUTH_PASSWORD=your_secure_password \
  -e JWT_SECRET=your_random_secret \
  -e ENCRYPTION_KEY=O4mS-gGGmiCwa2a56W9c76LAhgNJqds3odEppmCMlSg= \
  -v pz_webadmin_data:/data \
  harchschoolboy/pz-rcon-server-manager:latest
```

> **Note**: The `-v pz_webadmin_data:/data` mounts a Docker volume where the SQLite database is stored. This ensures your server configurations and mod lists persist between container restarts.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AUTH_USERNAME` | Admin panel username | `admin` |
| `AUTH_PASSWORD` | Admin panel password | `admin` |
| `JWT_SECRET` | Secret key for JWT tokens | — |
| `JWT_EXPIRE_HOURS` | Token expiration time | `24` |
| `ENCRYPTION_KEY` | Key for encrypting RCON passwords | — |
| `DATABASE_URL` | SQLite database path | `sqlite+aiosqlite:////data/pz_webadmin.db` |

## Usage

1. **Add a server** — go to Connections tab, click "Add Server", enter RCON host, port, and password
2. **Connect** — click on the server and press Connect button
3. **Manage mods** — go to Mods tab, paste Steam Workshop URL to add mods
4. **Apply mods** — select mods to enable and click Apply to send configuration to server

## FYI
If you run app in docker in WSL on windows to access local server, use host.docker.internal instead of localhost

## License

MIT



