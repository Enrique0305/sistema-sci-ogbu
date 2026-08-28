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

## Licencia

Este proyecto se distribuye bajo la licencia [MIT](LICENSE). Consulta el
archivo `LICENSE` para el texto completo.
