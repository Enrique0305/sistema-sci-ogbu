const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

// Determina si corresponde disparar la encuesta de satisfaccion tras una
// atencion: existe un trimestre vigente y ese servicio tiene preguntas
// activas configuradas para dicho trimestre.
async function evaluarTriggerEncuesta(servicioId) {
  const { rows: trimestreRows } = await query(
    `SELECT trimestre_id, anio, periodo_trimestre
       FROM trimestres
      WHERE CURRENT_DATE BETWEEN fecha_inicio AND fecha_fin
      LIMIT 1`
  );

  if (trimestreRows.length === 0) {
    return { trigger_encuesta: false, trimestre: null, preguntas: [] };
  }

  const trimestre = trimestreRows[0];

  const { rows: preguntas } = await query(
    `SELECT pregunta_id, texto_pregunta, tipo_respuesta
       FROM preguntas_encuesta
      WHERE servicio_id = ? AND trimestre_id = ? AND activa = TRUE
      ORDER BY pregunta_id`,
    [servicioId, trimestre.trimestre_id]
  );

  return {
    trigger_encuesta: preguntas.length > 0,
    trimestre,
    preguntas,
  };
}

// POST /api/atenciones
// Registra una nueva atencion. El codigo de estudiante y el servicio se
// resuelven a sus IDs internos y se validan antes de insertar; la fecha
// de atencion se asigna automaticamente en el servidor (no se acepta del
// cliente) para preservar la integridad del registro para el SCI.
const crearAtencion = asyncHandler(async (req, res) => {
  const { codigo_estudiante, servicio_id, descripcion_motivo, diagnostico_accion, usuario_responsable_id } = req.body;

  const { rows: estudianteRows } = await query(
    `SELECT estudiante_id, estado FROM estudiantes WHERE codigo_estudiante = ?`,
    [codigo_estudiante]
  );
  if (estudianteRows.length === 0) {
    return res.status(404).json({ ok: false, error: 'El codigo de estudiante no existe' });
  }
  if (!estudianteRows[0].estado) {
    return res.status(409).json({ ok: false, error: 'El estudiante se encuentra inactivo' });
  }
  const estudianteId = estudianteRows[0].estudiante_id;

  const { rows: servicioRows } = await query(
    `SELECT servicio_id, estado FROM servicios_ogbu WHERE servicio_id = ?`,
    [servicio_id]
  );
  if (servicioRows.length === 0) {
    return res.status(404).json({ ok: false, error: 'El servicio indicado no existe' });
  }
  if (servicioRows[0].estado !== 'Activo') {
    return res.status(409).json({ ok: false, error: 'El servicio indicado no esta activo' });
  }

  const { rows: usuarioRows } = await query(
    `SELECT usuario_id FROM usuarios_responsables WHERE usuario_id = ? AND estado = TRUE`,
    [usuario_responsable_id]
  );
  if (usuarioRows.length === 0) {
    return res.status(404).json({ ok: false, error: 'El usuario responsable no existe o esta inactivo' });
  }

  const insertResult = await query(
    `INSERT INTO atenciones
        (estudiante_id, servicio_id, descripcion_motivo, diagnostico_accion, usuario_responsable_id, estado_atencion)
     VALUES (?, ?, ?, ?, ?, 'En Proceso')`,
    [estudianteId, servicio_id, descripcion_motivo, diagnostico_accion || null, usuario_responsable_id]
  );

  const { rows: nuevaAtencionRows } = await query(
    `SELECT atencion_id, fecha_atencion, estado_atencion FROM atenciones WHERE atencion_id = ?`,
    [insertResult.rows.insertId]
  );
  const nuevaAtencion = nuevaAtencionRows[0];
  const { trigger_encuesta, trimestre, preguntas } = await evaluarTriggerEncuesta(servicio_id);

  res.status(201).json({
    ok: true,
    atencion_id: nuevaAtencion.atencion_id,
    fecha_atencion: nuevaAtencion.fecha_atencion,
    estado_atencion: nuevaAtencion.estado_atencion,
    trigger_encuesta,
    trimestre_id: trimestre ? trimestre.trimestre_id : null,
    preguntas_encuesta: trigger_encuesta ? preguntas : [],
  });
});

// GET /api/atenciones
// Lista atenciones recientes con filtros opcionales de fecha y servicio,
// usada por la tabla del dashboard. Todos los filtros son parametrizados.
const listarAtenciones = asyncHandler(async (req, res) => {
  const { fecha_inicio, fecha_fin, servicio_id, estado_atencion, limite = 50, pagina = 1 } = req.query;

  const condiciones = [];
  const valores = [];

  if (fecha_inicio) {
    condiciones.push(`a.fecha_atencion >= ?`);
    valores.push(fecha_inicio);
  }
  if (fecha_fin) {
    condiciones.push(`a.fecha_atencion <= ?`);
    valores.push(`${fecha_fin} 23:59:59`);
  }
  if (servicio_id) {
    condiciones.push(`a.servicio_id = ?`);
    valores.push(servicio_id);
  }
  if (estado_atencion) {
    condiciones.push(`a.estado_atencion = ?`);
    valores.push(estado_atencion);
  }

  const whereClause = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';
  const limiteNum = Math.min(Number(limite) || 50, 200);
  const offset = (Math.max(Number(pagina) || 1, 1) - 1) * limiteNum;

  const sql = `
    SELECT a.atencion_id, a.fecha_atencion, a.descripcion_motivo, a.diagnostico_accion, a.estado_atencion,
           e.codigo_estudiante, e.nombres AS estudiante_nombres, e.apellidos AS estudiante_apellidos,
           s.servicio_id, s.nombre_servicio,
           u.nombres AS responsable_nombres, u.apellidos AS responsable_apellidos
      FROM atenciones a
      JOIN estudiantes e ON e.estudiante_id = a.estudiante_id
      JOIN servicios_ogbu s ON s.servicio_id = a.servicio_id
      JOIN usuarios_responsables u ON u.usuario_id = a.usuario_responsable_id
      ${whereClause}
     ORDER BY a.fecha_atencion DESC
     LIMIT ? OFFSET ?`;
  valores.push(limiteNum, offset);

  const { rows } = await query(sql, valores);
  res.json({ ok: true, total_retornado: rows.length, atenciones: rows });
});

module.exports = { crearAtencion, listarAtenciones };
