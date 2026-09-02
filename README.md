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
│   ├── schema_postgresql.sql   # DDL (PostgreSQL) -- ver Nota 7, desactualizado
│   ├── schema_mysql.sql        # DDL + catalogos de referencia (MySQL / MariaDB)
│   ├── seed_demo_dummy.sql     # Estudiantes/atenciones FICTICIOS, solo para pruebas locales
│   └── migrations/             # Cambios incrementales para bases ya desplegadas
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

2. Ejecutar el script de esquema (incluye catalogos de referencia: servicios,
   unidades, categorias, acciones -- necesarios para que el sistema sea
   usable; NO incluye estudiantes ni atenciones ficticias):

   ```bash
   mysql -u sci_ogbu_app -p sci_ogbu < database/schema_mysql.sql
   ```

   (Para PostgreSQL en lugar de MySQL, ver la [Nota 7](#7-notas-sobre-postgresql) al final.)

3. (Opcional, solo para desarrollo/pruebas locales) Cargar 8 estudiantes y
   10 atenciones ficticios para probar el sistema sin datos reales:

   ```bash
   mysql -u sci_ogbu_app -p sci_ogbu < database/seed_demo_dummy.sql
   ```

   **No cargar este archivo en un servidor real accesible para la OGBU** --
   por eso `docker-compose.yml` (seccion 9) no lo monta automaticamente.

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

> Requiere haber cargado `database/seed_demo_dummy.sql` (paso 3 de la
> seccion 1); con solo `schema_mysql.sql` no existen estudiantes todavia.

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

| Metodo | Ruta                             | Descripcion                                                     |
|--------|----------------------------------|----------------------------------------------------------------|
| POST   | `/api/atenciones`                | Registra una atencion/ticket, detecta reincidencia y evalua encuesta |
| GET    | `/api/atenciones`                | Lista con filtros de fecha, servicio, unidad, categoria, estado, prioridad |
| GET    | `/api/atenciones/:id`            | Detalle de una atencion + historial de cambios de estado       |
| PATCH  | `/api/atenciones/:id/estado`     | Cambia el estado respetando el ciclo de vida (transaccional)   |
| GET    | `/api/indicadores/dashboard`     | ICA, ISE, tiempo de resolucion, estados, reincidencia, KPIs    |
| POST   | `/api/encuestas/responder`       | Guarda respuestas de encuesta (transaccional)                  |
| GET    | `/api/estudiantes/:codigo`       | Busqueda rapida de estudiante por codigo                       |
| GET    | `/api/servicios?ambito=sci\|todos`| Lista servicios (SCI + internos); `es_sci` en la respuesta     |
| GET    | `/api/unidades?servicio_id=`     | Unidades/oficinas activas, filtrables por servicio             |
| GET    | `/api/usuarios?unidad_id=`       | Operadores activos, filtrables por unidad                      |
| GET    | `/api/categorias?servicio_id=`   | Catalogo de tipos de atencion                                  |
| GET    | `/api/acciones?servicio_id=`     | Catalogo de acciones tomadas                                   |

### Ciclo de estados de una atencion (mesa de ayuda)

```
Registrada  -> En atencion | Derivada | Cerrada
En atencion -> Derivada | Resuelta | Registrada
Derivada    -> En atencion | Resuelta
Resuelta    -> Cerrada | Reabierta
Cerrada     -> Reabierta
Reabierta   -> En atencion | Resuelta
```

Al pasar a `Resuelta` se fija `fecha_resolucion`; a `Cerrada`, `fecha_cierre`
(habilita el indicador de tiempo promedio de atencion). Cada cambio queda en
`atenciones_historial` (estado, comentario, unidad, momento). Las transiciones
invalidas se rechazan con 409. Definidas en `backend/src/utils/estadoAtencion.js`.

### Categorizacion y reincidencia

Las atenciones se clasifican con `categorias_atencion` (catalogo por servicio) y
`catalogo_acciones`. Al registrar una atencion de un estudiante en una categoria
que ya tuvo antes, el sistema la marca como reincidente y la enlaza a la anterior
(`atencion_origen_id`). El catalogo se puebla enviando a cada oficina la plantilla
`docs/formatos/Formato_Catalogo_Atenciones_OGBU.xlsx` y luego:

```bash
# copiar los .xlsx llenados a docs/formatos/entrada/ y ejecutar:
docker compose run --rm backend npm run import:catalogo
```

### Tickets internos

Ademas de atenciones a estudiantes, se registran tickets internos (sin estudiante,
con `solicitante_desc`) en los servicios internos `Soporte TI` y `Gestion OGBU`
(`es_sci = 0`, no entran en ICA/ISE).

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
  (guardado de encuestas, registro de atenciones con historial, cambios de estado).

> **Pendiente de seguridad:** el sistema aun no tiene autenticacion de usuarios.
> La unidad y el operador de cada atencion/cambio de estado se eligen en el
> formulario, no se toman de una sesion. Antes de un uso multi-oficina real debe
> incorporarse login y control de acceso por unidad.

### Estructura de la base de datos (mesa de ayuda)

`schema_mysql.sql` es el esquema completo para instalacion limpia. Para bases ya
desplegadas, aplicar los cambios incrementales de `database/migrations/`
(ver `database/migrations/README.md`) — **no** usar `docker compose down -v`, que
borraria los estudiantes sincronizados. Tablas principales anadidas:
`unidades`, `categorias_atencion`, `catalogo_acciones`, `atenciones_historial`;
`atenciones` gana unidad/categoria/accion/prioridad/derivacion y el nuevo ciclo
de estados.

## 7. Notas sobre PostgreSQL

El backend incluido usa el driver `mysql2` (MySQL/MariaDB). Si prefieres
PostgreSQL, usa `database/schema_postgresql.sql` (mismo modelo de tablas,
indices y constraints) y adapta `backend/src/config/db.js` para usar el
driver `pg` con un `Pool` de `pg`, cambiando los placeholders `?` por
`$1, $2, ...` y las llamadas `RETURNING` en los `INSERT` de los controladores
en lugar de una consulta `SELECT` posterior por `insertId`.

**Desactualizado:** `schema_postgresql.sql` todavia refleja el modelo
original de 7 tablas (antes de la mesa de ayuda) y no incluye `unidades`,
`categorias_atencion`, `catalogo_acciones` ni `atenciones_historial`.
Usarlo tal cual solo sirve para el Registro de Atenciones/Dashboard SCI
originales, no para las funciones de mesa de ayuda descritas mas abajo.

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

## 9. Despliegue con Docker (servidor en la red institucional)

Stack completo (MySQL + backend + frontend) con `docker-compose.yml` en
la raiz del repo. El frontend se sirve como **build estatico detras de
nginx**, que ademas hace de proxy de `/api` hacia el backend. Solo se
publica un puerto HTTP (`HTTP_PORT`, 8080 por defecto); el backend y
MySQL quedan en la red interna de Compose. La API se consume como ruta
relativa `/api`, asi que el sistema se abre desde **cualquier equipo de
la LAN** por la IP del servidor sin recompilar.

```
Navegadores LAN -> http://IP-DEL-SERVIDOR:8080
                          |
                  [ frontend ] nginx: SPA + proxy  /api -> backend:4000
                  [ backend  ] Node.js + Express (solo red interna)
                  [ mysql    ] MySQL 8 (volumen mysql_data)
```

1. Configurar `backend/.env` igual que en la seccion 2 (obligatorio).
2. `cp .env.example .env` en la raiz del repo y ajustar contrasenas de
   base de datos, `HTTP_PORT` y `CORS_ORIGIN`. `DB_NAME`/`DB_USER`/
   `DB_PASSWORD` de este archivo se usan tanto en el contenedor de MySQL
   como en el backend, para que nunca queden desincronizados.
3. Si vas a usar la integracion Oracle SUM: colocar la carpeta del
   Wallet en `./oracle_wallet` junto a este README (o definir
   `ORACLE_WALLET_HOST_DIR` en el `.env` de la raiz). El backend corre en
   Linux dentro del contenedor, asi que **siempre** necesita modo Thick
   con Instant Client para Linux — el `Dockerfile` ya lo descarga e
   instala automaticamente durante el build.
4. Levantar todo:
   ```bash
   docker compose up -d --build
   ```
   El sistema queda en `http://IP-DEL-SERVIDOR:8080` (y
   `http://localhost:8080` en el propio servidor). La primera vez que se
   crea el volumen de MySQL se carga automaticamente
   `database/schema_mysql.sql` (esquema + catalogos de referencia). A
   proposito **no** incluye estudiantes ni atenciones ficticias -- un
   servidor real arranca con la tabla `estudiantes` vacia hasta que se
   corre la sincronizacion con Oracle SUM (9.1) o se cargan altas manuales.
5. Abrir el puerto en el firewall de Windows para el acceso desde la LAN:
   ```powershell
   New-NetFirewallRule -DisplayName "SCI-OGBU HTTP 8080" -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow
   ```
### 9.1. Sincronizacion de alumnos reales desde Oracle SUM

Puebla `estudiantes` con la matricula vigente (vista `OBIENESTAR.ALUMNO`).
Requiere que el servidor tenga alcance de
red a la base Autonomous del SUM (`10.110.2.208:1522`, solo accesible
desde la red institucional).

1. Wallet en `./oracle_wallet` (cwallet.sso, ewallet.pem, tnsnames.ora,
   sqlnet.ora). Editar `sqlnet.ora` para que apunte a la ruta del Wallet
   **dentro del contenedor** (si no, `ORA-28759` en modo Thick):
   ```
   WALLET_LOCATION = (SOURCE = (METHOD = file) (METHOD_DATA = (DIRECTORY="/app/oracle_wallet")))
   SSL_SERVER_DN_MATCH=no
   ```
2. En `backend/.env`: `ORACLE_USER`, `ORACLE_PASSWORD`, `ORACLE_DSN`
   (alias de `tnsnames.ora`, ej. `SUMDB_TP`) y `ORACLE_SYNC_PERIODOS_N`
   (nº de periodos academicos recientes a traer, def. 4).
   `ORACLE_WALLET_DIR` y `ORACLE_INSTANT_CLIENT_DIR` las fija Compose.
3. Ejecutar (el backend ya trae el Instant Client registrado con
   `ldconfig`, necesario para que `oracledb` lo cargue):
   ```bash
   docker compose run --rm backend npm run sync:alumnos
   ```
   Tarda unos minutos (upsert fila por fila de ~40k alumnos). Imprime
   los periodos usados, insertados/actualizados y el detalle de filas
   omitidas (nunca omite en silencio; el motivo tipico es correo vacio
   o invalido en la fuente).
4. Programar como tarea recurrente (opcional): Programador de tareas de
   Windows con la accion `docker compose run --rm backend npm run sync:alumnos`
   ejecutada en la carpeta del repo.

**Advertencia:** `database/seed_demo_dummy.sql` (8 estudiantes ficticios,
codigos como `20190001`) existe solo para pruebas locales — **nunca
cargarlo en un servidor real**. Si se carga por error y luego se corre la
sincronizacion, un codigo real que coincida por casualidad con uno
ficticio hara que Oracle sobreescriba el nombre dummy con el real,
dejando atenciones de prueba pegadas a un estudiante real (ver
`git log` del 2 de septiembre de 2026 para el caso real que motivo este
cambio). Si eso ya paso: identificar las atenciones con
`SELECT * FROM atenciones WHERE estudiante_id IN (SELECT estudiante_id
FROM estudiantes WHERE creado_en < 'FECHA_DE_LA_SINCRONIZACION')` y
borrarlas (`respuestas_encuesta` primero, luego `atenciones`) en vez de
recrear el volumen completo.

### 9.2. Operacion

`docker compose ps` (estado), `docker compose logs -f`
(logs), `docker compose stop` / `start` (pausar sin borrar datos),
`docker compose down` (apagar conservando el volumen),
`docker compose down -v` (apagar y **borrar** la base). Tras `git pull`:
`docker compose up -d --build`.

**Nota:** `backend/.env` sigue siendo el mismo archivo que sin Docker,
pero `docker-compose.yml` sobreescribe en tiempo de ejecucion las
variables que dependen de la topologia de contenedores (`DB_HOST`,
`DB_*`, `CORS_ORIGIN`, `ORACLE_WALLET_DIR`, `ORACLE_INSTANT_CLIENT_DIR`)
— no hace falta editarlas manualmente para Docker.

**Seguridad:** el sistema aun no tiene autenticacion de usuarios;
limita el acceso a la red interna. Cambia las contrasenas por defecto
de `.env` antes de exponerlo. Para HTTPS, coloca un proxy inverso
institucional (o Caddy/nginx con certificado) delante del puerto 8080.

## Licencia

Este proyecto se distribuye bajo la licencia [MIT](LICENSE). Consulta el
archivo `LICENSE` para el texto completo.
