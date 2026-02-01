# Skipper Mobile Operations Guide

This document describes how to operate, deploy, and troubleshoot the Skipper Mobile application.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Skipper Mobile Services                      │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (PWA)           │  API Server          │  Kanban      │
│  Port 4173               │  Port 3032           │  Port 3030    │
│  Vite Preview            │  Express + WebSocket │  Express      │
│  skipper-mobile-frontend │  skipper-mobile-api  │  kanban       │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────┐
                    │    ~/clawd/memory/        │
                    │    ~/clawd/digests/       │
                    │    Session Files          │
                    └───────────────────────────┘
```

## Service Management

### Systemd Services

All services run under systemd with auto-restart and boot-start enabled.

| Service | Port | Description | Service File |
|---------|------|-------------|--------------|
| `skipper-mobile-api` | 3032 | API + WebSocket (3034) | `/etc/systemd/system/skipper-mobile-api.service` |
| `skipper-mobile-frontend` | 4173 | PWA static server | `/etc/systemd/system/skipper-mobile-frontend.service` |
| `kanban` | 3030 | Kanban board API | `/etc/systemd/system/kanban.service` |

### Common Commands

```bash
# Check status of all services
sudo systemctl status skipper-mobile-api skipper-mobile-frontend kanban

# Restart all mobile services
sudo systemctl restart skipper-mobile-api skipper-mobile-frontend

# View logs (last 100 lines)
journalctl -u skipper-mobile-api -n 100
journalctl -u skipper-mobile-frontend -n 100

# Follow logs in real-time
journalctl -u skipper-mobile-api -f

# Stop a service
sudo systemctl stop skipper-mobile-api

# Start a service
sudo systemctl start skipper-mobile-api

# Disable auto-start
sudo systemctl disable skipper-mobile-api

# Enable auto-start
sudo systemctl enable skipper-mobile-api
```

### Health Checks

```bash
# API health check
curl http://localhost:3032/health

# Frontend check
curl -I http://localhost:4173/

# Full API heartbeat
curl http://localhost:3032/api/heartbeat
```

## Deployment Workflow

### Quick Deploy (Frontend Only)

```bash
cd ~/clawd/skipper-mobile

# Build new frontend
npm run build

# Restart frontend service to pick up new build
sudo systemctl restart skipper-mobile-frontend

# Verify
curl -s http://localhost:4173/ | head -5
```

### Full Deployment

```bash
cd ~/clawd/skipper-mobile

# Pull latest changes
git pull

# Install dependencies (if package.json changed)
npm install

# Build frontend
npm run build

# Restart all services
sudo systemctl restart skipper-mobile-api skipper-mobile-frontend

# Verify health
curl http://localhost:3032/health
curl -I http://localhost:4173/

# Commit build if needed
git add dist/
git commit -m "Build: $(date +%Y-%m-%d)"
git push
```

### Server/API Changes

If changes are made to `server/index.js`:

```bash
# Just restart the API (no build needed)
sudo systemctl restart skipper-mobile-api

# Verify
curl http://localhost:3032/health
```

## PWA Update Mechanism

The PWA uses **auto-update** with the following flow:

1. Service worker checks for updates on every page load
2. New version downloads in background
3. `skipWaiting` + `clientsClaim` activates it immediately
4. User sees the update on next navigation

### Force PWA Refresh

If a user has stale cache:

1. **In-app**: Settings → Clear Cache (if implemented)
2. **Browser**: Clear site data for the domain
3. **Dev console**: Application → Storage → Clear site data

### Debugging PWA Updates

```javascript
// In browser console
navigator.serviceWorker.ready.then(reg => {
  console.log('SW:', reg.active.scriptURL);
  reg.update();
});
```

## Tailscale Integration

Services are accessed via Tailscale at:
- **Frontend**: `https://skipper-assistant-1968.tail5697f1.ts.net:5173/`
- **API**: Port 3031 proxied to 3032
- **WebSocket**: Port 3033 proxied to 3034

Tailscale serve configuration:
```bash
tailscale serve status
```

## Troubleshooting

### Service Won't Start

```bash
# Check detailed status
sudo systemctl status skipper-mobile-api -l

# Check for port conflicts
ss -tlnp | grep -E "(3032|4173|3034)"

# Kill conflicting process
fuser -k 3032/tcp

# Restart
sudo systemctl start skipper-mobile-api
```

### Build Fails

```bash
# Check TypeScript errors
cd ~/clawd/skipper-mobile
npm run build 2>&1 | head -50

# Clear node_modules if needed
rm -rf node_modules
npm install
npm run build
```

### WebSocket Connection Issues

```bash
# Check if WebSocket port is open
ss -tlnp | grep 3034

# Test WebSocket
websocat ws://localhost:3034
```

### Memory/Disk Issues

```bash
# Check disk space
df -h /home/ubuntu

# Check memory
free -m

# Check process memory
ps aux --sort=-%mem | head -10
```

## Log Locations

- **API logs**: `journalctl -u skipper-mobile-api`
- **Frontend logs**: `journalctl -u skipper-mobile-frontend`
- **Application logs**: `~/clawd/skipper-mobile/server/*.log` (rotated daily)

## Backups

Critical data locations:
- `~/clawd/memory/` - Status, chat history, work logs
- `~/clawd/digests/` - YouTube digests, research
- `~/.clawdbot/agents/main/sessions/` - Session transcripts

## Configuration Files

| File | Purpose |
|------|---------|
| `/etc/systemd/system/skipper-mobile-api.service` | API systemd config |
| `/etc/systemd/system/skipper-mobile-frontend.service` | Frontend systemd config |
| `/etc/logrotate.d/skipper-mobile` | Log rotation config |
| `~/clawd/skipper-mobile/vite.config.ts` | Vite/PWA config |
| `~/clawd/skipper-mobile/server/index.js` | API server code |

## Version Info

Build timestamp and version are embedded at build time:
- `__BUILD_TIMESTAMP__` - ISO timestamp
- `__BUILD_ID__` - Compact build ID (YYYYMMDDHHmmss)
- `__APP_VERSION__` - Package version

Check current version in browser console or via API heartbeat.

---

*Last updated: 2026-02-01*
*Production readiness: ✅ Systemd-managed with auto-restart*
