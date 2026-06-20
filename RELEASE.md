# Release Notes - PZ WebAdmin

## v1.6.3

### Highlights

- **Large RCON response fix** — the RCON client now reads responses as proper length-framed packets instead of assuming each TCP read is one complete packet. Large responses (for example the `WorkshopItems=` line returned by `showoptions`) were previously split across lines and lost ~12 bytes at each read boundary, causing only part of the mods to be received. Bodies are now reassembled in order with no separator, reproducing the server's output exactly.

### Notes

- Backend-only change. No database migration or configuration change is required.

---

## v1.6.2

### Highlights

- **Missing dependency detection** — a server mod whose known dependency is not present in the server panel now gets a **red outline** and a red dependency icon with a tooltip listing the missing items. Detection also covers the case where a dependency is moved out of the server panel.
- **Apply warning for missing dependencies** — pressing **Apply** shows a confirmation listing every mod with missing dependencies before sending the configuration.
- **Apply lines preview** — a collapsible panel shows the exact `Mods=...` and `WorkshopItems=...` lines (with counts) that will be pushed to the server on Apply.
- **Single-mod workshop item fix** — a workshop item containing exactly one mod is now always treated as enabled when present, so it can no longer be added as a `WorkshopItems` entry without its matching `Mods` entry. This fix applies across list, apply, export, download and import, and auto-corrects already-broken records on read.
- **Connection heartbeat** — a periodic live RCON round-trip detects a restarted or stopped server automatically and flips the card to disconnected, instead of looking connected until the next action fails.
- **Reconnect button fix** — Reconnect now reconnects cleanly (the backend drops any stale connection first) and no longer shows a "not connected" error notification on failure.

### Notes

- Existing broken single-mod records are corrected automatically on read; no manual migration is required.

---

## v1.6.0

### Highlights

- **Two dependency update modes** on the Mods page:
  - **Update all** — re-resolves dependencies for every mod in the list
  - **Update unknown** — only resolves mods that were never checked before (fewer Steam requests)
- **Per-mod dependency check** — each mod card has its own check button with live status (pending / success / error) and one-click retry on failure
- **Realtime updates** — the mod list updates in place while dependencies are being resolved, instead of refreshing at the end
- **Export/import now includes dependencies** — dependency data is preserved across export and import of mod lists
- **Steam rate-limit protection** to reduce `429 Too Many Requests` errors:
  - Request throttling (Workshop requests spaced ~1s apart, serialized)
  - Browser-like request headers
  - In-memory cache of already-resolved Workshop pages
  - Automatic retry with backoff before marking a mod as failed
- **429 treated as a real error** — rate-limit responses are surfaced instead of silently returning empty dependencies
- **Timestamped backend logs** — server logs now include timestamps and consistent formatting

### Notes

- Mod dependencies are read from the public Steam Workshop page (Required Items block), since the Steam API does not expose them for Project Zomboid mods.
- If you hit `429` errors, wait a minute and use **Update unknown** or per-mod retry instead of refreshing everything at once.

---

## v1.5.0

**Release Date:** June 16, 2026

### Highlights

- Mods page redesigned into 2 panels: **Known Mods** and **Server Mods**
- Server cards now support 3 explicit connection states: `disconnected`, `connecting`, `connected`
- Updated server card action colors for faster recognition:
  - Connect: blue
  - Connecting: yellow
  - Connected: green
  - Restart Server: red
- Added Reconnect action on connected server cards to recreate RCON connection quickly
- Added tooltips on all server card buttons for better UX
- Added import warning before loading mod lists into the server mods panel

### Notes

- Includes UI and UX improvements focused on connection management clarity and safer mod import flow.

---

## v1.0.0

**Release Date:** December 26, 2025

## 🎉 Initial Release

PZ WebAdmin is a web-based administration panel for Project Zomboid dedicated servers. This is the first stable release with full feature set.

---

## ✨ Features

### Server Management
- **Multi-server support** — manage multiple PZ servers from a single panel
- **RCON connection** — secure connection to servers via RCON protocol
- **Real-time status** — WebSocket-based connection status and player count updates
- **Server settings** — view and modify server options (`showoptions`/`changeoption`)

### Mods Management
- **Add mods by URL** — paste Steam Workshop URL to automatically parse mod info
- **Add mods manually** — enter Workshop ID and Mod IDs directly
- **Bulk import** — import multiple mods from `WorkshopItems=` line
- **Sync from server** — synchronize mod list with server's current configuration
- **Enable/disable mods** — toggle individual mods or mod IDs within workshop items
- **Export/Import** — backup and restore mod configurations as JSON files
- **Apply to server** — generate and apply `Mods=` and `WorkshopItems=` lines

### RCON Console
- **Command execution** — execute any RCON command on connected server
- **Command history** — view previous commands and responses
- **Quick commands** — predefined buttons for common commands

### Security
- **Authentication** — username/password login with JWT tokens
- **Encrypted credentials** — RCON passwords stored encrypted (Fernet)
- **Auto-generated keys** — encryption and JWT keys auto-generated on first run

### Localization
- **Multi-language support** — English, Ukrainian
- **Browser language detection** — automatically selects language based on browser settings

---

## 🚀 Deployment Options

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

### Standalone Windows EXE
- Download `pz_webadmin.exe` from releases
- Run the executable — browser window opens automatically
- Data stored in `data/` folder next to exe
- No Docker or Python required

---

## 📦 Tech Stack

| Component | Technology |
|-----------|------------|
| Backend | Python 3.11, FastAPI, SQLAlchemy, SQLite |
| Frontend | React 18, TypeScript, Vite 5, Tailwind CSS |
| State | Zustand |
| Desktop | PyInstaller + pywebview (WebView2) |
| Container | Alpine Linux, ~150MB image |

---

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AUTH_USERNAME` | Admin panel username | `admin` |
| `AUTH_PASSWORD` | Admin panel password | `admin` |
| `JWT_SECRET` | Secret key for JWT tokens | Auto-generated |
| `JWT_EXPIRE_HOURS` | Token expiration time | `24` |
| `ENCRYPTION_KEY` | Key for encrypting RCON passwords | Auto-generated |

### Data Storage

**Docker:** `/data/` volume
- `pz_webadmin.db` — SQLite database
- `.encryption_key` — Fernet key for password encryption
- `.jwt_secret` — JWT signing secret

**Windows EXE:** `data/` folder next to executable
- Same files as Docker
- `exports/` — exported mod configurations

---

## 🔒 Security Notes

- Change default credentials before exposing to network
- Auto-generated keys are persisted — deleting them will:
  - Invalidate all active sessions
  - Make encrypted passwords unreadable (re-add servers required)
- Use HTTPS reverse proxy for production deployments

---

## 🐛 Known Limitations

- RCON protocol doesn't support real-time log streaming
- Workshop page parsing may fail for private/restricted items
- Player list updates every 10 seconds (RCON polling)

---

## 📝 Changelog

### v1.0.0 (2025-12-26)
- Initial stable release
- Multi-server management
- Mods management with Steam Workshop integration
- RCON console with command history
- Server settings viewer/editor
- JWT authentication with auto-generated keys
- Export/Import mod configurations
- Sync mods from server
- "Disable missing" option for sync
- Multi-language support (EN, UK)
- Docker deployment
- Standalone Windows EXE with embedded browser

---

## 🔗 Links

- **GitHub:** https://github.com/harchschoolboy/pz-rcon-web-manager
- **Docker Hub:** https://hub.docker.com/r/harchschoolboy/pz-rcon-server-manager
- **Issues:** https://github.com/harchschoolboy/pz-rcon-web-manager/issues

---

## 📄 License

GPL-3.0
