-- ============================================================================
-- Sistema Digital de Atenciones e Indicadores SCI - OGBU UNMSM
-- Motor: MySQL 8.0+ / MariaDB 10.5+
-- Contiene: DDL (tablas, PK, FK, indices, constraints) + datos DUMMY de prueba
--
-- Incluye el modelo de mesa de ayuda (unidades, categorias, ciclo de estados
-- con historial). Para bases ya desplegadas, ver database/migrations/.
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- 1. SERVICIOS_OGBU
--    es_sci = 1 -> servicio reportable al SCI (entra en ICA / ISE)
--    es_sci = 0 -> servicio interno (mesa de ayuda: TI, gestion)
-- ----------------------------------------------------------------------------
CREATE TABLE servicios_ogbu (
    servicio_id     INT AUTO_INCREMENT PRIMARY KEY,
    nombre_servicio VARCHAR(100) NOT NULL UNIQUE,
    descripcion     VARCHAR(255),
    estado          ENUM('Activo', 'Inactivo') NOT NULL DEFAULT 'Activo',
    es_sci          TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- 2. UNIDADES  (oficinas / unidades operativas de la OGBU)
-- ----------------------------------------------------------------------------
CREATE TABLE unidades (
    unidad_id   INT AUTO_INCREMENT PRIMARY KEY,
    nombre      VARCHAR(120) NOT NULL UNIQUE,
    servicio_id INT NULL,
    tipo        ENUM('Atencion', 'Soporte', 'Direccion') NOT NULL DEFAULT 'Atencion',
    estado      TINYINT(1) NOT NULL DEFAULT 1,
    creado_en   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_unidades_servicio FOREIGN KEY (servicio_id)
        REFERENCES servicios_ogbu (servicio_id) ON DELETE SET NULL,
    INDEX idx_unidades_servicio (servicio_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- 3. USUARIOS_RESPONSABLES  (operadores, pertenecen a una unidad)
-- ----------------------------------------------------------------------------
--    rol_sistema define los permisos en la aplicacion; password_hash NULL
--    significa "sin credenciales" (no puede iniciar sesion).
CREATE TABLE usuarios_responsables (
    usuario_id           INT AUTO_INCREMENT PRIMARY KEY,
    nombres              VARCHAR(100) NOT NULL,
    apellidos            VARCHAR(100) NOT NULL,
    correo_institucional VARCHAR(150) NOT NULL UNIQUE,
    password_hash        VARCHAR(255) NULL,
    rol                  VARCHAR(50)  NOT NULL DEFAULT 'Operador',
    rol_sistema          ENUM('Administrador', 'Operador', 'Consulta') NOT NULL DEFAULT 'Operador',
    unidad_id            INT NULL,
    cargo                VARCHAR(80) NULL,
    estado               TINYINT(1)   NOT NULL DEFAULT 1,
    creado_en            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    debe_cambiar_clave   TINYINT(1)   NOT NULL DEFAULT 0,
    intentos_fallidos    TINYINT UNSIGNED NOT NULL DEFAULT 0,
    bloqueado_hasta      DATETIME NULL,
    ultimo_acceso        DATETIME NULL,
    clave_actualizada_en DATETIME NULL,
    CONSTRAINT fk_usuarios_unidad FOREIGN KEY (unidad_id)
        REFERENCES unidades (unidad_id) ON DELETE SET NULL,
    INDEX idx_usuarios_rol_sistema (rol_sistema)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- 3b. SESIONES  (sesiones de login del lado del servidor)
--     Solo se guarda el hash SHA-256 del token; el token vive en una cookie
--     httpOnly. Eliminar la fila revoca la sesion al instante.
-- ----------------------------------------------------------------------------
CREATE TABLE sesiones (
    sesion_id   BIGINT AUTO_INCREMENT PRIMARY KEY,
    token_hash  CHAR(64) NOT NULL UNIQUE,
    usuario_id  INT NOT NULL,
    creado_en   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expira_en   DATETIME NOT NULL,
    ip          VARCHAR(45) NULL,
    user_agent  VARCHAR(255) NULL,
    CONSTRAINT fk_sesiones_usuario FOREIGN KEY (usuario_id)
        REFERENCES usuarios_responsables (usuario_id) ON DELETE CASCADE,
    INDEX idx_sesiones_usuario (usuario_id),
    INDEX idx_sesiones_expira (expira_en)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- 4. ESTUDIANTES
-- ----------------------------------------------------------------------------
CREATE TABLE estudiantes (
    estudiante_id         INT AUTO_INCREMENT PRIMARY KEY,
    codigo_estudiante     VARCHAR(20)  NOT NULL UNIQUE,
    nombres               VARCHAR(100) NOT NULL,
    apellidos             VARCHAR(100) NOT NULL,
    facultad              VARCHAR(150) NOT NULL,
    correo_institucional  VARCHAR(150) NOT NULL UNIQUE,
    estado                TINYINT(1)   NOT NULL DEFAULT 1,
    creado_en             TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_estudiante_correo CHECK (correo_institucional LIKE '%@%'),
    INDEX idx_estudiantes_facultad (facultad)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- 5. TRIMESTRES
-- ----------------------------------------------------------------------------
CREATE TABLE trimestres (
    trimestre_id      INT AUTO_INCREMENT PRIMARY KEY,
    anio              SMALLINT NOT NULL,
    periodo_trimestre TINYINT NOT NULL,
    fecha_inicio      DATE,
    fecha_fin         DATE,
    CONSTRAINT chk_periodo_trimestre CHECK (periodo_trimestre BETWEEN 1 AND 4),
    CONSTRAINT uq_trimestre_anio_periodo UNIQUE (anio, periodo_trimestre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- 6. CATEGORIAS_ATENCION  (catalogo de tipos de atencion, por servicio)
-- ----------------------------------------------------------------------------
CREATE TABLE categorias_atencion (
    categoria_id    INT AUTO_INCREMENT PRIMARY KEY,
    servicio_id     INT NOT NULL,
    nombre          VARCHAR(150) NOT NULL,
    descripcion     VARCHAR(400) NULL,
    suele_repetirse TINYINT(1) NOT NULL DEFAULT 0,
    activa          TINYINT(1) NOT NULL DEFAULT 1,
    orden           SMALLINT NOT NULL DEFAULT 0,
    creado_en       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_categorias_servicio FOREIGN KEY (servicio_id)
        REFERENCES servicios_ogbu (servicio_id) ON DELETE CASCADE,
    CONSTRAINT uq_categoria_servicio_nombre UNIQUE (servicio_id, nombre),
    INDEX idx_categorias_servicio (servicio_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- 7. CATALOGO_ACCIONES  (catalogo de acciones tomadas, por servicio)
-- ----------------------------------------------------------------------------
CREATE TABLE catalogo_acciones (
    accion_id   INT AUTO_INCREMENT PRIMARY KEY,
    servicio_id INT NOT NULL,
    nombre      VARCHAR(150) NOT NULL,
    descripcion VARCHAR(400) NULL,
    activa      TINYINT(1) NOT NULL DEFAULT 1,
    orden       SMALLINT NOT NULL DEFAULT 0,
    CONSTRAINT fk_acciones_servicio FOREIGN KEY (servicio_id)
        REFERENCES servicios_ogbu (servicio_id) ON DELETE CASCADE,
    CONSTRAINT uq_accion_servicio_nombre UNIQUE (servicio_id, nombre),
    INDEX idx_acciones_servicio (servicio_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- 7b. MOTIVOS_RECURRENTES  (atajos de "motivo" frecuentes; el campo del
--     formulario sigue siendo texto libre)
-- ----------------------------------------------------------------------------
CREATE TABLE motivos_recurrentes (
    motivo_id          INT AUTO_INCREMENT PRIMARY KEY,
    servicio_id        INT NOT NULL,
    categoria_id       INT NULL,
    texto              VARCHAR(300) NOT NULL,
    frecuencia_mensual SMALLINT UNSIGNED NULL,
    activo             TINYINT(1) NOT NULL DEFAULT 1,
    creado_en          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_motivos_servicio FOREIGN KEY (servicio_id)
        REFERENCES servicios_ogbu (servicio_id) ON DELETE CASCADE,
    CONSTRAINT fk_motivos_categoria FOREIGN KEY (categoria_id)
        REFERENCES categorias_atencion (categoria_id) ON DELETE SET NULL,
    CONSTRAINT uq_motivo_servicio_texto UNIQUE (servicio_id, texto),
    INDEX idx_motivos_categoria (categoria_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- 8. ATENCIONES
--    estudiante_id NULL  -> ticket interno (usar solicitante_desc)
--    Ciclo de estados: Registrada -> En atencion -> (Derivada) -> Resuelta
--                      -> Cerrada ; Reabierta desde Resuelta/Cerrada.
-- ----------------------------------------------------------------------------
CREATE TABLE atenciones (
    atencion_id            INT AUTO_INCREMENT PRIMARY KEY,
    estudiante_id          INT NULL,
    solicitante_desc       VARCHAR(200) NULL,
    servicio_id            INT NOT NULL,
    unidad_id              INT NOT NULL,
    categoria_id           INT NULL,
    fecha_atencion         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    descripcion_motivo     TEXT NOT NULL,
    diagnostico_accion     TEXT,
    accion_id              INT NULL,
    usuario_responsable_id INT NULL,
    estado_atencion        ENUM('Registrada', 'En atencion', 'Derivada', 'Resuelta', 'Cerrada', 'Reabierta')
                           NOT NULL DEFAULT 'Registrada',
    prioridad              ENUM('Baja', 'Media', 'Alta') NOT NULL DEFAULT 'Media',
    atencion_origen_id     INT NULL,
    unidad_derivada_id     INT NULL,
    fecha_resolucion       TIMESTAMP NULL,
    fecha_cierre           TIMESTAMP NULL,
    creado_en              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_atenciones_estudiante FOREIGN KEY (estudiante_id)
        REFERENCES estudiantes (estudiante_id) ON DELETE RESTRICT,
    CONSTRAINT fk_atenciones_servicio FOREIGN KEY (servicio_id)
        REFERENCES servicios_ogbu (servicio_id) ON DELETE RESTRICT,
    CONSTRAINT fk_atenciones_unidad FOREIGN KEY (unidad_id)
        REFERENCES unidades (unidad_id) ON DELETE RESTRICT,
    CONSTRAINT fk_atenciones_categoria FOREIGN KEY (categoria_id)
        REFERENCES categorias_atencion (categoria_id) ON DELETE SET NULL,
    CONSTRAINT fk_atenciones_accion FOREIGN KEY (accion_id)
        REFERENCES catalogo_acciones (accion_id) ON DELETE SET NULL,
    CONSTRAINT fk_atenciones_usuario FOREIGN KEY (usuario_responsable_id)
        REFERENCES usuarios_responsables (usuario_id) ON DELETE RESTRICT,
    CONSTRAINT fk_atenciones_origen FOREIGN KEY (atencion_origen_id)
        REFERENCES atenciones (atencion_id) ON DELETE SET NULL,
    CONSTRAINT fk_atenciones_unidad_derivada FOREIGN KEY (unidad_derivada_id)
        REFERENCES unidades (unidad_id) ON DELETE SET NULL,
    CONSTRAINT chk_atencion_solicitante
        CHECK (estudiante_id IS NOT NULL OR solicitante_desc IS NOT NULL),
    INDEX idx_atenciones_estudiante (estudiante_id),
    INDEX idx_atenciones_servicio (servicio_id),
    INDEX idx_atenciones_unidad (unidad_id),
    INDEX idx_atenciones_categoria (categoria_id),
    INDEX idx_atenciones_estado (estado_atencion),
    INDEX idx_atenciones_fecha (fecha_atencion),
    INDEX idx_atenciones_servicio_fecha (servicio_id, fecha_atencion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- 9. ATENCIONES_HISTORIAL  (trazabilidad del ciclo de estados)
-- ----------------------------------------------------------------------------
CREATE TABLE atenciones_historial (
    historial_id           INT AUTO_INCREMENT PRIMARY KEY,
    atencion_id            INT NOT NULL,
    estado_anterior        VARCHAR(20) NULL,
    estado_nuevo           VARCHAR(20) NOT NULL,
    comentario             VARCHAR(600) NULL,
    unidad_id              INT NULL,
    usuario_responsable_id INT NULL,
    creado_en              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_hist_atencion FOREIGN KEY (atencion_id)
        REFERENCES atenciones (atencion_id) ON DELETE CASCADE,
    CONSTRAINT fk_hist_unidad FOREIGN KEY (unidad_id)
        REFERENCES unidades (unidad_id) ON DELETE SET NULL,
    CONSTRAINT fk_hist_usuario FOREIGN KEY (usuario_responsable_id)
        REFERENCES usuarios_responsables (usuario_id) ON DELETE SET NULL,
    INDEX idx_hist_atencion (atencion_id, creado_en)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- 10. PREGUNTAS_ENCUESTA
-- ----------------------------------------------------------------------------
CREATE TABLE preguntas_encuesta (
    pregunta_id     INT AUTO_INCREMENT PRIMARY KEY,
    servicio_id     INT NOT NULL,
    trimestre_id    INT NOT NULL,
    texto_pregunta  VARCHAR(500) NOT NULL,
    tipo_respuesta  ENUM('Likert_1_5', 'Texto') NOT NULL,
    activa          TINYINT(1) NOT NULL DEFAULT 1,
    CONSTRAINT fk_preguntas_servicio FOREIGN KEY (servicio_id)
        REFERENCES servicios_ogbu (servicio_id) ON DELETE CASCADE,
    CONSTRAINT fk_preguntas_trimestre FOREIGN KEY (trimestre_id)
        REFERENCES trimestres (trimestre_id) ON DELETE CASCADE,
    INDEX idx_preguntas_servicio_trimestre (servicio_id, trimestre_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- 11. RESPUESTAS_ENCUESTA
-- ----------------------------------------------------------------------------
CREATE TABLE respuestas_encuesta (
    respuesta_id     INT AUTO_INCREMENT PRIMARY KEY,
    pregunta_id      INT NOT NULL,
    atencion_id      INT NULL,
    valor_respuesta  VARCHAR(500) NOT NULL,
    fecha_respuesta  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_respuestas_pregunta FOREIGN KEY (pregunta_id)
        REFERENCES preguntas_encuesta (pregunta_id) ON DELETE CASCADE,
    CONSTRAINT fk_respuestas_atencion FOREIGN KEY (atencion_id)
        REFERENCES atenciones (atencion_id) ON DELETE SET NULL,
    CONSTRAINT chk_valor_respuesta_no_vacio CHECK (TRIM(valor_respuesta) <> ''),
    INDEX idx_respuestas_pregunta (pregunta_id),
    INDEX idx_respuestas_atencion (atencion_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;

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
-- DATOS DE REFERENCIA (catalogos base para que el sistema sea usable desde
-- el primer arranque: servicios, unidades, catalogos de categorias/acciones,
-- trimestres y preguntas de encuesta). NO incluye estudiantes ni atenciones
-- ficticias -- eso vive aparte en database/seed_demo_dummy.sql, que NO se
-- carga automaticamente en un despliegue LAN/produccion (ver docker-compose.yml).
-- ============================================================================

INSERT INTO servicios_ogbu (nombre_servicio, descripcion, estado, es_sci) VALUES
('Alimentacion',              'Servicio de Comedor Universitario',                  'Activo', 1),
('Servicio Social',           'Atencion y orientacion social',                      'Activo', 1),
('Residencias Universitarias','Alojamiento estudiantil',                            'Activo', 1),
('Soporte TI',                'Soporte tecnico y sistemas (Unidad de Informatica)', 'Activo', 0),
('Gestion OGBU',              'Gestion y direccion de la OGBU',                     'Activo', 0);

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
(1, 'Solicitud de subsidio alimentario',      'Nueva solicitud de acceso al comedor', 0, 1),
(1, 'Renovación de subsidio alimentario',     'Continuidad del beneficio por otro periodo', 1, 2),
(1, 'Reclamo por calidad de alimentos',       'Queja sobre calidad, cantidad o temperatura', 1, 3),
(1, 'Consulta de requisitos o proceso',       NULL, 1, 4),
(1, 'Problema con el padrón / registro',      'El estudiante no figura o figura con datos errados', 1, 5),
(1, 'Otro / no tipificado',                   NULL, 0, 99),
(2, 'Evaluación socioeconómica',              NULL, 0, 1),
(2, 'Solicitud de constancia socioeconómica', NULL, 1, 2),
(2, 'Orientación / consejería',               NULL, 1, 3),
(2, 'Seguimiento de caso social',             'Continuidad de un caso ya abierto', 1, 4),
(2, 'Derivación a apoyo económico',           NULL, 0, 5),
(2, 'Otro / no tipificado',                   NULL, 0, 99),
(3, 'Postulación a residencia',               NULL, 0, 1),
(3, 'Renovación de residencia',               NULL, 1, 2),
(3, 'Reporte de incidencia en habitación',    'Desperfecto, daño o falla en la habitación', 1, 3),
(3, 'Solicitud de mantenimiento',             NULL, 1, 4),
(3, 'Convivencia / disciplina',               NULL, 1, 5),
(3, 'Otro / no tipificado',                   NULL, 0, 99),
(4, 'Falla de equipo / PC',                   NULL, 1, 1),
(4, 'Problema de red / internet',             NULL, 1, 2),
(4, 'Acceso a sistema / credenciales',        NULL, 1, 3),
(4, 'Instalación o configuración de software', NULL, 1, 4),
(4, 'Soporte al sistema SCI-OGBU',            NULL, 1, 5),
(4, 'Otro / no tipificado',                   NULL, 0, 99),
(5, 'Consulta administrativa',                NULL, 1, 1),
(5, 'Derivación entre oficinas',              NULL, 1, 2),
(5, 'Requerimiento de información',           NULL, 1, 3),
(5, 'Otro / no tipificado',                   NULL, 0, 99);

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

INSERT INTO preguntas_encuesta (servicio_id, trimestre_id, texto_pregunta, tipo_respuesta) VALUES
(1, 2, 'Como califica la calidad de los alimentos recibidos?', 'Likert_1_5'),
(1, 2, 'Como califica el tiempo de atencion en el comedor?', 'Likert_1_5'),
(1, 2, 'Comentarios adicionales sobre el servicio de alimentacion', 'Texto'),
(2, 2, 'Como califica la atencion recibida por el area de Servicio Social?', 'Likert_1_5'),
(2, 2, 'Comentarios adicionales sobre el Servicio Social', 'Texto'),
(3, 2, 'Como califica las condiciones de la residencia universitaria?', 'Likert_1_5'),
(3, 2, 'Comentarios adicionales sobre Residencias Universitarias', 'Texto');
