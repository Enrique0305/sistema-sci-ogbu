-- ============================================================================
-- Datos de PRUEBA (ficticios) para desarrollo/demo local -- NUNCA cargar
-- en un servidor accesible para la OGBU.
-- ============================================================================
-- A diferencia de schema_mysql.sql (que sí incluye catálogos reales de
-- referencia: servicios, unidades, categorías, acciones, trimestres,
-- preguntas de encuesta -- necesarios para que el sistema sea usable),
-- este archivo son 8 estudiantes y 10 atenciones INVENTADOS para pruebas.
--
-- No se monta en docker-entrypoint-initdb.d (a diferencia de
-- schema_mysql.sql), por lo tanto un despliegue en LAN/producción NO lo
-- carga automáticamente. Para usarlo en un entorno de desarrollo local:
--
--   mysql -u sci_ogbu_app -p sci_ogbu < database/seed_demo_dummy.sql
--   docker compose exec -T mysql sh -c \
--     'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" sci_ogbu' < database/seed_demo_dummy.sql
--
-- IMPORTANTE: si vas a correr "npm run sync:alumnos" (Oracle SUM) sobre la
-- misma base de datos, los códigos de estudiante ficticios de aquí abajo
-- (20190001, 20190045, ...) pueden coincidir por casualidad con matrículas
-- reales -- si eso pasa, la sincronización sobreescribirá el nombre
-- ficticio con el real, dejando estas atenciones de prueba pegadas a un
-- estudiante real. Revisa y limpia manualmente si corresponde.
-- ============================================================================

INSERT INTO estudiantes (codigo_estudiante, nombres, apellidos, facultad, correo_institucional) VALUES
('20190001', 'Luis',    'Garcia Mendoza',   'Facultad de Ingenieria de Sistemas', 'luis.garcia1@unmsm.edu.pe'),
('20190045', 'Carla',   'Huaman Soto',      'Facultad de Medicina',               'carla.huaman@unmsm.edu.pe'),
('20200102', 'Renato',  'Vasquez Leon',     'Facultad de Ciencias Economicas',    'renato.vasquez@unmsm.edu.pe'),
('20200233', 'Fiorella','Chuquipoma Rios',  'Facultad de Derecho y CC.PP',        'fiorella.chuquipoma@unmsm.edu.pe'),
('20210088', 'Diego',   'Ramos Castillo',   'Facultad de Ingenieria Industrial',  'diego.ramos@unmsm.edu.pe'),
('20210199', 'Ximena',  'Paredes Nunez',    'Facultad de Letras',                 'ximena.paredes@unmsm.edu.pe'),
('20220017', 'Bryan',   'Salazar Cotrina',  'Facultad de Quimica e Ing. Quimica', 'bryan.salazar@unmsm.edu.pe'),
('20220305', 'Melissa', 'Rivas Tapia',      'Facultad de Educacion',              'melissa.rivas@unmsm.edu.pe');

-- Atenciones dummy: (estudiante, servicio, unidad, categoria, motivo, accion cat, accion texto, usuario, estado, fecha)
INSERT INTO atenciones
    (estudiante_id, servicio_id, unidad_id, categoria_id, fecha_atencion, descripcion_motivo, accion_id, diagnostico_accion, usuario_responsable_id, estado_atencion, fecha_cierre) VALUES
(1, 1, 1,  1, '2026-04-10 09:15:00', 'Solicitud de subsidio alimentario',            1,  'Evaluado, cumple requisitos. Se otorga subsidio parcial.', 2, 'Cerrada',    '2026-04-12 10:00:00'),
(2, 2, 8,  11,'2026-04-11 10:30:00', 'Orientacion por dificultades economicas',      7,  'Derivado a programa de apoyo socioeconomico.',             1, 'Cerrada',    '2026-04-15 09:00:00'),
(3, 3, 6,  13,'2026-04-12 14:00:00', 'Consulta sobre postulacion a residencia',      11, 'Se entrego formulario y requisitos de postulacion.',       3, 'Cerrada',    '2026-04-12 15:00:00'),
(4, 1, 2,  3, '2026-05-02 08:45:00', 'Reclamo por calidad del servicio de comedor',  3,  'Registrado y derivado a control de calidad.',              4, 'Cerrada',    '2026-05-06 12:00:00'),
(5, 2, 8,  8, '2026-05-05 11:20:00', 'Solicitud de constancia socioeconomica',       6,  'Constancia emitida el mismo dia.',                         1, 'Cerrada',    '2026-05-05 16:00:00'),
(6, 3, 6,  15,'2026-05-06 16:10:00', 'Reporte de incidencia en habitacion',          12, 'Se coordino mantenimiento correctivo.',                    3, 'En atencion', NULL),
(7, 1, 1,  5, '2026-06-01 12:05:00', 'Actualizacion de datos para subsidio',         5,  'Datos actualizados en el sistema.',                        2, 'Cerrada',    '2026-06-02 09:00:00'),
(1, 2, 8,  10,'2026-06-03 09:40:00', 'Seguimiento de caso social',                   8,  'Segunda entrevista programada.',                           1, 'En atencion', NULL),
(8, 1, 1,  4, '2026-06-15 13:25:00', 'Consulta sobre horario de atencion',           4,  'Informacion brindada satisfactoriamente.',                 2, 'Cerrada',    '2026-06-15 14:00:00'),
(3, 1, 1,  2, '2026-07-10 08:00:00', 'Renovacion de subsidio alimentario',           1,  'Renovado por un trimestre adicional.',                     2, 'Cerrada',    '2026-07-11 10:00:00');

-- Asume que este script corre contra una base recien creada (solo el
-- esquema + catalogos de schema_mysql.sql, sin atenciones todavia); por
-- eso el historial se genera para TODAS las atenciones existentes.
INSERT INTO atenciones_historial (atencion_id, estado_anterior, estado_nuevo, comentario, unidad_id, creado_en)
SELECT atencion_id, NULL, estado_atencion, 'Registro inicial (datos dummy)', unidad_id, creado_en FROM atenciones;

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
