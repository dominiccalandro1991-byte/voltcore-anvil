#!/bin/sh
# Revive contract: idempotent, non-blocking, preview on 0.0.0.0:8080 via npm run dev.
set -eu
if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
  exit 0
fi
cd /workspace
nohup npm run dev >/tmp/voltcore-anvil-dev.log 2>&1 &
exit 0
