#!/bin/sh
set -eu

data_dir="/app/data"
if [ -n "${DB_FILE:-}" ]; then
  data_dir="$(dirname "$DB_FILE")"
fi

mkdir -p "$data_dir"
chown -R node:node "$data_dir"

exec su-exec node "$@"
