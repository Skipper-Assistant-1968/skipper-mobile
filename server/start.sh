#!/bin/bash
# Start Skipper Mobile API server

cd "$(dirname "$0")"

# Check if already running
if lsof -i :3031 >/dev/null 2>&1; then
  echo "⚠️  Server already running on port 3031"
  exit 1
fi

# Start in background with nohup
echo "🚀 Starting Skipper Mobile API..."
nohup node index.js > server.log 2>&1 &
PID=$!
echo $PID > server.pid

sleep 1

# Verify it started
if curl -s http://localhost:3031/api/heartbeat >/dev/null 2>&1; then
  echo "✅ Server started successfully (PID: $PID)"
  echo "📡 http://localhost:3031"
else
  echo "❌ Server failed to start. Check server.log"
  exit 1
fi
