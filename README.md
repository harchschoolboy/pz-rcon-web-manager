# PZ Rcon Manager

Web-based administration panel for Project Zomboid dedicated servers. Manage your servers, mods, and settings through a modern web interface using RCON protocol.

> ⚠️ **Disclaimer**: This software is provided "as is", without warranty of any kind. Use at your own risk. The author is not responsible for any damage to your servers, data loss, corrupted save files, or any other issues that may arise from using this application. Always backup your server data before making changes.

## Features

- **Multi-server support** — manage multiple PZ servers from a single panel
- **Mods management** — add mods by Steam Workshop URL, manage mod lists per server, export/import configurations
- **RCON console** — execute commands directly on the server
- **Server settings** — view and modify server options in real-time
- **Authentication** — secure access with username/password
- **Real-time status** — WebSocket-based connection status and player count

## What This App CAN Do

✅ Connect to PZ servers via RCON protocol  
✅ Send any RCON command to the server  
✅ Manage mod lists (add/remove/enable/disable mods in the app)  
✅ Sync current server mod configuration to the app  
✅ Apply mod configuration to server (`setaccesslevel`, `Mods=`, `WorkshopItems=`)  
✅ Export/import mod configurations as JSON files  
✅ Store multiple server connections  
✅ Work with mods from Steam Workshop (by URL or ID)  
✅ Restart server using save/quit sequence to RCON

## What This App CANNOT Do

❌ Download or install mods — only manages mod IDs, actual download happens on server restart  
❌ Manage mod collections — only individual mods are supported  
❌ Pull mod dependencies automatically — you need to add each mod manually  
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

Download `pz_webadmin.exe` from [Releases](https://github.com/harchschoolboy/pz-rcon-web-manager/releases), run it, and a browser window will open automatically.

## Usage

1. **Add a server** — go to Connections tab, click "Add Server", enter RCON host, port, and password
2. **Connect** — click on the server and press Connect button
3. **Manage mods** — go to Mods tab, paste Steam Workshop URL to add mods
4. **Sync mods** — click SYNC to fetch current mod configuration from server
5. **Apply mods** — select mods to enable and click Apply to send configuration to server

## Important Notes

- If running in Docker on WSL (Windows), use `host.docker.internal` instead of `localhost` to access local server
- **Mod page shows APP state**, not server state. Use SYNC button to update from server
- SYNC merges lists — all mods from server will be added in enabled state
- Port conflict? Change `"8000:8000"` to `"your_port:8000"` in docker-compose
- App parses workshop pages to find ModIds and stuff, so if workshop page is messed up, it can show you error. You can always add mod manually.

## Screenshots

<img width="2560" height="1279" alt="PZ Rcon Manager Interface" src="https://github.com/user-attachments/assets/470d4a1f-1577-43d5-b05f-b1e82061d774" />

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



