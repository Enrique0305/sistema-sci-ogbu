const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/estudiantes/:codigo
// Busqueda rapida por codigo de estudiante, usada por el formulario
// de registro de atencion para autocompletar nombre y facultad.
const buscarPorCodigo = asyncHandler(async (req, res) => {
  const { codigo } = req.params;

  const { rows } = await query(
    `SELECT estudiante_id, codigo_estudiante, nombres, apellidos, facultad, correo_institucional, estado
       FROM estudiantes
      WHERE codigo_estudiante = ?`,
    [codigo]
  );

  if (rows.length === 0) {
    return res.status(404).json({ ok: false, error: 'No se encontro un estudiante con ese codigo' });
  }

  const estudiante = rows[0];
  if (!estudiante.estado) {
    return res.status(409).json({ ok: false, error: 'El estudiante se encuentra inactivo' });
  }

  res.json({ ok: true, estudiante });
});

module.exports = { buscarPorCodigo };
