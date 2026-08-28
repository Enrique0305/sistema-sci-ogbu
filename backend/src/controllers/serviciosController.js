const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/servicios
// Lista los servicios OGBU activos, usados para poblar el desplegable
// de seleccion en el formulario de registro de atencion.
const listarActivos = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT servicio_id, nombre_servicio, descripcion
       FROM servicios_ogbu
      WHERE estado = 'Activo'
      ORDER BY nombre_servicio`
  );
  res.json({ ok: true, servicios: rows });
});

module.exports = { listarActivos };
