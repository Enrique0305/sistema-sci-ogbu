const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/unidades?servicio_id=&tipo=
// Lista las unidades/oficinas activas de la OGBU, para poblar el desplegable
// de "unidad responsable" en el formulario de registro (encadenado al servicio).
const listar = asyncHandler(async (req, res) => {
  const { servicio_id, tipo } = req.query;

  const condiciones = ['u.estado = TRUE'];
  const valores = [];
  if (servicio_id) {
    condiciones.push('u.servicio_id = ?');
    valores.push(servicio_id);
  }
  if (tipo) {
    condiciones.push('u.tipo = ?');
    valores.push(tipo);
  }

  const { rows } = await query(
    `SELECT u.unidad_id, u.nombre, u.servicio_id, u.tipo,
            s.nombre_servicio, s.es_sci
       FROM unidades u
       LEFT JOIN servicios_ogbu s ON s.servicio_id = u.servicio_id
      WHERE ${condiciones.join(' AND ')}
      ORDER BY s.nombre_servicio, u.nombre`,
    valores
  );

  res.json({ ok: true, unidades: rows });
});

module.exports = { listar };
