# PZ Rcon Manager

Web-based administration panel for **Project Zomboid** dedicated servers. Manage your servers, mods, and settings through a modern web interface using RCON protocol.

![Docker Image Size](https://img.shields.io/docker/image-size/harchschoolboy/pz-rcon-server-manager/latest)
![Docker Pulls](https://img.shields.io/docker/pulls/harchschoolboy/pz-rcon-server-manager)

## Features

- 🖥️ **Multi-server management** — control multiple PZ servers from a single panel
- 🧩 **Mods management** — add mods by Steam Workshop URL, sync with server, export/import configurations
- 💻 **RCON console** — execute commands directly on the server with command history
- ⚙️ **Server settings** — view and modify server options in real-time
- 🔐 **Secure authentication** — JWT tokens + encrypted RCON password storage
- 🌐 **Multi-language** — English, Ukrainian

## Quick Start

```bash
docker run -d \
  --name pz-webadmin \
  -p 8000:8000 \
  -e AUTH_USERNAME=admin \
  -e AUTH_PASSWORD=your_secure_password \
  -v pz_webadmin_data:/data \
  harchschoolboy/pz-rcon-server-manager:latest
```

Open http://localhost:8000 and login with your credentials.

## Docker Compose

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
    volumes:
      - pz_webadmin_data:/data
    restart: unless-stopped

volumes:
  pz_webadmin_data:
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AUTH_USERNAME` | Admin panel username | `admin` |
| `AUTH_PASSWORD` | Admin panel password | `admin` |
| `JWT_SECRET` | Secret key for JWT tokens | Auto-generated |
| `JWT_EXPIRE_HOURS` | Token expiration time in hours | `24` |
| `ENCRYPTION_KEY` | Key for encrypting RCON passwords | Auto-generated |

> **Note:** `JWT_SECRET` and `ENCRYPTION_KEY` are auto-generated on first run and saved to `/data/.jwt_secret` and `/data/.encryption_key`. You only need to set them manually if migrating data between instances.

## Data Persistence

Mount a volume to `/data` to persist:
- `pz_webadmin.db` — SQLite database with servers and mods
- `.encryption_key` — Fernet key for RCON password encryption
- `.jwt_secret` — JWT signing secret
- `exports/` — exported mod configurations

## Usage

1. **Add a server** — go to Connections tab, enter RCON host, port, and password
2. **Connect** — click on the server card and press Connect
3. **Manage mods** — paste Steam Workshop URLs to add mods
4. **Sync mods** — fetch current mods configuration from server
5. **Apply mods** — send updated `Mods=` and `WorkshopItems=` to server

## Architecture

| Component | Technology |
|-----------|------------|
| Backend | Python 3.11, FastAPI, SQLAlchemy |
| Frontend | React 18, TypeScript, Tailwind CSS |
| Database | SQLite |
| Image size | ~150MB (Alpine-based) |

## Security Notes

⚠️ **Change default credentials** before exposing to the network!

For production deployments:
- Use a reverse proxy with HTTPS (nginx, traefik, caddy)
- Set strong `AUTH_PASSWORD`
- Consider network isolation (VPN, firewall rules)

## Tags

- `latest` — latest stable release
- `1.0.0` — version 1.0.0

## Links

- **GitHub:** [harchschoolboy/pz-rcon-web-manager](https://github.com/harchschoolboy/pz-rcon-web-manager)
- **Issues:** [Report a bug](https://github.com/harchschoolboy/pz-rcon-web-manager/issues)

## License

GPL-3.0
