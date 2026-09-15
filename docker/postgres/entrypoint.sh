#!/bin/sh
# Official postgres image applies POSTGRES_* only on an empty data dir.
# If the volume already exists (or the password in .env changed), sync
# role/database/password via local trust so the app can connect without
# wiping volumes or creating users by hand.
set -eu

READY_FILE="${ZAKUPKI_PG_READY_FILE:-/tmp/zakupki-pg-ready}"
rm -f "$READY_FILE"

sql_ident() {
  printf '"%s"' "$(printf '%s' "$1" | sed 's/"/""/g')"
}

sql_literal() {
  printf "'%s'" "$(printf '%s' "$1" | sed "s/'/''/g")"
}

can_connect() {
  psql --no-psqlrc -U "$1" -d "$2" -c 'SELECT 1' >/dev/null 2>&1
}

run_psql() {
  psql -v ON_ERROR_STOP=1 --no-psqlrc -U "$1" -d "$2" -c "$3"
}

query_psql() {
  psql --no-psqlrc -U "$1" -d "$2" -tAc "$3" | tr -d '[:space:]'
}

find_admin() {
  _i=0
  while [ "$_i" -lt 90 ]; do
    _i=$((_i + 1))
    for _u in "${POSTGRES_USER:-zakupki}" postgres; do
      for _adb in postgres template1 "${POSTGRES_DB:-zakupki}"; do
        if can_connect "$_u" "$_adb"; then
          printf '%s|%s' "$_u" "$_adb"
          return 0
        fi
      done
    done
    sleep 1
  done
  return 1
}

sync_role_and_db() {
  _role="${POSTGRES_USER:-zakupki}"
  _db="${POSTGRES_DB:-zakupki}"
  _password="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set}"

  _admin_pair=$(find_admin) || {
    echo "zakupki-postgres: timed out waiting for a local superuser" >&2
    return 1
  }
  _admin_user=${_admin_pair%%|*}
  _admin_db=${_admin_pair#*|}

  _role_ident=$(sql_ident "$_role")
  _db_ident=$(sql_ident "$_db")
  _role_lit=$(sql_literal "$_role")
  _db_lit=$(sql_literal "$_db")
  _pw_lit=$(sql_literal "$_password")

  _role_exists=$(query_psql "$_admin_user" "$_admin_db" \
    "SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = ${_role_lit}")

  if [ "$_role_exists" = "1" ]; then
    run_psql "$_admin_user" "$_admin_db" \
      "ALTER ROLE ${_role_ident} WITH LOGIN PASSWORD ${_pw_lit};" || {
      echo "zakupki-postgres: failed to update password for ${_role}" >&2
      return 1
    }
  else
    run_psql "$_admin_user" "$_admin_db" \
      "CREATE ROLE ${_role_ident} WITH LOGIN SUPERUSER PASSWORD ${_pw_lit};" || {
      echo "zakupki-postgres: failed to create role ${_role}" >&2
      return 1
    }
  fi

  _db_exists=$(query_psql "$_admin_user" postgres \
    "SELECT 1 FROM pg_database WHERE datname = ${_db_lit}")

  if [ "$_db_exists" = "1" ]; then
    run_psql "$_admin_user" postgres \
      "ALTER DATABASE ${_db_ident} OWNER TO ${_role_ident};" || true
  else
    run_psql "$_admin_user" postgres \
      "CREATE DATABASE ${_db_ident} OWNER ${_role_ident};" || {
      echo "zakupki-postgres: failed to create database ${_db}" >&2
      return 1
    }
  fi

  touch "$READY_FILE"
  echo "zakupki-postgres: role ${_role} and database ${_db} are ready" >&2
}

sync_role_and_db &

exec docker-entrypoint.sh "$@"
