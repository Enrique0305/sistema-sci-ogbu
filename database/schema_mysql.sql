-- ============================================================================
-- Sistema Digital de Atenciones e Indicadores SCI - OGBU UNMSM
-- Motor: MySQL 8.0+ / MariaDB 10.5+
-- Contiene: DDL (tablas, PK, FK, indices, constraints) + datos DUMMY de prueba
-- Diferencias clave frente a la version PostgreSQL:
--   * AUTO_INCREMENT en lugar de SERIAL
--   * ENGINE=InnoDB + utf8mb4 explicitos
--   * CHECK constraints soportados desde MySQL 8.0.16 (se mantienen igual)
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- 1. USUARIOS_RESPONSABLES
-- ----------------------------------------------------------------------------
CREATE TABLE usuarios_responsables (
    usuario_id           INT AUTO_INCREMENT PRIMARY KEY,
    nombres              VARCHAR(100) NOT NULL,
    apellidos            VARCHAR(100) NOT NULL,
    correo_institucional VARCHAR(150) NOT NULL UNIQUE,
    rol                  VARCHAR(50)  NOT NULL DEFAULT 'Operador',
    estado               TINYINT(1)   NOT NULL DEFAULT 1,
    creado_en            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- 2. ESTUDIANTES
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
-- 3. SERVICIOS_OGBU
-- ----------------------------------------------------------------------------
CREATE TABLE servicios_ogbu (
    servicio_id     INT AUTO_INCREMENT PRIMARY KEY,
    nombre_servicio VARCHAR(100) NOT NULL UNIQUE,
    descripcion     VARCHAR(255),
    estado          ENUM('Activo', 'Inactivo') NOT NULL DEFAULT 'Activo'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- 4. TRIMESTRES
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
-- 5. ATENCIONES
-- ----------------------------------------------------------------------------
CREATE TABLE atenciones (
    atencion_id            INT AUTO_INCREMENT PRIMARY KEY,
    estudiante_id           INT NOT NULL,
    servicio_id             INT NOT NULL,
    fecha_atencion           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    descripcion_motivo       TEXT NOT NULL,
    diagnostico_accion       TEXT,
    usuario_responsable_id   INT NOT NULL,
    estado_atencion          ENUM('En Proceso', 'Completado') NOT NULL DEFAULT 'En Proceso',
    creado_en                TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_atenciones_estudiante FOREIGN KEY (estudiante_id)
        REFERENCES estudiantes (estudiante_id) ON DELETE RESTRICT,
    CONSTRAINT fk_atenciones_servicio FOREIGN KEY (servicio_id)
        REFERENCES servicios_ogbu (servicio_id) ON DELETE RESTRICT,
    CONSTRAINT fk_atenciones_usuario FOREIGN KEY (usuario_responsable_id)
        REFERENCES usuarios_responsables (usuario_id) ON DELETE RESTRICT,
    INDEX idx_atenciones_estudiante (estudiante_id),
    INDEX idx_atenciones_servicio (servicio_id),
    INDEX idx_atenciones_fecha (fecha_atencion),
    INDEX idx_atenciones_servicio_fecha (servicio_id, fecha_atencion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- 6. PREGUNTAS_ENCUESTA
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
-- 7. RESPUESTAS_ENCUESTA
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

-- ============================================================================
-- DATOS DUMMY DE PRUEBA
-- ============================================================================

INSERT INTO usuarios_responsables (nombres, apellidos, correo_institucional, rol) VALUES
('Maria', 'Quispe Rojas',   'mquispe@unmsm.edu.pe', 'Trabajador Social'),
('Jose',  'Torres Vidal',   'jtorres@unmsm.edu.pe', 'Nutricionista'),
('Ana',   'Fernandez Diaz', 'afernandez@unmsm.edu.pe', 'Administrador');

INSERT INTO servicios_ogbu (nombre_servicio, descripcion, estado) VALUES
('Alimentacion',              'Servicio de Comedor Universitario', 'Activo'),
('Servicio Social',           'Atencion y orientacion social',     'Activo'),
('Residencias Universitarias','Alojamiento estudiantil',           'Activo');

INSERT INTO trimestres (anio, periodo_trimestre, fecha_inicio, fecha_fin) VALUES
(2026, 1, '2026-01-01', '2026-03-31'),
(2026, 2, '2026-04-01', '2026-06-30'),
(2026, 3, '2026-07-01', '2026-09-30');

INSERT INTO estudiantes (codigo_estudiante, nombres, apellidos, facultad, correo_institucional) VALUES
('20190001', 'Luis',    'Garcia Mendoza',   'Facultad de Ingenieria de Sistemas', 'luis.garcia1@unmsm.edu.pe'),
('20190045', 'Carla',   'Huaman Soto',      'Facultad de Medicina',               'carla.huaman@unmsm.edu.pe'),
('20200102', 'Renato',  'Vasquez Leon',     'Facultad de Ciencias Economicas',    'renato.vasquez@unmsm.edu.pe'),
('20200233', 'Fiorella','Chuquipoma Rios',  'Facultad de Derecho y CC.PP',        'fiorella.chuquipoma@unmsm.edu.pe'),
('20210088', 'Diego',   'Ramos Castillo',   'Facultad de Ingenieria Industrial',  'diego.ramos@unmsm.edu.pe'),
('20210199', 'Ximena',  'Paredes Nunez',    'Facultad de Letras',                 'ximena.paredes@unmsm.edu.pe'),
('20220017', 'Bryan',   'Salazar Cotrina',  'Facultad de Quimica e Ing. Quimica', 'bryan.salazar@unmsm.edu.pe'),
('20220305', 'Melissa', 'Rivas Tapia',      'Facultad de Educacion',              'melissa.rivas@unmsm.edu.pe');

INSERT INTO atenciones (estudiante_id, servicio_id, fecha_atencion, descripcion_motivo, diagnostico_accion, usuario_responsable_id, estado_atencion) VALUES
(1, 1, '2026-04-10 09:15:00', 'Solicitud de subsidio alimentario', 'Evaluado, cumple requisitos. Se otorga subsidio parcial.', 1, 'Completado'),
(2, 2, '2026-04-11 10:30:00', 'Orientacion por dificultades economicas', 'Derivado a programa de apoyo socioeconomico.', 3, 'Completado'),
(3, 3, '2026-04-12 14:00:00', 'Consulta sobre postulacion a residencia', 'Se entrego formulario y requisitos de postulacion.', 3, 'Completado'),
(4, 1, '2026-05-02 08:45:00', 'Reclamo por calidad del servicio de comedor', 'Registrado y derivado a control de calidad.', 2, 'Completado'),
(5, 2, '2026-05-05 11:20:00', 'Solicitud de constancia socioeconomica', 'Constancia emitida el mismo dia.', 3, 'Completado'),
(6, 3, '2026-05-06 16:10:00', 'Reporte de incidencia en habitacion', 'Se coordino mantenimiento correctivo.', 1, 'En Proceso'),
(7, 1, '2026-06-01 12:05:00', 'Actualizacion de datos para subsidio', 'Datos actualizados en el sistema.', 2, 'Completado'),
(1, 2, '2026-06-03 09:40:00', 'Seguimiento de caso social', 'Segunda entrevista programada.', 3, 'En Proceso'),
(8, 1, '2026-06-15 13:25:00', 'Consulta sobre horario de atencion', 'Informacion brindada satisfactoriamente.', 2, 'Completado'),
(3, 1, '2026-07-10 08:00:00', 'Renovacion de subsidio alimentario', 'Renovado por un trimestre adicional.', 1, 'Completado');

INSERT INTO preguntas_encuesta (servicio_id, trimestre_id, texto_pregunta, tipo_respuesta) VALUES
(1, 2, 'Como califica la calidad de los alimentos recibidos?', 'Likert_1_5'),
(1, 2, 'Como califica el tiempo de atencion en el comedor?', 'Likert_1_5'),
(1, 2, 'Comentarios adicionales sobre el servicio de alimentacion', 'Texto'),
(2, 2, 'Como califica la atencion recibida por el area de Servicio Social?', 'Likert_1_5'),
(2, 2, 'Comentarios adicionales sobre el Servicio Social', 'Texto'),
(3, 2, 'Como califica las condiciones de la residencia universitaria?', 'Likert_1_5'),
(3, 2, 'Comentarios adicionales sobre Residencias Universitarias', 'Texto');

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
