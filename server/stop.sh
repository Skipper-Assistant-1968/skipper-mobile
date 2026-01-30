#!/bin/bash
# Stop Skipper Mobile API server

cd "$(dirname "$0")"

if [ -f server.pid ]; then
  PID=$(cat server.pid)
  if kill -0 $PID 2>/dev/null; then
    kill $PID
    rm server.pid
    echo "✅ Server stopped (PID: $PID)"
  else
    echo "⚠️  Process $PID not running"
    rm server.pid
  fi
else
  # Fallback: find by port
  PID=$(lsof -t -i :3031 2>/dev/null)
  if [ -n "$PID" ]; then
    kill $PID
    echo "✅ Server stopped (PID: $PID)"
  else
    echo "⚠️  No server running on port 3031"
  fi
fi
