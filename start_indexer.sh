#!/bin/bash

# Remove stale PID file
rm -f ~/h2e/hive-processor.pid

# Start Node app in background
/usr/bin/node ~/h2e/index.js >> ~/h2e/hive-processor.log 2>&1 &

# Wait up to 5 seconds for the PID file to appear
for i in {1..5}; do
  sleep 1
  if [ -f ~/h2e/hive-processor.pid ]; then
    exit 0
  fi
done

echo "❌ PID file not found after 5 seconds" >&2
exit 1
