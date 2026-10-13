const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/categorias?servicio_id=
// Catalogo de tipos de atencion (para categorizar en el formulario y para
// los desgloses del dashboard). Filtrable por servicio.
const listarCategorias = asyncHandler(async (req, res) => {
  const { servicio_id } = req.query;

  const condiciones = ['c.activa = TRUE'];
  const valores = [];
  if (servicio_id) {
    condiciones.push('c.servicio_id = ?');
    valores.push(servicio_id);
  }

  const { rows } = await query(
    `SELECT c.categoria_id, c.servicio_id, c.nombre, c.descripcion,
            c.suele_repetirse, c.orden
       FROM categorias_atencion c
      WHERE ${condiciones.join(' AND ')}
      ORDER BY c.servicio_id, c.orden, c.nombre`,
    valores
  );

  res.json({ ok: true, categorias: rows });
});

// GET /api/acciones?servicio_id=
// Catalogo de acciones tomadas tipificadas. Filtrable por servicio.
const listarAcciones = asyncHandler(async (req, res) => {
  const { servicio_id } = req.query;

  const condiciones = ['a.activa = TRUE'];
  const valores = [];
  if (servicio_id) {
    condiciones.push('a.servicio_id = ?');
    valores.push(servicio_id);
  }

  const { rows } = await query(
    `SELECT a.accion_id, a.servicio_id, a.nombre, a.descripcion, a.orden
       FROM catalogo_acciones a
      WHERE ${condiciones.join(' AND ')}
      ORDER BY a.servicio_id, a.orden, a.nombre`,
    valores
  );

  res.json({ ok: true, acciones: rows });
});


// GET /api/motivos?servicio_id=&categoria_id=
// Motivos de atencion recurrentes (atajos para el campo "motivo", que sigue
// siendo texto libre). Con categoria_id devuelve los de esa categoria mas los
// que no estan atados a ninguna categoria del servicio.
const listarMotivos = asyncHandler(async (req, res) => {
  const { servicio_id, categoria_id } = req.query;

  const condiciones = ['m.activo = TRUE'];
  const valores = [];
  if (servicio_id) {
    condiciones.push('m.servicio_id = ?');
    valores.push(servicio_id);
  }
  if (categoria_id) {
    condiciones.push('(m.categoria_id = ? OR m.categoria_id IS NULL)');
    valores.push(categoria_id);
  }

  const { rows } = await query(
    `SELECT m.motivo_id, m.servicio_id, m.categoria_id, m.texto, m.frecuencia_mensual
       FROM motivos_recurrentes m
      WHERE ${condiciones.join(' AND ')}
      ORDER BY m.frecuencia_mensual IS NULL, m.frecuencia_mensual DESC, m.texto`,
    valores
  );

  res.json({ ok: true, motivos: rows });
});

module.exports = { listarCategorias, listarAcciones, listarMotivos };
