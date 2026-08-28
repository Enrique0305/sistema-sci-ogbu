# Sistema Digital de Atenciones e Indicadores SCI - OGBU UNMSM

Digitaliza el registro de atenciones y la evaluacion de satisfaccion estudiantil
de los servicios de Alimentacion, Servicio Social y Residencias Universitarias,
y genera los indicadores de gestion (ICA e ISE) requeridos por el Sistema de
Control Interno (SCI).

## Estructura del proyecto

```
sistema-sci-ogbu/
├── database/
│   ├── schema_postgresql.sql   # DDL + datos dummy (PostgreSQL)
│   └── schema_mysql.sql        # DDL + datos dummy (MySQL / MariaDB)
├── backend/                    # API REST (Node.js + Express + PostgreSQL)
└── frontend/                   # SPA (React + Vite + Tailwind CSS)
```

## Requisitos previos

- Node.js 18 o superior y npm
- PostgreSQL 13+ (o MySQL 8+ si se usa `schema_mysql.sql`, ajustando el
  driver del backend — ver nota al final)
- Un cliente SQL (psql, DBeaver, pgAdmin, etc.)

## 1. Base de datos

1. Crear la base de datos y un usuario de aplicacion con privilegios minimos:

   ```bash
   psql -U postgres -c "CREATE DATABASE sci_ogbu;"
   psql -U postgres -c "CREATE USER sci_ogbu_app WITH PASSWORD 'cambiar_esta_clave';"
   psql -U postgres -d sci_ogbu -c "GRANT ALL PRIVILEGES ON DATABASE sci_ogbu TO sci_ogbu_app;"
   ```

2. Ejecutar el script de esquema y datos dummy:

   ```bash
   psql -U sci_ogbu_app -d sci_ogbu -f database/schema_postgresql.sql
   ```

   (Para MySQL: `mysql -u root -p sci_ogbu < database/schema_mysql.sql`)

## 2. Backend

```bash
cd backend
npm install
cp .env.example .env
```

Editar `.env` con las credenciales reales de la base de datos:

```
PORT=4000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sci_ogbu
DB_USER=sci_ogbu_app
DB_PASSWORD=cambiar_esta_clave
CORS_ORIGIN=http://localhost:5173
```

Levantar el servidor en modo desarrollo:

```bash
npm run dev
```

Verificar que responde:

```bash
curl http://localhost:4000/api/health
```

## 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env   # solo si el backend no corre en localhost:4000
npm run dev
```

Abrir `http://localhost:5173` en el navegador.

## 4. Flujo de prueba end-to-end

1. En **Registro de atencion**, buscar el codigo `20190001` (dato dummy) y
   confirmar que se muestra el nombre del estudiante.
2. Seleccionar el servicio **Alimentacion**, completar motivo y guardar.
3. Si el trimestre vigente tiene preguntas de encuesta activas para ese
   servicio, se abrira automaticamente el modal de encuesta
   (`trigger_encuesta: true`); responder y enviar.
4. Ir a **Dashboard de indicadores** y verificar que el KPI de total de
   atenciones y el ISE por servicio/trimestre reflejan el nuevo registro,
   y que la tabla de atenciones recientes lo muestra.
5. Probar los filtros de fecha y servicio en el dashboard.

> Nota sobre el trimestre vigente: el trigger de encuesta depende de que la
> fecha actual caiga dentro de un rango `fecha_inicio`/`fecha_fin` en la
> tabla `trimestres`. Los datos dummy cubren 2026 (T1-T3); ajustar las
> fechas del script SQL si se prueba fuera de ese rango.

## 5. Endpoints principales

| Metodo | Ruta                         | Descripcion                                            |
|--------|------------------------------|---------------------------------------------------------|
| POST   | `/api/atenciones`            | Registra una atencion y evalua si corresponde encuesta |
| GET    | `/api/atenciones`            | Lista atenciones con filtros de fecha/servicio/estado  |
| GET    | `/api/indicadores/dashboard` | Calcula ICA e ISE, y KPIs generales                    |
| POST   | `/api/encuestas/responder`   | Guarda respuestas de encuesta (transaccional)          |
| GET    | `/api/estudiantes/:codigo`   | Busqueda rapida de estudiante por codigo               |
| GET    | `/api/servicios`             | Lista servicios OGBU activos                           |

## 6. Seguridad implementada

- Consultas 100% parametrizadas (`$1, $2, ...`) contra `pg` — sin
  concatenacion de strings — para prevenir inyeccion SQL.
- Validacion y sanitizacion de entrada con `express-validator` en cada ruta
  (tipos, longitudes, formatos, whitelists de valores permitidos).
- Cabeceras HTTP endurecidas con `helmet` y CORS restringido a origenes
  configurados explicitamente.
- Rate limiting general y reforzado en endpoints de escritura
  (`/api/atenciones`, `/api/encuestas`) para mitigar abuso.
- Manejo centralizado de errores que no filtra detalles internos
  (stack traces, SQL) al cliente.
- Transacciones (`BEGIN`/`COMMIT`/`ROLLBACK`) para operaciones multi-fila
  como el guardado masivo de respuestas de encuesta.

## 7. Notas sobre MySQL

El backend incluido usa el driver `pg` (PostgreSQL). Para usar
`schema_mysql.sql` con este mismo backend, reemplazar `pg` por `mysql2` en
`backend/src/config/db.js` (pool `mysql2/promise`) y ajustar los
placeholders de `$1, $2, ...` a `?` en los controladores. El diseño de
tablas, indices y constraints es equivalente en ambos scripts.
