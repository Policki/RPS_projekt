#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
if [ "$#" -ne 2 ] || [ "$2" != "--potrdi" ] || [ ! -f "$1" ]; then
    printf '%s\n' 'Uporaba: sh skripte/restore.sh backup/datoteka.sql --potrdi' 'Obnova prepiše podatke. Najprej naredi novo kopijo in ustavi aplikacijo.' >&2
    exit 1
fi
docker compose -f "${COMPOSE_FILE:-docker-compose.yml}" exec -T baza sh -c 'MYSQL_PWD="$MARIADB_PASSWORD" exec mariadb --user="$MARIADB_USER" "$MARIADB_DATABASE"' < "$1"
printf '%s\n' 'Baza obnovljena. Preveri še pripadajočo kopijo naloženih datotek.'
