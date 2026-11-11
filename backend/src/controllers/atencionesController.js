const { query, getClient } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { asegurarTrimestre } = require('../utils/trimestres');
const {
  TRANSICIONES,
  ESTADOS_ABIERTOS,
  transicionValida,
  efectosFecha,
} = require('../utils/estadoAtencion');

// Determina si corresponde disparar la encuesta de satisfaccion tras una
// atencion: existe un trimestre vigente y ese servicio tiene preguntas
// activas configuradas para dicho trimestre. Los trimestres se crean solos (y
// heredan las preguntas del anterior); un fallo ahi nunca debe impedir que la
// atencion ya registrada se confirme, solo se omite la encuesta.
async function evaluarTriggerEncuesta(servicioId) {
  try {
    await asegurarTrimestre();
  } catch (err) {
    console.error('[trimestres] No se pudo asegurar el trimestre vigente:', err.message);
  }

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

// Busca atenciones previas del mismo estudiante en la misma categoria para
// detectar reincidencia (una atencion recurrente que ya fue vista antes).
async function detectarReincidencia(estudianteId, categoriaId) {
  if (!estudianteId || !categoriaId) {
    return { es_reincidente: false, total_previas: 0, atencion_origen_id: null };
  }
  const { rows } = await query(
    `SELECT atencion_id, fecha_atencion
       FROM atenciones
      WHERE estudiante_id = ? AND categoria_id = ?
      ORDER BY fecha_atencion DESC`,
    [estudianteId, categoriaId]
  );
  return {
    es_reincidente: rows.length > 0,
    total_previas: rows.length,
    atencion_origen_id: rows.length > 0 ? rows[0].atencion_id : null,
  };
}

// POST /api/atenciones
// Registra una nueva atencion (ticket de la mesa de ayuda). Puede ser una
// atencion a un estudiante (codigo_estudiante) o un ticket interno
// (solicitante_desc, sin estudiante). Resuelve y valida unidad, categoria y
// accion; asigna la fecha en el servidor; detecta reincidencia; deja el
// primer registro en atenciones_historial; y evalua el trigger de encuesta.
const crearAtencion = asyncHandler(async (req, res) => {
  const {
    codigo_estudiante,
    solicitante_desc,
    servicio_id,
    unidad_id,
    categoria_id,
    descripcion_motivo,
    diagnostico_accion,
    accion_id,
    usuario_responsable_id: usuarioIndicado,
    prioridad,
  } = req.body;

  // El responsable sale de la sesion: un Operador no puede registrar a nombre
  // de otra persona. Un Administrador puede asignar la atencion a un operador.
  const usuario_responsable_id =
    req.user.rol_sistema === 'Administrador' && usuarioIndicado
      ? usuarioIndicado
      : req.user.usuario_id;

  // --- Servicio ---
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

  // --- Unidad (debe existir, estar activa y pertenecer al servicio) ---
  const { rows: unidadRows } = await query(
    `SELECT unidad_id, servicio_id, estado FROM unidades WHERE unidad_id = ?`,
    [unidad_id]
  );
  if (unidadRows.length === 0) {
    return res.status(404).json({ ok: false, error: 'La unidad indicada no existe' });
  }
  if (!unidadRows[0].estado) {
    return res.status(409).json({ ok: false, error: 'La unidad indicada esta inactiva' });
  }
  if (unidadRows[0].servicio_id != null && unidadRows[0].servicio_id !== servicio_id) {
    return res
      .status(409)
      .json({ ok: false, error: 'La unidad no corresponde al servicio seleccionado' });
  }

  // --- Estudiante o solicitante interno ---
  let estudianteId = null;
  if (codigo_estudiante) {
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
    estudianteId = estudianteRows[0].estudiante_id;
  } else if (!solicitante_desc) {
    return res.status(400).json({
      ok: false,
      error: 'Indique un codigo de estudiante o una descripcion del solicitante (ticket interno)',
    });
  }

  // --- Categoria (opcional, debe pertenecer al servicio) ---
  if (categoria_id) {
    const { rows } = await query(
      `SELECT categoria_id FROM categorias_atencion WHERE categoria_id = ? AND servicio_id = ? AND activa = TRUE`,
      [categoria_id, servicio_id]
    );
    if (rows.length === 0) {
      return res
        .status(409)
        .json({ ok: false, error: 'La categoria no existe o no corresponde al servicio' });
    }
  }

  // --- Accion tomada (opcional, debe pertenecer al servicio) ---
  if (accion_id) {
    const { rows } = await query(
      `SELECT accion_id FROM catalogo_acciones WHERE accion_id = ? AND servicio_id = ? AND activa = TRUE`,
      [accion_id, servicio_id]
    );
    if (rows.length === 0) {
      return res
        .status(409)
        .json({ ok: false, error: 'La accion no existe o no corresponde al servicio' });
    }
  }

  // --- Operador (opcional, debe existir y estar activo) ---
  if (usuario_responsable_id) {
    const { rows } = await query(
      `SELECT usuario_id FROM usuarios_responsables WHERE usuario_id = ? AND estado = TRUE`,
      [usuario_responsable_id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'El operador responsable no existe o esta inactivo' });
    }
  }

  const reincidencia = await detectarReincidencia(estudianteId, categoria_id || null);

  const client = await getClient();
  try {
    await client.beginTransaction();

    const insert = await client.query(
      `INSERT INTO atenciones
          (estudiante_id, solicitante_desc, servicio_id, unidad_id, categoria_id,
           descripcion_motivo, diagnostico_accion, accion_id, usuario_responsable_id,
           estado_atencion, prioridad, atencion_origen_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Registrada', ?, ?)`,
      [
        estudianteId,
        estudianteId ? null : solicitante_desc.trim(),
        servicio_id,
        unidad_id,
        categoria_id || null,
        descripcion_motivo,
        diagnostico_accion || null,
        accion_id || null,
        usuario_responsable_id || null,
        prioridad || 'Media',
        reincidencia.atencion_origen_id,
      ]
    );
    const atencionId = insert.rows.insertId;

    await client.query(
      `INSERT INTO atenciones_historial
          (atencion_id, estado_anterior, estado_nuevo, comentario, unidad_id, usuario_responsable_id)
       VALUES (?, NULL, 'Registrada', ?, ?, ?)`,
      [
        atencionId,
        reincidencia.es_reincidente
          ? `Atencion registrada (reincidente: ${reincidencia.total_previas} previa(s))`
          : 'Atencion registrada',
        unidad_id,
        usuario_responsable_id || null,
      ]
    );

    await client.commit();

    const { rows: nuevaRows } = await query(
      `SELECT atencion_id, fecha_atencion, estado_atencion, prioridad FROM atenciones WHERE atencion_id = ?`,
      [atencionId]
    );
    const nueva = nuevaRows[0];
    const { trigger_encuesta, trimestre, preguntas } = await evaluarTriggerEncuesta(servicio_id);

    return res.status(201).json({
      ok: true,
      atencion_id: nueva.atencion_id,
      fecha_atencion: nueva.fecha_atencion,
      estado_atencion: nueva.estado_atencion,
      prioridad: nueva.prioridad,
      reincidencia: {
        es_reincidente: reincidencia.es_reincidente,
        total_previas: reincidencia.total_previas,
        atencion_origen_id: reincidencia.atencion_origen_id,
      },
      trigger_encuesta,
      trimestre_id: trimestre ? trimestre.trimestre_id : null,
      preguntas_encuesta: trigger_encuesta ? preguntas : [],
    });
  } catch (err) {
    await client.rollback();
    throw err;
  } finally {
    client.release();
  }
});

// Columnas comunes para listado/detalle de atenciones.
const SELECT_ATENCION = `
  SELECT a.atencion_id, a.fecha_atencion, a.descripcion_motivo, a.diagnostico_accion,
         a.estado_atencion, a.prioridad, a.solicitante_desc,
         a.fecha_resolucion, a.fecha_cierre, a.atencion_origen_id,
         e.codigo_estudiante, e.nombres AS estudiante_nombres, e.apellidos AS estudiante_apellidos,
         s.servicio_id, s.nombre_servicio, s.es_sci,
         un.unidad_id, un.nombre AS unidad_nombre,
         der.nombre AS unidad_derivada_nombre,
         c.categoria_id, c.nombre AS categoria_nombre,
         ac.nombre AS accion_nombre,
         u.usuario_id AS responsable_id, u.nombres AS responsable_nombres, u.apellidos AS responsable_apellidos,
         (a.atencion_origen_id IS NOT NULL) AS es_reincidente
    FROM atenciones a
    LEFT JOIN estudiantes e ON e.estudiante_id = a.estudiante_id
    JOIN servicios_ogbu s ON s.servicio_id = a.servicio_id
    JOIN unidades un ON un.unidad_id = a.unidad_id
    LEFT JOIN unidades der ON der.unidad_id = a.unidad_derivada_id
    LEFT JOIN categorias_atencion c ON c.categoria_id = a.categoria_id
    LEFT JOIN catalogo_acciones ac ON ac.accion_id = a.accion_id
    LEFT JOIN usuarios_responsables u ON u.usuario_id = a.usuario_responsable_id`;

// GET /api/atenciones
// Lista atenciones con filtros opcionales, usada por la tabla del dashboard.
const listarAtenciones = asyncHandler(async (req, res) => {
  const {
    fecha_inicio,
    fecha_fin,
    servicio_id,
    unidad_id,
    categoria_id,
    estado_atencion,
    prioridad,
    solo_reincidentes,
    limite = 50,
    pagina = 1,
  } = req.query;

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
  if (unidad_id) {
    condiciones.push(`a.unidad_id = ?`);
    valores.push(unidad_id);
  }
  if (categoria_id) {
    condiciones.push(`a.categoria_id = ?`);
    valores.push(categoria_id);
  }
  if (estado_atencion) {
    condiciones.push(`a.estado_atencion = ?`);
    valores.push(estado_atencion);
  }
  if (prioridad) {
    condiciones.push(`a.prioridad = ?`);
    valores.push(prioridad);
  }
  if (solo_reincidentes === 'true' || solo_reincidentes === true) {
    condiciones.push(`a.atencion_origen_id IS NOT NULL`);
  }

  const whereClause = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';
  const limiteNum = Math.min(Number(limite) || 50, 200);
  const offset = (Math.max(Number(pagina) || 1, 1) - 1) * limiteNum;

  const sql = `${SELECT_ATENCION}
    ${whereClause}
   ORDER BY a.fecha_atencion DESC
   LIMIT ? OFFSET ?`;
  valores.push(limiteNum, offset);

  const { rows } = await query(sql, valores);
  res.json({ ok: true, total_retornado: rows.length, atenciones: rows });
});

// GET /api/atenciones/:id
// Detalle de una atencion + linea de tiempo de cambios de estado.
const obtenerAtencion = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { rows } = await query(`${SELECT_ATENCION} WHERE a.atencion_id = ?`, [id]);
  if (rows.length === 0) {
    return res.status(404).json({ ok: false, error: 'La atencion no existe' });
  }
  const atencion = rows[0];

  const { rows: historial } = await query(
    `SELECT h.historial_id, h.estado_anterior, h.estado_nuevo, h.comentario, h.creado_en,
            un.nombre AS unidad_nombre,
            u.nombres AS responsable_nombres, u.apellidos AS responsable_apellidos
       FROM atenciones_historial h
       LEFT JOIN unidades un ON un.unidad_id = h.unidad_id
       LEFT JOIN usuarios_responsables u ON u.usuario_id = h.usuario_responsable_id
      WHERE h.atencion_id = ?
      ORDER BY h.creado_en, h.historial_id`,
    [id]
  );

  const estadosSiguientes = TRANSICIONES[atencion.estado_atencion] || [];

  res.json({ ok: true, atencion, historial, estados_siguientes: estadosSiguientes });
});

// PATCH /api/atenciones/:id/estado
// Cambia el estado de una atencion respetando el ciclo de vida, registra el
// cambio en el historial y fija/limpia las fechas de resolucion/cierre.
const cambiarEstado = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { estado_nuevo, comentario, unidad_derivada_id, unidad_id } = req.body;
  // Quien ejecuta el cambio es siempre el usuario de la sesion (queda en el
  // historial); el cliente no puede atribuir el cambio a otra persona.
  const ejecutorId = req.user.usuario_id;

  const { rows } = await query(
    `SELECT atencion_id, estado_atencion, unidad_id FROM atenciones WHERE atencion_id = ?`,
    [id]
  );
  if (rows.length === 0) {
    return res.status(404).json({ ok: false, error: 'La atencion no existe' });
  }
  const actual = rows[0];

  if (actual.estado_atencion === estado_nuevo) {
    return res.status(409).json({ ok: false, error: `La atencion ya esta en estado "${estado_nuevo}"` });
  }
  if (!transicionValida(actual.estado_atencion, estado_nuevo)) {
    return res.status(409).json({
      ok: false,
      error: `Transicion no permitida: "${actual.estado_atencion}" -> "${estado_nuevo}"`,
      transiciones_validas: TRANSICIONES[actual.estado_atencion] || [],
    });
  }

  if (estado_nuevo === 'Derivada') {
    if (!unidad_derivada_id) {
      return res
        .status(400)
        .json({ ok: false, error: 'Para derivar se debe indicar la unidad de destino (unidad_derivada_id)' });
    }
    const { rows: uRows } = await query(
      `SELECT unidad_id FROM unidades WHERE unidad_id = ? AND estado = TRUE`,
      [unidad_derivada_id]
    );
    if (uRows.length === 0) {
      return res.status(404).json({ ok: false, error: 'La unidad de derivacion no existe o esta inactiva' });
    }
  }

  const efectos = efectosFecha(estado_nuevo);
  const sets = ['estado_atencion = ?'];
  const valores = [estado_nuevo];

  if (efectos.fecha_resolucion === 'NOW') sets.push('fecha_resolucion = CURRENT_TIMESTAMP');
  else if (efectos.fecha_resolucion === null) sets.push('fecha_resolucion = NULL');
  if (efectos.fecha_cierre === 'NOW') sets.push('fecha_cierre = CURRENT_TIMESTAMP');
  else if (efectos.fecha_cierre === null) sets.push('fecha_cierre = NULL');

  if (estado_nuevo === 'Derivada') {
    sets.push('unidad_derivada_id = ?');
    valores.push(unidad_derivada_id);
  }
  if (unidad_id) {
    sets.push('unidad_id = ?');
    valores.push(unidad_id);
  }
  const client = await getClient();
  try {
    await client.beginTransaction();

    valores.push(id);
    await client.query(`UPDATE atenciones SET ${sets.join(', ')} WHERE atencion_id = ?`, valores);

    await client.query(
      `INSERT INTO atenciones_historial
          (atencion_id, estado_anterior, estado_nuevo, comentario, unidad_id, usuario_responsable_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        actual.estado_atencion,
        estado_nuevo,
        comentario ? comentario.trim() : null,
        unidad_id || actual.unidad_id,
        ejecutorId,
      ]
    );

    await client.commit();
  } catch (err) {
    await client.rollback();
    throw err;
  } finally {
    client.release();
  }

  const { rows: actualizada } = await query(
    `SELECT atencion_id, estado_atencion, fecha_resolucion, fecha_cierre FROM atenciones WHERE atencion_id = ?`,
    [id]
  );
  res.json({ ok: true, atencion: actualizada[0], estados_siguientes: TRANSICIONES[estado_nuevo] || [] });
});

module.exports = { crearAtencion, listarAtenciones, obtenerAtencion, cambiarEstado, ESTADOS_ABIERTOS };
