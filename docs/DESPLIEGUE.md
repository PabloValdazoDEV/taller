# Despliegue en el VPS (Ubuntu + Plesk, Arsys)

La app corre en **Docker** (app + PostgreSQL) y solo escucha en `127.0.0.1:3100`. El **nginx de Plesk** recibe el tráfico HTTPS del dominio y lo reenvía a la app.

> La imagen Docker se ha probado en local (compilar, migrar, arrancar, alta de taller, entrar y copia de seguridad/restauración). En el VPS todavía no.

## 1. Requisitos en el servidor

- Acceso SSH con `sudo`.
- Docker y el plugin Compose. En Plesk se pueden instalar desde **Herramientas y configuración → Actualizaciones → Añadir/eliminar componentes → Docker**, o por SSH:
  ```bash
  curl -fsSL https://get.docker.com | sudo sh
  ```
- Un dominio o subdominio que apunte al VPS, por ejemplo `valrodri.tudominio.es`.
- Al menos 2 GB de RAM libres para compilar la imagen (la compilación de Next.js es lo que más pide).

## 2. Subir el código y configurar

```bash
git clone https://github.com/PabloValdazoDEV/taller.git /opt/taller && cd /opt/taller
cp .env.example .env
nano .env
chmod 600 .env
```

Contenido de `.env`:

```
POSTGRES_PASSWORD=<contraseña larga aleatoria>       # openssl rand -hex 24
SESSION_SECRET=<cadena aleatoria de 64 caracteres>   # openssl rand -hex 32
DEFAULT_TALLER_SLUG=valrodri
```

`DATABASE_URL` y `STORAGE_DIR` ya los fija `docker-compose.prod.yml`. `PUBLIC_URL` se deja vacío: los enlaces (seguimiento, presupuestos, documentos) salen con el dominio por el que se entra, así cada taller usa el suyo.

> ⚠️ `SESSION_SECRET` firma las sesiones **y todos los enlaces enviados a clientes**. Si se cambia, todos los enlaces de seguimiento, presupuestos y documentos dejan de funcionar. Guárdalo en un sitio seguro (gestor de contraseñas).

## 3. Arrancar

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f app   # debe decir «Migraciones aplicadas» y «Ready»
curl -sI http://127.0.0.1:3100/login | head -1          # HTTP/1.1 200 OK
```

## 4. Alta del taller real

La base de datos solo escucha en `127.0.0.1:5433` del VPS. Desde tu Mac, abre un túnel SSH y lanza el alta (no borra nada; si el taller ya existe, se para):

```bash
ssh -N -L 5433:127.0.0.1:5433 usuario@vps &          # túnel
DATABASE_URL=postgres://taller:<POSTGRES_PASSWORD>@localhost:5433/taller \
  npx tsx scripts/alta-taller.ts --slug valrodri --nombre "Taller Valrodri" --admin "Pablo" --pin <6 cifras> \
  --razon "VALRODRI, S.L." --telefono "915 01 15 84" --direccion "C/ Cerámica 82-84 · 28038 Madrid"
kill %1                                              # cierra el túnel
```

Luego, en `https://valrodri.tudominio.es`, entra con ese PIN y completa **Configuración**: datos del taller (logo, sello, horario, tarifas, textos legales y frase de exención de IVA que dé la gestoría), empleados con sus PIN, coches de sustitución y capacidad.

### Taller de demo (opcional, para enseñar)

Igual que el alta, por el túnel, pero con un slug **distinto** del real:

```bash
DATABASE_URL=postgres://taller:<POSTGRES_PASSWORD>@localhost:5433/taller DEFAULT_TALLER_SLUG=demo npm run db:seed
```

> ⚠️ El seed **borra y recrea** el taller indicado. Solo actúa sobre talleres creados por él mismo (marcados como demo). Usa siempre `demo` (→ `demo.tudominio.es`), nunca el slug del taller real. Las fotos de la demo se crean en tu Mac, no en el servidor: el logo de la demo no saldrá (súbelo desde Configuración).

## 5. Plesk: dominio, HTTPS y proxy

1. **Sitios web y dominios → Añadir subdominio**, por ejemplo `valrodri` (y `demo` si quieres la demo).
2. **SSL/TLS → Let's Encrypt** para ese subdominio. Marca "Redirigir de HTTP a HTTPS".
3. **Configuración de Apache y nginx**:
   - Desmarca **"Modo proxy"** (para que nginx sirva directamente).
   - En **"Directivas adicionales de nginx"**:
     ```nginx
     client_max_body_size 30m;
     location / {
         proxy_pass http://127.0.0.1:3100;
         proxy_http_version 1.1;
         proxy_set_header Host $host;
         proxy_set_header X-Real-IP $remote_addr;
         proxy_set_header X-Forwarded-Host $host;
         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
         proxy_set_header X-Forwarded-Proto $scheme;
         proxy_set_header Upgrade $http_upgrade;
         proxy_set_header Connection "upgrade";
         proxy_read_timeout 120s;
     }
     ```
   `X-Forwarded-Host` es **imprescindible**: con él salen bien los enlaces que se mandan al cliente (seguimiento, resguardo, presupuesto); sin él, algunos saldrían como `localhost:3000`. `X-Real-IP` es la IP real del cliente: queda como evidencia en los PDF firmados y la usa el freno de intentos de PIN. `client_max_body_size` permite subir las fotos.

**Multi-taller:** cada taller entra por su subdominio (`otrotaller.tudominio.es`). El primer segmento del subdominio identifica el taller. Más adelante se puede usar un subdominio comodín (`*.tudominio.es`) con un certificado wildcard.

## 6. Copias de seguridad (imprescindible antes de usarlo de verdad)

`scripts/backup.sh` guarda la base de datos (`pg_dump`) y los ficheros (fotos y PDF firmados) en `/var/backups/taller` y conserva 14 días. Programarlo con cron (`sudo crontab -e`):

```
0 3 * * * /opt/taller/scripts/backup.sh >> /var/log/taller-backup.log 2>&1
```

Pruébalo a mano una vez: `sudo /opt/taller/scripts/backup.sh && ls -lh /var/backups/taller`.

**Copia fuera del VPS** (si el servidor se pierde, se pierden también sus copias). Con la variable `BACKUP_REMOTO` el script sube cada copia con `rsync` a otro sitio, por ejemplo un almacenamiento de Arsys, un NAS o tu Mac:

```
0 3 * * * BACKUP_REMOTO=usuario@otro-servidor:/copias/taller /opt/taller/scripts/backup.sh >> /var/log/taller-backup.log 2>&1
```

(necesita una clave SSH sin contraseña del root del VPS autorizada en el destino).

### Restaurar

```bash
cd /opt/taller
# Base de datos (sustituye todo el contenido actual)
docker compose -f docker-compose.prod.yml exec -T db pg_restore -U taller -d taller --clean --if-exists < /var/backups/taller/bd-AAAAMMDD-HHMM.dump
# Fotos y PDF
docker compose -f docker-compose.prod.yml run --rm --no-deps -u root -v /var/backups/taller:/backup --entrypoint sh app \
  -c "rm -rf /data/storage/* && tar xzf /backup/ficheros-AAAAMMDD-HHMM.tgz -C /data && chown -R app:app /data/storage"
docker compose -f docker-compose.prod.yml restart app
```

## 7. Actualizar

```bash
cd /opt/taller && git pull
docker compose -f docker-compose.prod.yml up -d --build   # las migraciones se aplican solas al arrancar
```

Antes de actualizar con el taller ya en uso, lanza una copia (`scripts/backup.sh`).
