# Despliegue en el VPS (Ubuntu + Plesk, Arsys)

La app corre en **Docker** (app + PostgreSQL) y solo escucha en `127.0.0.1:3100`. El **nginx de Plesk** recibe el tráfico HTTPS del dominio y lo reenvía a la app.

> ⚠️ La imagen Docker todavía **no se ha probado** en el VPS. La compilación de producción (`npm run build`) sí funciona en local.

## 1. Requisitos en el servidor

- Acceso SSH con `sudo`.
- Docker y el plugin Compose. En Plesk se pueden instalar desde **Herramientas y configuración → Actualizaciones → Añadir/eliminar componentes → Docker**, o por SSH:
  ```bash
  curl -fsSL https://get.docker.com | sudo sh
  ```
- Un dominio o subdominio que apunte al VPS, por ejemplo `valrodri.tudominio.es`.

## 2. Subir el código y configurar

```bash
git clone <repo> /opt/taller && cd /opt/taller
cp .env.example .env
nano .env
```

Contenido mínimo de `.env`:

```
POSTGRES_PASSWORD=<contraseña larga aleatoria>
SESSION_SECRET=<cadena aleatoria de 64 caracteres>   # openssl rand -hex 32
DEFAULT_TALLER_SLUG=valrodri
```

`DATABASE_URL` y `STORAGE_DIR` ya los fija `docker-compose.prod.yml`.

## 3. Arrancar

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f app   # debe decir «Migraciones aplicadas» y «Ready»
```

### Datos de demo (opcional, solo para enseñar)

PostgreSQL solo está publicado en el `127.0.0.1:5433` del VPS, así que no es accesible desde fuera. Desde tu Mac, abre un túnel SSH y lanza el seed:

```bash
ssh -N -L 5433:127.0.0.1:5433 usuario@vps &          # túnel
DATABASE_URL=postgres://taller:<POSTGRES_PASSWORD>@localhost:5433/taller DEFAULT_TALLER_SLUG=demo npm run db:seed
```

Las fotos y los PDF que se creen durante la demo se guardan en el volumen `storage` del servidor.

> ⚠️ El seed **borra y recrea** el taller indicado. Por seguridad solo actúa sobre talleres creados por él mismo (marcados como demo) y se niega a ejecutarse con `NODE_ENV=production`. Usa siempre un slug de demo (p. ej. `demo` → `demo.tudominio.es`), nunca el del taller real.

## 4. Plesk: dominio, HTTPS y proxy

1. **Sitios web y dominios → Añadir subdominio**, por ejemplo `valrodri`.
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
         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
         proxy_set_header X-Forwarded-Proto $scheme;
         proxy_set_header Upgrade $http_upgrade;
         proxy_set_header Connection "upgrade";
     }
     ```
   `X-Forwarded-For` es necesario para que la IP del cliente quede registrada como evidencia en los PDF firmados. `client_max_body_size` permite subir las fotos.

**Multi-taller:** cada taller entra por su subdominio (`otrotaller.tudominio.es`). El primer segmento del subdominio identifica el taller. Más adelante se puede usar un subdominio comodín (`*.tudominio.es`) con un certificado wildcard.

## 5. Copias de seguridad

`scripts/backup.sh` guarda la base de datos (`pg_dump`) y los ficheros (fotos y PDF firmados), y conserva 14 días. Para programarlo con cron (`sudo crontab -e`):

```
0 3 * * * /opt/taller/scripts/backup.sh >> /var/log/taller-backup.log 2>&1
```

Recomendado: copiar además `/var/backups/taller` fuera del VPS (almacenamiento de Arsys, S3, etc.).

## 6. Actualizar

```bash
cd /opt/taller && git pull
docker compose -f docker-compose.prod.yml up -d --build   # las migraciones se aplican solas al arrancar
```
