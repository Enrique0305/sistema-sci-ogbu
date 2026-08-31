-- ============================================================================
-- Migración 002 — Mesa de ayuda (help desk) OGBU
-- ============================================================================
-- Aplica SOBRE UNA BASE EXISTENTE (con estudiantes reales ya sincronizados).
-- Se ejecuta UNA sola vez. Para instalaciones limpias, esto ya está incluido
-- en database/schema_mysql.sql.
--
--   docker compose exec -T mysql sh -c \
--     'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" sci_ogbu' < database/migrations/002_helpdesk.sql
--
-- Cambios:
--   * servicios_ogbu: columna es_sci + servicios internos (Soporte TI, Gestión OGBU)
--   * tabla unidades (10 oficinas/unidades de la OGBU)
--   * tablas categorias_atencion y catalogo_acciones (catálogos, semilla inicial)
--   * usuarios_responsables: unidad_id + cargo, un operador placeholder por unidad
--   * atenciones: unidad/categoría/acción/prioridad/derivación/fechas de cierre,
--     estudiante_id nullable (tickets internos), nuevo ciclo de estados
--   * tabla atenciones_historial (trazabilidad de cambios de estado)
--   * vista v_reincidencias
-- ============================================================================

SET NAMES utf8mb4;

-- ----------------------------------------------------------------------------
-- 1. servicios_ogbu — marca SCI vs interno + servicios internos
-- ----------------------------------------------------------------------------
ALTER TABLE servicios_ogbu
  ADD COLUMN es_sci TINYINT(1) NOT NULL DEFAULT 1 AFTER estado;

-- 1 = servicio reportable al SCI (entra en ICA/ISE); 0 = interno (mesa de ayuda)
UPDATE servicios_ogbu SET es_sci = 1;

INSERT INTO servicios_ogbu (nombre_servicio, descripcion, estado, es_sci) VALUES
  ('Soporte TI',   'Soporte técnico y sistemas (Unidad de Informática)', 'Activo', 0),
  ('Gestión OGBU', 'Gestión y dirección de la OGBU',                     'Activo', 0)
ON DUPLICATE KEY UPDATE descripcion = VALUES(descripcion);

SET @svc_alim := (SELECT servicio_id FROM servicios_ogbu WHERE nombre_servicio = 'Alimentacion');
SET @svc_ss   := (SELECT servicio_id FROM servicios_ogbu WHERE nombre_servicio = 'Servicio Social');
SET @svc_res  := (SELECT servicio_id FROM servicios_ogbu WHERE nombre_servicio = 'Residencias Universitarias');
SET @svc_ti   := (SELECT servicio_id FROM servicios_ogbu WHERE nombre_servicio = 'Soporte TI');
SET @svc_ges  := (SELECT servicio_id FROM servicios_ogbu WHERE nombre_servicio = 'Gestión OGBU');

-- ----------------------------------------------------------------------------
-- 2. unidades — oficinas/unidades de la OGBU
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS unidades (
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

INSERT INTO unidades (nombre, servicio_id, tipo) VALUES
    ('Oficina de Alimentación',            @svc_alim, 'Atencion'),
    ('Comedor de CU',                      @svc_alim, 'Atencion'),
    ('Comedor de Cangallo',                @svc_alim, 'Atencion'),
    ('Comedor de Veterinaria',             @svc_alim, 'Atencion'),
    ('Comedor de San Juan de Lurigancho',  @svc_alim, 'Atencion'),
    ('Residencia de Ciudad',               @svc_res,  'Atencion'),
    ('Residencia de Tello',                @svc_res,  'Atencion'),
    ('Oficina de Servicio Social',         @svc_ss,   'Atencion'),
    ('Unidad de Informática',              @svc_ti,   'Soporte'),
    ('Jefatura de OGBU',                   @svc_ges,  'Direccion');

-- ----------------------------------------------------------------------------
-- 3. categorias_atencion — catálogo de tipos de atención
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categorias_atencion (
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

INSERT INTO categorias_atencion (servicio_id, nombre, descripcion, suele_repetirse, orden) VALUES
    (@svc_alim, 'Solicitud de subsidio alimentario',      'Nueva solicitud de acceso al comedor', 0, 1),
    (@svc_alim, 'Renovación de subsidio alimentario',     'Continuidad del beneficio por otro periodo', 1, 2),
    (@svc_alim, 'Reclamo por calidad de alimentos',       'Queja sobre calidad, cantidad o temperatura', 1, 3),
    (@svc_alim, 'Consulta de requisitos o proceso',       NULL, 1, 4),
    (@svc_alim, 'Problema con el padrón / registro',      'El estudiante no figura o figura con datos errados', 1, 5),
    (@svc_alim, 'Otro / no tipificado',                   NULL, 0, 99),
    (@svc_ss,   'Evaluación socioeconómica',              NULL, 0, 1),
    (@svc_ss,   'Solicitud de constancia socioeconómica', NULL, 1, 2),
    (@svc_ss,   'Orientación / consejería',               NULL, 1, 3),
    (@svc_ss,   'Seguimiento de caso social',             'Continuidad de un caso ya abierto', 1, 4),
    (@svc_ss,   'Derivación a apoyo económico',           NULL, 0, 5),
    (@svc_ss,   'Otro / no tipificado',                   NULL, 0, 99),
    (@svc_res,  'Postulación a residencia',               NULL, 0, 1),
    (@svc_res,  'Renovación de residencia',               NULL, 1, 2),
    (@svc_res,  'Reporte de incidencia en habitación',    'Desperfecto, daño o falla en la habitación', 1, 3),
    (@svc_res,  'Solicitud de mantenimiento',             NULL, 1, 4),
    (@svc_res,  'Convivencia / disciplina',               NULL, 1, 5),
    (@svc_res,  'Otro / no tipificado',                   NULL, 0, 99),
    (@svc_ti,   'Falla de equipo / PC',                   NULL, 1, 1),
    (@svc_ti,   'Problema de red / internet',             NULL, 1, 2),
    (@svc_ti,   'Acceso a sistema / credenciales',        NULL, 1, 3),
    (@svc_ti,   'Instalación o configuración de software', NULL, 1, 4),
    (@svc_ti,   'Soporte al sistema SCI-OGBU',            NULL, 1, 5),
    (@svc_ti,   'Otro / no tipificado',                   NULL, 0, 99),
    (@svc_ges,  'Consulta administrativa',                NULL, 1, 1),
    (@svc_ges,  'Derivación entre oficinas',              NULL, 1, 2),
    (@svc_ges,  'Requerimiento de información',           NULL, 1, 3),
    (@svc_ges,  'Otro / no tipificado',                   NULL, 0, 99);

-- ----------------------------------------------------------------------------
-- 4. catalogo_acciones — catálogo de acciones tomadas
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS catalogo_acciones (
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

INSERT INTO catalogo_acciones (servicio_id, nombre, orden) VALUES
    (@svc_alim, 'Subsidio otorgado', 1),
    (@svc_alim, 'Subsidio denegado', 2),
    (@svc_alim, 'Derivado a control de calidad', 3),
    (@svc_alim, 'Información brindada', 4),
    (@svc_alim, 'Datos actualizados en el sistema', 5),
    (@svc_ss,   'Constancia emitida', 1),
    (@svc_ss,   'Caso derivado a apoyo socioeconómico', 2),
    (@svc_ss,   'Entrevista programada', 3),
    (@svc_ss,   'Orientación brindada', 4),
    (@svc_ss,   'Informe social elaborado', 5),
    (@svc_res,  'Formulario y requisitos entregados', 1),
    (@svc_res,  'Mantenimiento coordinado', 2),
    (@svc_res,  'Cupo asignado', 3),
    (@svc_res,  'Amonestación registrada', 4),
    (@svc_res,  'Solicitud en evaluación', 5),
    (@svc_ti,   'Equipo reparado', 1),
    (@svc_ti,   'Configuración aplicada', 2),
    (@svc_ti,   'Credenciales restablecidas', 3),
    (@svc_ti,   'Software instalado', 4),
    (@svc_ti,   'Derivado a proveedor externo', 5),
    (@svc_ges,  'Derivado a la oficina competente', 1),
    (@svc_ges,  'Información remitida', 2),
    (@svc_ges,  'Trámite resuelto', 3);

-- ----------------------------------------------------------------------------
-- 5. usuarios_responsables — vínculo con unidad + operador placeholder
-- ----------------------------------------------------------------------------
ALTER TABLE usuarios_responsables
    ADD COLUMN unidad_id INT NULL AFTER rol,
    ADD COLUMN cargo VARCHAR(80) NULL AFTER unidad_id,
    ADD CONSTRAINT fk_usuarios_unidad FOREIGN KEY (unidad_id)
        REFERENCES unidades (unidad_id) ON DELETE SET NULL;

-- Un operador genérico por unidad para que el formulario sea usable de
-- inmediato. Las personas reales entran luego por npm run import:catalogo
-- (formato Excel de las oficinas); estos placeholders se pueden desactivar.
INSERT INTO usuarios_responsables (nombres, apellidos, correo_institucional, rol, unidad_id, cargo)
SELECT 'Responsable', u.nombre,
       CONCAT('responsable.unidad', u.unidad_id, '@unmsm.edu.pe'),
       'Operador', u.unidad_id, 'Responsable de unidad (placeholder)'
FROM unidades u;

-- ----------------------------------------------------------------------------
-- 6. atenciones — mesa de ayuda: unidad, categoría, acción, ciclo de estados
-- ----------------------------------------------------------------------------
ALTER TABLE atenciones
    MODIFY COLUMN estudiante_id INT NULL,
    MODIFY COLUMN usuario_responsable_id INT NULL;

ALTER TABLE atenciones
    ADD COLUMN unidad_id          INT NULL              AFTER servicio_id,
    ADD COLUMN categoria_id       INT NULL              AFTER unidad_id,
    ADD COLUMN solicitante_desc   VARCHAR(200) NULL     AFTER estudiante_id,
    ADD COLUMN accion_id          INT NULL              AFTER diagnostico_accion,
    ADD COLUMN prioridad          ENUM('Baja', 'Media', 'Alta') NOT NULL DEFAULT 'Media' AFTER estado_atencion,
    ADD COLUMN atencion_origen_id INT NULL              AFTER prioridad,
    ADD COLUMN unidad_derivada_id INT NULL              AFTER atencion_origen_id,
    ADD COLUMN fecha_resolucion   TIMESTAMP NULL        AFTER unidad_derivada_id,
    ADD COLUMN fecha_cierre       TIMESTAMP NULL        AFTER fecha_resolucion;

-- Nuevo ciclo de estados: primero se amplía el ENUM (viejos + nuevos),
-- se migran los datos y luego se reduce al conjunto final.
ALTER TABLE atenciones MODIFY COLUMN estado_atencion
    ENUM('En Proceso', 'Completado',
         'Registrada', 'En atencion', 'Derivada', 'Resuelta', 'Cerrada', 'Reabierta')
    NOT NULL DEFAULT 'Registrada';

UPDATE atenciones SET estado_atencion = 'En atencion' WHERE estado_atencion = 'En Proceso';
UPDATE atenciones SET estado_atencion = 'Cerrada', fecha_cierre = fecha_atencion WHERE estado_atencion = 'Completado';

ALTER TABLE atenciones MODIFY COLUMN estado_atencion
    ENUM('Registrada', 'En atencion', 'Derivada', 'Resuelta', 'Cerrada', 'Reabierta')
    NOT NULL DEFAULT 'Registrada';

-- Backfill de unidad_id según el servicio de la atención existente
SET @u_alim := (SELECT unidad_id FROM unidades WHERE nombre = 'Oficina de Alimentación');
SET @u_ss   := (SELECT unidad_id FROM unidades WHERE nombre = 'Oficina de Servicio Social');
SET @u_res  := (SELECT unidad_id FROM unidades WHERE nombre = 'Residencia de Ciudad');
SET @u_jef  := (SELECT unidad_id FROM unidades WHERE nombre = 'Jefatura de OGBU');

UPDATE atenciones a
    JOIN servicios_ogbu s ON s.servicio_id = a.servicio_id
   SET a.unidad_id = CASE s.nombre_servicio
       WHEN 'Alimentacion'               THEN @u_alim
       WHEN 'Servicio Social'            THEN @u_ss
       WHEN 'Residencias Universitarias' THEN @u_res
       ELSE @u_jef
   END
 WHERE a.unidad_id IS NULL;

ALTER TABLE atenciones
    MODIFY COLUMN unidad_id INT NOT NULL,
    ADD CONSTRAINT fk_atenciones_unidad FOREIGN KEY (unidad_id)
        REFERENCES unidades (unidad_id) ON DELETE RESTRICT,
    ADD CONSTRAINT fk_atenciones_categoria FOREIGN KEY (categoria_id)
        REFERENCES categorias_atencion (categoria_id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_atenciones_accion FOREIGN KEY (accion_id)
        REFERENCES catalogo_acciones (accion_id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_atenciones_origen FOREIGN KEY (atencion_origen_id)
        REFERENCES atenciones (atencion_id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_atenciones_unidad_derivada FOREIGN KEY (unidad_derivada_id)
        REFERENCES unidades (unidad_id) ON DELETE SET NULL,
    ADD CONSTRAINT chk_atencion_solicitante
        CHECK (estudiante_id IS NOT NULL OR solicitante_desc IS NOT NULL),
    ADD INDEX idx_atenciones_unidad (unidad_id),
    ADD INDEX idx_atenciones_categoria (categoria_id),
    ADD INDEX idx_atenciones_estado (estado_atencion);

-- ----------------------------------------------------------------------------
-- 7. atenciones_historial — trazabilidad del ciclo de estados
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atenciones_historial (
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

-- Fila inicial de historial para las atenciones ya existentes
INSERT INTO atenciones_historial (atencion_id, estado_anterior, estado_nuevo, comentario, unidad_id, creado_en)
SELECT atencion_id, NULL, estado_atencion, 'Registro migrado a mesa de ayuda', unidad_id, creado_en
FROM atenciones;

-- ----------------------------------------------------------------------------
-- 8. v_reincidencias — estudiante + categoría con más de una atención
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
