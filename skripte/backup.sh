#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
mkdir -p backup
chmod 700 backup
ime="backup/sola-$(date -u +%Y-%m-%dT%H-%M-%SZ).sql"
trap 'rm -f "$ime.delno"' EXIT HUP INT TERM
docker compose -f "${COMPOSE_FILE:-docker-compose.yml}" exec -T baza sh -c 'MYSQL_PWD="$MARIADB_PASSWORD" exec mariadb-dump --user="$MARIADB_USER" --single-transaction --skip-lock-tables --hex-blob "$MARIADB_DATABASE"' > "$ime.delno"
chmod 600 "$ime.delno"
mv "$ime.delno" "$ime"
printf '%s\n' "Kopija baze: $ime"
