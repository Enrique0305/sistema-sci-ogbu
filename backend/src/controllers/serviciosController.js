const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/servicios?ambito=sci|todos
// Lista los servicios OGBU activos para poblar el desplegable del formulario
// de registro y los filtros del dashboard.
//   ambito=todos (por defecto): incluye los servicios internos (Soporte TI,
//                                Gestion OGBU) usados para tickets internos.
//   ambito=sci:                 solo los servicios reportables al SCI (es_sci=1).
const listarActivos = asyncHandler(async (req, res) => {
  const soloSci = req.query.ambito === 'sci';

  const { rows } = await query(
    `SELECT servicio_id, nombre_servicio, descripcion, es_sci
       FROM servicios_ogbu
      WHERE estado = 'Activo'
      ${soloSci ? 'AND es_sci = 1' : ''}
      ORDER BY es_sci DESC, nombre_servicio`
  );
  res.json({ ok: true, servicios: rows });
});

module.exports = { listarActivos };
