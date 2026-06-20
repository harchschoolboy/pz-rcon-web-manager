# PZ Rcon Manager

Web-based administration panel for Project Zomboid dedicated servers. Manage your servers, mods, and settings through a modern web interface using RCON protocol.

> ⚠️ **Disclaimer**: This software is provided "as is", without warranty of any kind. Use at your own risk. The author is not responsible for any damage to your servers, data loss, corrupted save files, or any other issues that may arise from using this application. Always backup your server data before making changes.

## Features

- **Multi-server support** — manage multiple PZ servers from a single panel
- **Steam Workshop integration** — add mods by URL, import entire collections
- **Auto-dependencies** — automatically detects and adds required mod dependencies
- **Auto-sync mods** — optionally sync mods from server on connect
- **Mods management** — manage mod lists per server, export/import configurations
- **RCON console** — execute commands directly on the server
- **Server settings** — view and modify server options in real-time
- **Authentication** — secure access with username/password
- **Real-time status** — WebSocket-based connection status and player count

## What's New in v1.6.3

- **Large RCON response fix** — responses are now reassembled using proper length-framed packet reading, so big outputs (like the `WorkshopItems=` line from `showoptions`) are no longer split across lines or missing characters. This fixes mods being only partially received from the server

## What's New in v1.6.2

- **Missing dependency warnings** — mods whose known dependency is not staged on the server get a red outline, and Apply shows a confirmation listing the missing dependencies
- **Apply preview** — a collapsible panel shows the exact `Mods=` and `WorkshopItems=` lines that will be pushed to the server
- **Single-mod item fix** — a workshop item with a single mod is no longer added without its actual mod (no more orphaned `WorkshopItems` entries)
- **Connection heartbeat** — a periodic live check detects a restarted or stopped server automatically and flips the card to disconnected
- **Reconnect fix** — the Reconnect button now reconnects cleanly without spurious "not connected" error notifications

## What's New in v1.6.0

- **Two dependency update modes** — update dependencies for **all** mods, or only for **unchecked** mods that were never resolved
- **Per-mod dependency check** — each mod card has a check button with live status (pending / success / error) and one-click retry on failure
- **Realtime updates** — the mod list updates in place while dependencies are being resolved
- **Export/import includes dependencies** — dependency data is now preserved when exporting and importing mod lists
- **Steam rate-limit protection** — request throttling, browser-like headers, and an in-memory cache to reduce `429 Too Many Requests` errors
- **Timestamped backend logs** — clearer, time-stamped server logs




## What This App CAN Do

✅ Connect to PZ servers via RCON protocol  
✅ Send any RCON command to the server  
✅ Manage mod lists (add/remove/enable/disable mods)  
✅ **Import entire Steam Workshop collections** with one URL  
✅ **Auto-detect and add mod dependencies**  
✅ **Auto-sync mods on connect** (optional per-server setting)
✅ **Display server version** on server card
✅ Sync current server mod configuration to the app  
✅ Apply mod configuration to server (`Mods=`, `WorkshopItems=`)  
✅ Export/import mod configurations as JSON files (including dependencies)  
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

## Mod Dependencies & Steam Rate Limits

Mods often require other mods to work. The app resolves these dependencies from the Steam Workshop:

- **Where dependencies come from** — the Steam API does not expose the "Required Items" of Project Zomboid mods, so the app reads the public Workshop page and parses the **Required Items** block to find dependency workshop IDs.
- **Updating dependencies** — use the dependency buttons on the Mods page:
  - **Update all** — re-resolves dependencies for every mod in the list
  - **Update unknown** — only resolves mods that were never checked before (faster, fewer Steam requests)
- **Per-mod retry** — if a single mod fails, use its retry button instead of re-running the whole list.

### Potential `429 Too Many Requests` error

Steam limits how often you can request Workshop pages. If you resolve many mods quickly you may hit a `429 Too Many Requests` response. The app reduces this with:

- **Request throttling** — Workshop requests are spaced out (about one per second)
- **Browser-like headers** — requests look like a normal browser to avoid aggressive blocking
- **In-memory cache** — already-resolved pages are not fetched again during a session
- **Automatic retry with backoff** — failed mods are retried a few times before being marked as failed

If you still see `429` errors, wait a minute and use **Update unknown** or the per-mod retry button instead of refreshing everything at once.

## Links

- **Docker Hub**: [harchschoolboy/pz-rcon-server-manager](https://hub.docker.com/r/harchschoolboy/pz-rcon-server-manager)
- **GitHub**: [harchschoolboy/pz-rcon-web-manager](https://github.com/harchschoolboy/pz-rcon-web-manager)
- **Issues**: [Report a bug](https://github.com/harchschoolboy/pz-rcon-web-manager/issues)

## License

GPL-3.0



