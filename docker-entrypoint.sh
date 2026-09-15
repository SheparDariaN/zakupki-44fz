#!/bin/sh
set -eu

data_dir="/app/data"
files_dir="${FILE_STORAGE_DIR:-/app/data/files}"

if [ -n "${FILE_STORAGE_DIR:-}" ]; then
  data_dir="$(dirname "$FILE_STORAGE_DIR")"
fi

mkdir -p "$data_dir"
mkdir -p "$files_dir"
chown -R node:node "$data_dir"

if [ -n "${POSTGRES_PASSWORD:-}" ]; then
  DATABASE_URL="$(node -e '
    const user = process.env.POSTGRES_USER || "zakupki";
    const password = process.env.POSTGRES_PASSWORD || "";
    const host = process.env.POSTGRES_HOST || "postgres";
    const port = process.env.POSTGRES_PORT || "5432";
    const db = process.env.POSTGRES_DB || "zakupki";
    const auth = `${encodeURIComponent(user)}:${encodeURIComponent(password)}`;
    process.stdout.write(`postgres://${auth}@${host}:${port}/${encodeURIComponent(db)}`);
  ')"
  export DATABASE_URL
fi

attempt=0
max_attempts="${MIGRATE_MAX_ATTEMPTS:-30}"
until su-exec node npm run migrate:up; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge "$max_attempts" ]; then
    echo "zakupki-app: migrations failed after ${attempt} attempts" >&2
    exit 1
  fi
  echo "zakupki-app: databases not ready yet, retry ${attempt}/${max_attempts}" >&2
  sleep 2
done

exec su-exec node "$@"
