# Migraciones de base de datos

`database/schema_mysql.sql` es el esquema completo para una **instalación
limpia** (lo carga automáticamente el contenedor de MySQL la primera vez).

Esta carpeta contiene los cambios incrementales para bases **ya desplegadas**
con datos reales, donde no se puede recrear el volumen (`docker compose down -v`
borraría los estudiantes sincronizados).

## Aplicar una migración

```bash
cd sistema-sci-ogbu

# 1. copia de seguridad
docker compose exec -T mysql sh -c \
  'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --databases sci_ogbu' \
  > backups/backup_$(date +%F).sql

# 2. aplicar
docker compose exec -T mysql sh -c \
  'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" sci_ogbu' \
  < database/migrations/002_helpdesk.sql

# 3. reconstruir imágenes con el código nuevo
docker compose up -d --build
```

Cada archivo se ejecuta **una sola vez**. No hay control automático de estado;
llevar el registro manualmente.

| Archivo | Descripción | Aplicada |
|---|---|---|
| (baseline) `schema_mysql.sql` | Modelo inicial (7 tablas) | — |
| `002_helpdesk.sql` | Mesa de ayuda: unidades, categorías, catálogo de acciones, ciclo de estados + historial, servicios internos, `estudiante_id` opcional | 2026-08-31 |
| `003_auth.sql` | Autenticación: `password_hash`, `rol_sistema`, bloqueo por intentos y cambio de clave obligatorio en `usuarios_responsables`; tabla `sesiones` | 2026-10-13 |
| `004_motivos.sql` | Motivos de atención recurrentes (`motivos_recurrentes`), cargados desde la hoja "Motivos" de la plantilla | 2026-10-13 |

## Restaurar desde backup

```bash
docker compose exec -T mysql sh -c \
  'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD"' < backups/backup_YYYY-MM-DD.sql
```
