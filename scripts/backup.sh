#!/bin/sh
# Copia de seguridad diaria (programar en cron del VPS):
#   0 3 * * * /ruta/al/proyecto/scripts/backup.sh >> /var/log/taller-backup.log 2>&1
# Guarda BD + ficheros (fotos y PDF firmados) y conserva 14 días.
set -e
cd "$(dirname "$0")/.."
DEST=${BACKUP_DIR:-/var/backups/taller}
FECHA=$(date +%Y%m%d-%H%M)
mkdir -p "$DEST"
docker compose -f docker-compose.prod.yml exec -T db pg_dump -U taller -Fc taller > "$DEST/bd-$FECHA.dump"
docker compose -f docker-compose.prod.yml run --rm --no-deps -u root -v "$DEST":/backup --entrypoint sh app \
  -c "tar czf /backup/ficheros-$FECHA.tgz -C /data storage"
find "$DEST" -type f -mtime +14 -delete
# Copia fuera del VPS (opcional): BACKUP_REMOTO=usuario@host:/ruta
if [ -n "$BACKUP_REMOTO" ]; then
  rsync -a "$DEST/bd-$FECHA.dump" "$DEST/ficheros-$FECHA.tgz" "$BACKUP_REMOTO/"
  echo "✔ Copiado a $BACKUP_REMOTO"
fi
echo "✔ Backup $FECHA en $DEST"
