-- ============================================================================
-- Sistema Digital de Atenciones e Indicadores SCI - OGBU UNMSM
-- Motor: PostgreSQL 13+
-- Contiene: DDL (tablas, PK, FK, indices, constraints) + datos DUMMY de prueba
--
-- Modelo equivalente al de database/schema_mysql.sql (13 tablas + 1 vista):
-- mesa de ayuda (unidades, categorias, acciones, motivos recurrentes, ciclo de
-- estados con historial) y autenticacion (roles, credenciales, sesiones).
--
-- Equivalencias frente a la version MySQL:
--   * SERIAL / BIGSERIAL en lugar de AUTO_INCREMENT
--   * BOOLEAN en lugar de TINYINT(1) para los indicadores si/no
--   * VARCHAR + CHECK en lugar de ENUM
--   * btrim() en lugar de TRIM() en el CHECK de respuestas
-- Este script es para instalacion limpia; el backend incluido usa el driver
-- mysql2 (ver README, seccion "Notas sobre PostgreSQL").
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. SERVICIOS_OGBU
--    es_sci = TRUE  -> servicio reportable al SCI (entra en ICA / ISE)
--    es_sci = FALSE -> servicio interno (mesa de ayuda: TI, gestion)
-- ----------------------------------------------------------------------------
CREATE TABLE servicios_ogbu (
    servicio_id     SERIAL PRIMARY KEY,
    nombre_servicio VARCHAR(100) NOT NULL UNIQUE,
    descripcion     VARCHAR(255),
    estado          VARCHAR(20)  NOT NULL DEFAULT 'Activo'
        CONSTRAINT chk_servicio_estado CHECK (estado IN ('Activo', 'Inactivo')),
    es_sci          BOOLEAN      NOT NULL DEFAULT TRUE
);

-- ----------------------------------------------------------------------------
-- 2. UNIDADES  (oficinas / unidades operativas de la OGBU)
-- ----------------------------------------------------------------------------
CREATE TABLE unidades (
    unidad_id   SERIAL PRIMARY KEY,
    nombre      VARCHAR(120) NOT NULL UNIQUE,
    servicio_id INTEGER
        REFERENCES servicios_ogbu (servicio_id) ON DELETE SET NULL,
    tipo        VARCHAR(20)  NOT NULL DEFAULT 'Atencion'
        CONSTRAINT chk_unidad_tipo CHECK (tipo IN ('Atencion', 'Soporte', 'Direccion')),
    estado      BOOLEAN      NOT NULL DEFAULT TRUE,
    creado_en   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_unidades_servicio ON unidades (servicio_id);

-- ----------------------------------------------------------------------------
-- 3. USUARIOS_RESPONSABLES  (operadores, pertenecen a una unidad)
--    rol_sistema define los permisos en la aplicacion; password_hash NULL
--    significa "sin credenciales" (no puede iniciar sesion).
-- ----------------------------------------------------------------------------
CREATE TABLE usuarios_responsables (
    usuario_id           SERIAL PRIMARY KEY,
    nombres              VARCHAR(100) NOT NULL,
    apellidos            VARCHAR(100) NOT NULL,
    correo_institucional VARCHAR(150) NOT NULL UNIQUE,
    password_hash        VARCHAR(255),
    rol                  VARCHAR(50)  NOT NULL DEFAULT 'Operador',
    rol_sistema          VARCHAR(20)  NOT NULL DEFAULT 'Operador'
        CONSTRAINT chk_usuario_rol_sistema CHECK (rol_sistema IN ('Administrador', 'Operador', 'Consulta')),
    unidad_id            INTEGER
        REFERENCES unidades (unidad_id) ON DELETE SET NULL,
    cargo                VARCHAR(80),
    estado               BOOLEAN      NOT NULL DEFAULT TRUE,
    creado_en            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    debe_cambiar_clave   BOOLEAN      NOT NULL DEFAULT FALSE,
    intentos_fallidos    SMALLINT     NOT NULL DEFAULT 0
        CONSTRAINT chk_usuario_intentos CHECK (intentos_fallidos BETWEEN 0 AND 255),
    bloqueado_hasta      TIMESTAMP,
    ultimo_acceso        TIMESTAMP,
    clave_actualizada_en TIMESTAMP
);

CREATE INDEX idx_usuarios_rol_sistema ON usuarios_responsables (rol_sistema);

-- ----------------------------------------------------------------------------
-- 3b. SESIONES  (sesiones de login del lado del servidor)
--     Solo se guarda el hash SHA-256 del token; el token vive en una cookie
--     httpOnly. Eliminar la fila revoca la sesion al instante.
-- ----------------------------------------------------------------------------
CREATE TABLE sesiones (
    sesion_id   BIGSERIAL PRIMARY KEY,
    token_hash  CHAR(64)    NOT NULL UNIQUE,
    usuario_id  INTEGER     NOT NULL
        REFERENCES usuarios_responsables (usuario_id) ON DELETE CASCADE,
    creado_en   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expira_en   TIMESTAMP   NOT NULL,
    ip          VARCHAR(45),
    user_agent  VARCHAR(255)
);

CREATE INDEX idx_sesiones_usuario ON sesiones (usuario_id);
CREATE INDEX idx_sesiones_expira  ON sesiones (expira_en);

-- ----------------------------------------------------------------------------
-- 4. ESTUDIANTES
-- ----------------------------------------------------------------------------
CREATE TABLE estudiantes (
    estudiante_id        SERIAL PRIMARY KEY,
    codigo_estudiante    VARCHAR(20)  NOT NULL UNIQUE,
    nombres              VARCHAR(100) NOT NULL,
    apellidos            VARCHAR(100) NOT NULL,
    facultad             VARCHAR(150) NOT NULL,
    correo_institucional VARCHAR(150) NOT NULL UNIQUE,
    estado               BOOLEAN      NOT NULL DEFAULT TRUE,
    creado_en            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_estudiante_correo CHECK (correo_institucional LIKE '%@%')
);

CREATE INDEX idx_estudiantes_facultad ON estudiantes (facultad);

-- ----------------------------------------------------------------------------
-- 5. TRIMESTRES
-- ----------------------------------------------------------------------------
CREATE TABLE trimestres (
    trimestre_id      SERIAL PRIMARY KEY,
    anio              SMALLINT NOT NULL,
    periodo_trimestre SMALLINT NOT NULL
        CONSTRAINT chk_periodo_trimestre CHECK (periodo_trimestre BETWEEN 1 AND 4),
    fecha_inicio      DATE,
    fecha_fin         DATE,
    CONSTRAINT uq_trimestre_anio_periodo UNIQUE (anio, periodo_trimestre)
);

-- ----------------------------------------------------------------------------
-- 6. CATEGORIAS_ATENCION  (catalogo de tipos de atencion, por servicio)
-- ----------------------------------------------------------------------------
CREATE TABLE categorias_atencion (
    categoria_id    SERIAL PRIMARY KEY,
    servicio_id     INTEGER      NOT NULL
        REFERENCES servicios_ogbu (servicio_id) ON DELETE CASCADE,
    nombre          VARCHAR(150) NOT NULL,
    descripcion     VARCHAR(400),
    suele_repetirse BOOLEAN      NOT NULL DEFAULT FALSE,
    activa          BOOLEAN      NOT NULL DEFAULT TRUE,
    orden           SMALLINT     NOT NULL DEFAULT 0,
    creado_en       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_categoria_servicio_nombre UNIQUE (servicio_id, nombre)
);

CREATE INDEX idx_categorias_servicio ON categorias_atencion (servicio_id);

-- ----------------------------------------------------------------------------
-- 7. CATALOGO_ACCIONES  (catalogo de acciones tomadas, por servicio)
-- ----------------------------------------------------------------------------
CREATE TABLE catalogo_acciones (
    accion_id   SERIAL PRIMARY KEY,
    servicio_id INTEGER      NOT NULL
        REFERENCES servicios_ogbu (servicio_id) ON DELETE CASCADE,
    nombre      VARCHAR(150) NOT NULL,
    descripcion VARCHAR(400),
    activa      BOOLEAN      NOT NULL DEFAULT TRUE,
    orden       SMALLINT     NOT NULL DEFAULT 0,
    CONSTRAINT uq_accion_servicio_nombre UNIQUE (servicio_id, nombre)
);

CREATE INDEX idx_acciones_servicio ON catalogo_acciones (servicio_id);

-- ----------------------------------------------------------------------------
-- 7b. MOTIVOS_RECURRENTES  (atajos de "motivo" frecuentes; el campo del
--     formulario sigue siendo texto libre)
-- ----------------------------------------------------------------------------
CREATE TABLE motivos_recurrentes (
    motivo_id          SERIAL PRIMARY KEY,
    servicio_id        INTEGER      NOT NULL
        REFERENCES servicios_ogbu (servicio_id) ON DELETE CASCADE,
    categoria_id       INTEGER
        REFERENCES categorias_atencion (categoria_id) ON DELETE SET NULL,
    texto              VARCHAR(300) NOT NULL,
    frecuencia_mensual SMALLINT
        CONSTRAINT chk_motivo_frecuencia CHECK (frecuencia_mensual IS NULL OR frecuencia_mensual >= 0),
    activo             BOOLEAN      NOT NULL DEFAULT TRUE,
    creado_en          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_motivo_servicio_texto UNIQUE (servicio_id, texto)
);

CREATE INDEX idx_motivos_categoria ON motivos_recurrentes (categoria_id);

-- ----------------------------------------------------------------------------
-- 8. ATENCIONES
--    estudiante_id NULL  -> ticket interno (usar solicitante_desc)
--    Ciclo de estados: Registrada -> En atencion -> (Derivada) -> Resuelta
--                      -> Cerrada ; Reabierta desde Resuelta/Cerrada.
-- ----------------------------------------------------------------------------
CREATE TABLE atenciones (
    atencion_id            SERIAL PRIMARY KEY,
    estudiante_id          INTEGER
        REFERENCES estudiantes (estudiante_id) ON DELETE RESTRICT,
    solicitante_desc       VARCHAR(200),
    servicio_id            INTEGER NOT NULL
        REFERENCES servicios_ogbu (servicio_id) ON DELETE RESTRICT,
    unidad_id              INTEGER NOT NULL
        REFERENCES unidades (unidad_id) ON DELETE RESTRICT,
    categoria_id           INTEGER
        REFERENCES categorias_atencion (categoria_id) ON DELETE SET NULL,
    fecha_atencion         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    descripcion_motivo     TEXT NOT NULL,
    diagnostico_accion     TEXT,
    accion_id              INTEGER
        REFERENCES catalogo_acciones (accion_id) ON DELETE SET NULL,
    usuario_responsable_id INTEGER
        REFERENCES usuarios_responsables (usuario_id) ON DELETE RESTRICT,
    estado_atencion        VARCHAR(20) NOT NULL DEFAULT 'Registrada'
        CONSTRAINT chk_estado_atencion CHECK (estado_atencion IN
            ('Registrada', 'En atencion', 'Derivada', 'Resuelta', 'Cerrada', 'Reabierta')),
    prioridad              VARCHAR(10) NOT NULL DEFAULT 'Media'
        CONSTRAINT chk_prioridad CHECK (prioridad IN ('Baja', 'Media', 'Alta')),
    atencion_origen_id     INTEGER
        REFERENCES atenciones (atencion_id) ON DELETE SET NULL,
    unidad_derivada_id     INTEGER
        REFERENCES unidades (unidad_id) ON DELETE SET NULL,
    fecha_resolucion       TIMESTAMP,
    fecha_cierre           TIMESTAMP,
    creado_en              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_atencion_solicitante
        CHECK (estudiante_id IS NOT NULL OR solicitante_desc IS NOT NULL)
);

CREATE INDEX idx_atenciones_estudiante      ON atenciones (estudiante_id);
CREATE INDEX idx_atenciones_servicio        ON atenciones (servicio_id);
CREATE INDEX idx_atenciones_unidad          ON atenciones (unidad_id);
CREATE INDEX idx_atenciones_categoria       ON atenciones (categoria_id);
CREATE INDEX idx_atenciones_estado          ON atenciones (estado_atencion);
CREATE INDEX idx_atenciones_fecha           ON atenciones (fecha_atencion);
CREATE INDEX idx_atenciones_servicio_fecha  ON atenciones (servicio_id, fecha_atencion);

-- ----------------------------------------------------------------------------
-- 9. ATENCIONES_HISTORIAL  (trazabilidad del ciclo de estados)
-- ----------------------------------------------------------------------------
CREATE TABLE atenciones_historial (
    historial_id           SERIAL PRIMARY KEY,
    atencion_id            INTEGER     NOT NULL
        REFERENCES atenciones (atencion_id) ON DELETE CASCADE,
    estado_anterior        VARCHAR(20),
    estado_nuevo           VARCHAR(20) NOT NULL,
    comentario             VARCHAR(600),
    unidad_id              INTEGER
        REFERENCES unidades (unidad_id) ON DELETE SET NULL,
    usuario_responsable_id INTEGER
        REFERENCES usuarios_responsables (usuario_id) ON DELETE SET NULL,
    creado_en              TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_hist_atencion ON atenciones_historial (atencion_id, creado_en);

-- ----------------------------------------------------------------------------
-- 10. PREGUNTAS_ENCUESTA
-- ----------------------------------------------------------------------------
CREATE TABLE preguntas_encuesta (
    pregunta_id     SERIAL PRIMARY KEY,
    servicio_id     INTEGER NOT NULL
        REFERENCES servicios_ogbu (servicio_id) ON DELETE CASCADE,
    trimestre_id    INTEGER NOT NULL
        REFERENCES trimestres (trimestre_id) ON DELETE CASCADE,
    texto_pregunta  VARCHAR(500) NOT NULL,
    tipo_respuesta  VARCHAR(20) NOT NULL
        CONSTRAINT chk_tipo_respuesta CHECK (tipo_respuesta IN ('Likert_1_5', 'Texto')),
    activa          BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_preguntas_servicio_trimestre ON preguntas_encuesta (servicio_id, trimestre_id);

-- ----------------------------------------------------------------------------
-- 11. RESPUESTAS_ENCUESTA
-- ----------------------------------------------------------------------------
CREATE TABLE respuestas_encuesta (
    respuesta_id     SERIAL PRIMARY KEY,
    pregunta_id      INTEGER NOT NULL
        REFERENCES preguntas_encuesta (pregunta_id) ON DELETE CASCADE,
    atencion_id      INTEGER
        REFERENCES atenciones (atencion_id) ON DELETE SET NULL,
    valor_respuesta  VARCHAR(500) NOT NULL,
    fecha_respuesta  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_valor_respuesta_no_vacio CHECK (btrim(valor_respuesta) <> '')
);

CREATE INDEX idx_respuestas_pregunta  ON respuestas_encuesta (pregunta_id);
CREATE INDEX idx_respuestas_atencion  ON respuestas_encuesta (atencion_id);

-- ----------------------------------------------------------------------------
-- 12. V_REINCIDENCIAS  (estudiante + categoria con mas de una atencion)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_reincidencias AS
SELECT estudiante_id,
       categoria_id,
       COUNT(*)            AS total_atenciones,
       MIN(fecha_atencion) AS primera_atencion,
       MAX(fecha_atencion) AS ultima_atencion
  FROM atenciones
 WHERE estudiante_id IS NOT NULL
   AND categoria_id IS NOT NULL
 GROUP BY estudiante_id, categoria_id
HAVING COUNT(*) > 1;

-- ============================================================================
-- DATOS DUMMY DE PRUEBA
-- ============================================================================

INSERT INTO servicios_ogbu (nombre_servicio, descripcion, estado, es_sci) VALUES
('Alimentacion',              'Servicio de Comedor Universitario',                  'Activo', TRUE),
('Servicio Social',           'Atencion y orientacion social',                      'Activo', TRUE),
('Residencias Universitarias','Alojamiento estudiantil',                            'Activo', TRUE),
('Soporte TI',                'Soporte tecnico y sistemas (Unidad de Informatica)', 'Activo', FALSE),
('Gestion OGBU',              'Gestion y direccion de la OGBU',                     'Activo', FALSE);

INSERT INTO unidades (nombre, servicio_id, tipo) VALUES
('Oficina de Alimentación',            1, 'Atencion'),
('Comedor de CU',                      1, 'Atencion'),
('Comedor de Cangallo',                1, 'Atencion'),
('Comedor de Veterinaria',             1, 'Atencion'),
('Comedor de San Juan de Lurigancho',  1, 'Atencion'),
('Residencia de Ciudad',               3, 'Atencion'),
('Residencia de Tello',                3, 'Atencion'),
('Oficina de Servicio Social',         2, 'Atencion'),
('Unidad de Informática',              4, 'Soporte'),
('Jefatura de OGBU',                   5, 'Direccion');

INSERT INTO usuarios_responsables (nombres, apellidos, correo_institucional, rol, unidad_id, cargo) VALUES
('Maria', 'Quispe Rojas',   'mquispe@unmsm.edu.pe',    'Trabajador Social', 8, 'Trabajadora social'),
('Jose',  'Torres Vidal',   'jtorres@unmsm.edu.pe',    'Nutricionista',     1, 'Nutricionista'),
('Ana',   'Fernandez Diaz', 'afernandez@unmsm.edu.pe', 'Administrador',    10, 'Asistente de jefatura'),
('Responsable', 'Comedor de CU',                      'responsable.unidad2@unmsm.edu.pe',  'Operador', 2, 'Responsable de unidad (placeholder)'),
('Responsable', 'Comedor de Cangallo',                'responsable.unidad3@unmsm.edu.pe',  'Operador', 3, 'Responsable de unidad (placeholder)'),
('Responsable', 'Comedor de Veterinaria',             'responsable.unidad4@unmsm.edu.pe',  'Operador', 4, 'Responsable de unidad (placeholder)'),
('Responsable', 'Comedor de San Juan de Lurigancho',  'responsable.unidad5@unmsm.edu.pe',  'Operador', 5, 'Responsable de unidad (placeholder)'),
('Responsable', 'Residencia de Ciudad',               'responsable.unidad6@unmsm.edu.pe',  'Operador', 6, 'Responsable de unidad (placeholder)'),
('Responsable', 'Residencia de Tello',                'responsable.unidad7@unmsm.edu.pe',  'Operador', 7, 'Responsable de unidad (placeholder)'),
('Responsable', 'Unidad de Informática',              'responsable.unidad9@unmsm.edu.pe',  'Operador', 9, 'Responsable de unidad (placeholder)');

INSERT INTO trimestres (anio, periodo_trimestre, fecha_inicio, fecha_fin) VALUES
(2026, 1, '2026-01-01', '2026-03-31'),
(2026, 2, '2026-04-01', '2026-06-30'),
(2026, 3, '2026-07-01', '2026-09-30');

INSERT INTO categorias_atencion (servicio_id, nombre, descripcion, suele_repetirse, orden) VALUES
(1, 'Solicitud de subsidio alimentario',      'Nueva solicitud de acceso al comedor', FALSE, 1),
(1, 'Renovación de subsidio alimentario',     'Continuidad del beneficio por otro periodo', TRUE, 2),
(1, 'Reclamo por calidad de alimentos',       'Queja sobre calidad, cantidad o temperatura', TRUE, 3),
(1, 'Consulta de requisitos o proceso',       NULL, TRUE, 4),
(1, 'Problema con el padrón / registro',      'El estudiante no figura o figura con datos errados', TRUE, 5),
(1, 'Otro / no tipificado',                   NULL, FALSE, 99),
(2, 'Evaluación socioeconómica',              NULL, FALSE, 1),
(2, 'Solicitud de constancia socioeconómica', NULL, TRUE, 2),
(2, 'Orientación / consejería',               NULL, TRUE, 3),
(2, 'Seguimiento de caso social',             'Continuidad de un caso ya abierto', TRUE, 4),
(2, 'Derivación a apoyo económico',           NULL, FALSE, 5),
(2, 'Otro / no tipificado',                   NULL, FALSE, 99),
(3, 'Postulación a residencia',               NULL, FALSE, 1),
(3, 'Renovación de residencia',               NULL, TRUE, 2),
(3, 'Reporte de incidencia en habitación',    'Desperfecto, daño o falla en la habitación', TRUE, 3),
(3, 'Solicitud de mantenimiento',             NULL, TRUE, 4),
(3, 'Convivencia / disciplina',               NULL, TRUE, 5),
(3, 'Otro / no tipificado',                   NULL, FALSE, 99),
(4, 'Falla de equipo / PC',                   NULL, TRUE, 1),
(4, 'Problema de red / internet',             NULL, TRUE, 2),
(4, 'Acceso a sistema / credenciales',        NULL, TRUE, 3),
(4, 'Instalación o configuración de software', NULL, TRUE, 4),
(4, 'Soporte al sistema SCI-OGBU',            NULL, TRUE, 5),
(4, 'Otro / no tipificado',                   NULL, FALSE, 99),
(5, 'Consulta administrativa',                NULL, TRUE, 1),
(5, 'Derivación entre oficinas',              NULL, TRUE, 2),
(5, 'Requerimiento de información',           NULL, TRUE, 3),
(5, 'Otro / no tipificado',                   NULL, FALSE, 99);

INSERT INTO catalogo_acciones (servicio_id, nombre, orden) VALUES
(1, 'Subsidio otorgado', 1),
(1, 'Subsidio denegado', 2),
(1, 'Derivado a control de calidad', 3),
(1, 'Información brindada', 4),
(1, 'Datos actualizados en el sistema', 5),
(2, 'Constancia emitida', 1),
(2, 'Caso derivado a apoyo socioeconómico', 2),
(2, 'Entrevista programada', 3),
(2, 'Orientación brindada', 4),
(2, 'Informe social elaborado', 5),
(3, 'Formulario y requisitos entregados', 1),
(3, 'Mantenimiento coordinado', 2),
(3, 'Cupo asignado', 3),
(3, 'Amonestación registrada', 4),
(3, 'Solicitud en evaluación', 5),
(4, 'Equipo reparado', 1),
(4, 'Configuración aplicada', 2),
(4, 'Credenciales restablecidas', 3),
(4, 'Software instalado', 4),
(4, 'Derivado a proveedor externo', 5),
(5, 'Derivado a la oficina competente', 1),
(5, 'Información remitida', 2),
(5, 'Trámite resuelto', 3);

INSERT INTO estudiantes (codigo_estudiante, nombres, apellidos, facultad, correo_institucional) VALUES
('20190001', 'Luis',    'Garcia Mendoza',   'Facultad de Ingenieria de Sistemas', 'luis.garcia1@unmsm.edu.pe'),
('20190045', 'Carla',   'Huaman Soto',      'Facultad de Medicina',               'carla.huaman@unmsm.edu.pe'),
('20200102', 'Renato',  'Vasquez Leon',     'Facultad de Ciencias Economicas',    'renato.vasquez@unmsm.edu.pe'),
('20200233', 'Fiorella','Chuquipoma Rios',  'Facultad de Derecho y CC.PP',        'fiorella.chuquipoma@unmsm.edu.pe'),
('20210088', 'Diego',   'Ramos Castillo',   'Facultad de Ingenieria Industrial',  'diego.ramos@unmsm.edu.pe'),
('20210199', 'Ximena',  'Paredes Nunez',    'Facultad de Letras',                 'ximena.paredes@unmsm.edu.pe'),
('20220017', 'Bryan',   'Salazar Cotrina',  'Facultad de Quimica e Ing. Quimica', 'bryan.salazar@unmsm.edu.pe'),
('20220305', 'Melissa', 'Rivas Tapia',      'Facultad de Educacion',              'melissa.rivas@unmsm.edu.pe');

-- Atenciones dummy (mismos datos que la version MySQL)
INSERT INTO atenciones
    (estudiante_id, servicio_id, unidad_id, categoria_id, fecha_atencion, descripcion_motivo, accion_id, diagnostico_accion, usuario_responsable_id, estado_atencion, fecha_cierre) VALUES
(1, 1, 1,  1, '2026-04-10 09:15:00', 'Solicitud de subsidio alimentario',            1,  'Evaluado, cumple requisitos. Se otorga subsidio parcial.', 2, 'Cerrada',     '2026-04-12 10:00:00'),
(2, 2, 8,  11,'2026-04-11 10:30:00', 'Orientacion por dificultades economicas',      7,  'Derivado a programa de apoyo socioeconomico.',             1, 'Cerrada',     '2026-04-15 09:00:00'),
(3, 3, 6,  13,'2026-04-12 14:00:00', 'Consulta sobre postulacion a residencia',      11, 'Se entrego formulario y requisitos de postulacion.',       3, 'Cerrada',     '2026-04-12 15:00:00'),
(4, 1, 2,  3, '2026-05-02 08:45:00', 'Reclamo por calidad del servicio de comedor',  3,  'Registrado y derivado a control de calidad.',              4, 'Cerrada',     '2026-05-06 12:00:00'),
(5, 2, 8,  8, '2026-05-05 11:20:00', 'Solicitud de constancia socioeconomica',       6,  'Constancia emitida el mismo dia.',                         1, 'Cerrada',     '2026-05-05 16:00:00'),
(6, 3, 6,  15,'2026-05-06 16:10:00', 'Reporte de incidencia en habitacion',          12, 'Se coordino mantenimiento correctivo.',                    3, 'En atencion', NULL),
(7, 1, 1,  5, '2026-06-01 12:05:00', 'Actualizacion de datos para subsidio',         5,  'Datos actualizados en el sistema.',                        2, 'Cerrada',     '2026-06-02 09:00:00'),
(1, 2, 8,  10,'2026-06-03 09:40:00', 'Seguimiento de caso social',                   8,  'Segunda entrevista programada.',                           1, 'En atencion', NULL),
(8, 1, 1,  4, '2026-06-15 13:25:00', 'Consulta sobre horario de atencion',           4,  'Informacion brindada satisfactoriamente.',                 2, 'Cerrada',     '2026-06-15 14:00:00'),
(3, 1, 1,  2, '2026-07-10 08:00:00', 'Renovacion de subsidio alimentario',           1,  'Renovado por un trimestre adicional.',                     2, 'Cerrada',     '2026-07-11 10:00:00');

INSERT INTO atenciones_historial (atencion_id, estado_anterior, estado_nuevo, comentario, unidad_id, creado_en)
SELECT atencion_id, NULL, estado_atencion, 'Registro inicial (datos dummy)', unidad_id, creado_en FROM atenciones;

-- Preguntas de encuesta (Trimestre 2 = abril-junio 2026)
INSERT INTO preguntas_encuesta (servicio_id, trimestre_id, texto_pregunta, tipo_respuesta) VALUES
(1, 2, 'Como califica la calidad de los alimentos recibidos?', 'Likert_1_5'),
(1, 2, 'Como califica el tiempo de atencion en el comedor?', 'Likert_1_5'),
(1, 2, 'Comentarios adicionales sobre el servicio de alimentacion', 'Texto'),
(2, 2, 'Como califica la atencion recibida por el area de Servicio Social?', 'Likert_1_5'),
(2, 2, 'Comentarios adicionales sobre el Servicio Social', 'Texto'),
(3, 2, 'Como califica las condiciones de la residencia universitaria?', 'Likert_1_5'),
(3, 2, 'Comentarios adicionales sobre Residencias Universitarias', 'Texto');

-- Respuestas de encuesta asociadas a atenciones existentes
INSERT INTO respuestas_encuesta (pregunta_id, atencion_id, valor_respuesta) VALUES
(1, 1, '4'),
(2, 1, '5'),
(3, 1, 'Buen servicio, podria mejorar la variedad de menu.'),
(4, 2, '5'),
(5, 2, 'Excelente orientacion, resolvieron mi consulta rapido.'),
(6, 3, '3'),
(7, 3, 'Falta mantenimiento en algunas habitaciones.'),
(1, 4, '2'),
(3, 4, 'La comida llego fria en varias ocasiones.'),
(4, 5, '4'),
(6, 6, '3'),
(1, 7, '5'),
(4, 8, '4');

COMMIT;
