# Sistema Digital de Atenciones e Indicadores SCI - OGBU UNMSM

[![License: MIT](https://img.shields.io/github/license/Enrique0305/sistema-sci-ogbu)](LICENSE)
![Status](https://img.shields.io/badge/estado-prototipo%20funcional-yellow)
![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?logo=tailwindcss&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?logo=mysql&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-13%2B-4169E1?logo=postgresql&logoColor=white)

> **Estado:** prototipo funcional desarrollado y probado en agosto de 2026; aun no
> desplegado en produccion ni en uso operativo por la OGBU. Ver el recuadro
> "Estado y Alcance" en `docs/anexos/Anexos_Tecnicos_SCI_OGBU.docx` para el detalle.

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
├── backend/                    # API REST (Node.js + Express + MySQL)
└── frontend/                   # SPA (React + Vite + Tailwind CSS)
```

## Requisitos previos

- Node.js 18 o superior y npm
- MySQL 8.0+ / MariaDB 10.5+ (el backend incluido usa el driver `mysql2`)
- Un cliente SQL (MySQL CLI, MySQL Workbench, DBeaver, etc.)

## 1. Base de datos

1. Crear la base de datos y un usuario de aplicacion con privilegios minimos:

   ```bash
   mysql -u root -p -e "CREATE DATABASE sci_ogbu CHARACTER SET utf8mb4;"
   mysql -u root -p -e "CREATE USER 'sci_ogbu_app'@'localhost' IDENTIFIED BY 'cambiar_esta_clave';"
   mysql -u root -p -e "GRANT ALL PRIVILEGES ON sci_ogbu.* TO 'sci_ogbu_app'@'localhost';"
   ```

2. Ejecutar el script de esquema y datos dummy:

   ```bash
   mysql -u sci_ogbu_app -p sci_ogbu < database/schema_mysql.sql
   ```

   (Para PostgreSQL en lugar de MySQL, ver la [Nota 7](#7-notas-sobre-postgresql) al final.)

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
DB_PORT=3306
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

- Consultas 100% parametrizadas (placeholders `?`) contra `mysql2` — sin
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

## 7. Notas sobre PostgreSQL

El backend incluido usa el driver `mysql2` (MySQL/MariaDB). Si prefieres
PostgreSQL, usa `database/schema_postgresql.sql` (mismo modelo de tablas,
indices y constraints) y adapta `backend/src/config/db.js` para usar el
driver `pg` con un `Pool` de `pg`, cambiando los placeholders `?` por
`$1, $2, ...` y las llamadas `RETURNING` en los `INSERT` de los controladores
en lugar de una consulta `SELECT` posterior por `insertId`.

## 8. Integracion con Oracle SUM (opcional)

Script de sincronizacion de solo lectura que trae la poblacion vigente de
alumnos desde la vista institucional `OBIENESTAR.ALUMNO` (fuente SUM,
Oracle Autonomous Database) hacia la tabla local `estudiantes`, para
reemplazar los datos dummy por datos reales de matricula.

**Alcance:** solo se sincronizan los campos que ya existen en `estudiantes`
(`codigo_estudiante`, `nombres`, `apellidos`, `facultad`,
`correo_institucional`) — minimizacion de datos personales. No se trae
DNI, telefono, direccion, fecha de nacimiento, promedio ni situacion
academica.

**Aislamiento:** toda la logica vive en `backend/src/config/oracle.js` y
`backend/src/integrations/oracleSum/`. El servidor HTTP principal
(`npm run dev` / `npm start`) nunca inicializa la conexion a Oracle, asi
que si Oracle no esta disponible el resto de la API sigue funcionando con
normalidad. La sincronizacion se ejecuta como script manual/cron, no como
endpoint HTTP, porque el proyecto aun no tiene autenticacion de usuarios.

1. Instalar dependencia (ya incluida en `package.json`):
   ```bash
   cd backend && npm install
   ```
2. Obtener el Wallet (carpeta con `cwallet.sso`, `ewallet.pem`,
   `tnsnames.ora`, `sqlnet.ora`) de la Oficina del SUM y guardarlo **fuera
   del repositorio** (ya esta en `.gitignore`, ej. `backend/oracle_wallet/`).
3. Completar en `backend/.env` (nunca en `.env.example` ni versionado):
   ```
   ORACLE_USER=...
   ORACLE_PASSWORD=...
   ORACLE_DSN=SUMDB_TP   # confirmar alias real en tnsnames.ora del Wallet
   ORACLE_WALLET_DIR=./oracle_wallet
   ORACLE_WALLET_PASSWORD=...
   ORACLE_SYNC_PERIODOS_N=4
   ORACLE_INSTANT_CLIENT_DIR=   # solo si se usa modo Thick (ver abajo)
   ```
4. Ejecutar:
   ```bash
   npm run sync:alumnos
   ```
   Imprime los periodos academicos detectados dinamicamente y un resumen
   (insertados/actualizados, y el detalle de filas omitidas con su motivo
   — nunca se omite una fila en silencio).

**Solucion de problemas frecuentes (Wallet + modo Thin/Thick):**

- `NJS-505: unable to initiate TLS connection ... bad decrypt` — el
  `ewallet.pem` del Wallet esta cifrado y no se cuenta con
  `ORACLE_WALLET_PASSWORD`. Se puede confirmar de forma independiente con
  `openssl pkcs8 -in ewallet.pem -nocrypt` (si pide password, esta
  cifrado). Si no se tiene esa password, la alternativa es usar modo
  Thick: instalar [Oracle Instant Client Basic](https://www.oracle.com/database/technologies/instant-client/downloads.html)
  (zip, sin instalador) y setear `ORACLE_INSTANT_CLIENT_DIR` apuntando a
  la carpeta `instantclient_XX_YY` extraida. En modo Thick se usa
  `cwallet.sso` (auto-login), que no requiere password de wallet.
- `ORA-28759: failure to open file` (solo en modo Thick, con Instant
  Client instalado como zip sin `ORACLE_HOME`) — el `sqlnet.ora` del
  Wallet trae `WALLET_LOCATION ... DIRECTORY="?/network/admin"`; ese `?`
  se resuelve contra `$ORACLE_HOME`, que no existe en una instalacion
  Instant Client tipo zip. Solucion: editar `sqlnet.ora` dentro de la
  carpeta del Wallet y reemplazar `"?/network/admin"` por la ruta
  absoluta real de esa misma carpeta, ej.
  `DIRECTORY="C:\ruta\completa\oracle_wallet"`.

**Reglas de seguridad de esta integracion:**
- Conexion a Oracle 100% de solo lectura (`src/config/oracle.js` rechaza
  cualquier sentencia que no empiece con `SELECT`/`WITH`).
- El Wallet y las credenciales nunca se registran en logs ni se imprimen
  en la salida del script.
- El frontend nunca se conecta a Oracle ni conoce estas credenciales.

## 9. Despliegue con Docker (alternativa a instalar todo localmente)

Stack completo (MySQL + backend + frontend) con `docker-compose.yml` en
la raiz del repo. Pensado para paridad de desarrollo (el frontend corre
`vite dev` dentro del contenedor, no es un build de produccion).

1. Configurar `backend/.env` igual que en la seccion 2 (obligatorio).
2. Si vas a usar la integracion Oracle SUM: colocar la carpeta del
   Wallet en `./oracle_wallet` junto a este README (o definir
   `ORACLE_WALLET_HOST_DIR` en un `.env` en la raiz, ver paso 3). El
   backend corre en Linux dentro del contenedor, asi que **siempre**
   necesita modo Thick con Instant Client para Linux — el `Dockerfile`
   ya lo descarga e instala automaticamente durante el build.
3. (Opcional) `cp .env.example .env` en la raiz del repo si necesitas
   cambiar `DB_NAME`/`DB_USER`/`DB_PASSWORD` (usados tanto por el
   contenedor de MySQL como por el backend, para que nunca queden
   desincronizados), `MYSQL_ROOT_PASSWORD`, la ruta del Wallet, o fijar
   una version especifica del Instant Client.
4. Levantar todo:
   ```bash
   docker compose up --build
   ```
   Frontend en `http://localhost:5173`, backend en
   `http://localhost:4000/api/health`. La primera vez que se crea el
   volumen de MySQL, se carga automaticamente `database/schema_mysql.sql`
   (esquema + datos dummy).
5. Para correr la sincronizacion de alumnos dentro del stack (en vez de
   `npm run sync:alumnos` local):
   ```bash
   docker compose run --rm backend npm run sync:alumnos
   ```

**Nota:** `backend/.env` sigue siendo el mismo archivo que sin Docker,
pero `docker-compose.yml` sobreescribe en tiempo de ejecucion las
variables que dependen de la topologia de contenedores
(`DB_HOST`, `ORACLE_WALLET_DIR`, `ORACLE_INSTANT_CLIENT_DIR`) — no hace
falta editarlas manualmente para Docker.

## Licencia

Este proyecto se distribuye bajo la licencia [MIT](LICENSE). Consulta el
archivo `LICENSE` para el texto completo.
