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

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Configure authentication in `.env`:

Generate encryption key:
```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

```env
AUTH_USERNAME=admin
AUTH_PASSWORD=your_secure_password
JWT_SECRET=your_random_secret_string
ENCRYPTION_KEY=from_command_above
```

4. Run:
```bash
docker-compose up -d 
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



