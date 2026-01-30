# Skipper Mobile API Server

Backend API for the Skipper Mobile PWA. Provides real-time status, heartbeat, and work log access.

## Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/heartbeat` | Alive status, timestamp, current state, agent count |
| `GET /api/status` | Current focus, active agents, recent tasks |
| `GET /api/work-log/:date?` | Work log entries (default: today, format: YYYY-MM-DD) |
| `GET /api/work-logs` | List all available work log dates |

## Running

```bash
# Install dependencies
npm install

# Start server (port 3031)
npm start

# Development mode (auto-restart on changes)
npm run dev
```

## Configuration

- **Port**: 3031 (configurable via `PORT` env var)
- **Data sources**:
  - `~/clawd/memory/status.json` - Current status
  - `~/clawd/memory/work-log/` - Work log markdown files

## Example Responses

### GET /api/heartbeat
```json
{
  "alive": true,
  "timestamp": "2026-01-30T14:10:52.772Z",
  "serverUptime": 3,
  "state": "orchestrating",
  "agentCount": 3,
  "lastHeartbeat": "2026-01-30T14:09:00Z",
  "version": "1.0.0"
}
```

### GET /api/status
```json
{
  "state": "orchestrating",
  "currentFocus": "Building Skipper Mobile MVP",
  "agents": [...],
  "agentCount": 3,
  "recentTasks": [...],
  "stateEmoji": "🟡",
  "stateLabel": "Working (agents active)"
}
```

### GET /api/work-log/2026-01-30
```json
{
  "date": "2026-01-30",
  "raw": "# Work Log - January 30, 2026...",
  "entries": [
    {
      "time": "13:55",
      "title": "Skipper Mobile App Project Created",
      "trigger": "...",
      "completed": [...],
      "next": "..."
    }
  ],
  "entryCount": 3
}
```

## CORS

Configured to allow requests from:
- `http://localhost:5173` (Vite dev server)
- `http://localhost:3030` (Kanban API)
- `http://localhost:3031` (Self)
- Tailscale domains (`*.ts.net`)

## Running Alongside Kanban API

This server runs on port 3031, while the kanban API runs on port 3030. They can run simultaneously.

For a combined reverse proxy setup, consider using Nginx or Tailscale serve:

```bash
# Serve via Tailscale (example)
tailscale serve --bg 3031
```
