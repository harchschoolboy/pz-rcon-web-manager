# PZ Rcon Manager

Web-based administration panel for Project Zomboid dedicated servers. Manage your servers, mods, and settings through a modern web interface using RCON protocol.

> ⚠️ **Disclaimer**: This software is provided "as is", without warranty of any kind. Use at your own risk. The author is not responsible for any damage to your servers, data loss, corrupted save files, or any other issues that may arise from using this application. Always backup your server data before making changes.

## Features

- **Multi-server support** — manage multiple PZ servers from a single panel
- **Steam Workshop integration** — add mods by URL, import entire collections
- **Auto-dependencies** — automatically detects and adds required mod dependencies
- **Mods management** — manage mod lists per server, export/import configurations
- **RCON console** — execute commands directly on the server
- **Server settings** — view and modify server options in real-time
- **Authentication** — secure access with username/password
- **Real-time status** — WebSocket-based connection status and player count

## What This App CAN Do

✅ Connect to PZ servers via RCON protocol  
✅ Send any RCON command to the server  
✅ Manage mod lists (add/remove/enable/disable mods)  
✅ **Import entire Steam Workshop collections** with one URL  
✅ **Auto-detect and add mod dependencies**  
✅ Sync current server mod configuration to the app  
✅ Apply mod configuration to server (`Mods=`, `WorkshopItems=`)  
✅ Export/import mod configurations as JSON files  
✅ Store multiple server connections  
✅ Restart server using save/quit RCON sequence

## What This App CANNOT Do

❌ Download or install mods — only manages mod IDs, actual download happens on server restart  
❌ Edit server files directly — only RCON commands are used  
❌ Upload maps or custom content — only workshop items  
❌ Work without RCON enabled on the server  

## Quick Start

### Docker (Recommended)

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

### Docker Compose

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

### Windows EXE

Download `pz_webadmin.exe` from [Releases](https://github.com/harchschoolboy/pz-rcon-web-manager/releases), run it.

Login/password for exe version is admin / admin. It can be changed by creating .env file in directory with exe file, and configured.

## Usage

1. **Add a server** — go to Connections tab, click "Add Server", enter RCON host, port, and password
2. **Connect** — click on the server and press Connect button
3. **Manage mods** — go to Mods tab:
   - Paste **Steam Workshop URL** to add a single mod (dependencies auto-detected)
   - Click **Collection** button to import an entire Steam collection
   - Use **Import from line** to paste `WorkshopItems=...` string
4. **Sync mods** — click SYNC to fetch current mod configuration from server
5. **Apply mods** — select mods to enable and click Apply to send configuration to server

## Important Notes

- If running in Docker on WSL (Windows), use `host.docker.internal` instead of `localhost` to access local server
- **Mod page shows APP state**, not server state. Use SYNC button to update from server
- SYNC merges lists — all mods from server will be added in enabled state
- Port conflict? Change `"8000:8000"` to `"your_port:8000"` in docker-compose
- Uses Steam API for mod parsing — faster and more reliable than page scraping

## Screenshots

<img width="1436" height="893" alt="pz_webadmin_2025-12-29_13-04-39" src="https://github.com/user-attachments/assets/1955bbd7-660b-4fa4-8ea1-4a4976e00eb2" />
<img width="480" height="920" alt="pz_webadmin_2025-12-28_15-58-57" src="https://github.com/user-attachments/assets/bf86f1bd-36fa-4b05-802d-f0eb78e663a5" />
<img width="494" height="620" alt="pz_webadmin_2025-12-28_15-57-46" src="https://github.com/user-attachments/assets/ebafbe3d-931f-4a92-b4d6-78469c2679a0" />

## Technical Details

See [TECHNICAL.md](TECHNICAL.md) for:
- Architecture and tech stack
- Environment variables
- API endpoints
- Build instructions
- Development setup

## Links

- **Docker Hub**: [harchschoolboy/pz-rcon-server-manager](https://hub.docker.com/r/harchschoolboy/pz-rcon-server-manager)
- **GitHub**: [harchschoolboy/pz-rcon-web-manager](https://github.com/harchschoolboy/pz-rcon-web-manager)
- **Issues**: [Report a bug](https://github.com/harchschoolboy/pz-rcon-web-manager/issues)

## License

GPL-3.0



