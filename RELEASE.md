# Release Notes - PZ WebAdmin v1.0.0

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
