#!/bin/sh
set -eu

PUBLIC_PORT="${PORT:-10000}"
export STORAGE_DIR="${STORAGE_DIR:-/var/data}"
mkdir -p "$STORAGE_DIR"

sed "s/__PORT__/${PUBLIC_PORT}/g" /etc/nginx/nginx.conf.template > /tmp/nginx.conf

export PYTHONPATH=/app
cd /app

uvicorn app.main:app --host 127.0.0.1 --port 8000 &
export HOSTNAME=127.0.0.1
export PORT=3000
node server.js &

sleep 2
exec nginx -c /tmp/nginx.conf -g "daemon off;"
