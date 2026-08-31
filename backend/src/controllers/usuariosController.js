const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/usuarios?unidad_id=
// Lista los operadores activos, opcionalmente filtrados por unidad, para
// poblar el desplegable de "operador responsable" (encadenado a la unidad).
// Mientras no haya autenticacion, el operador se elige manualmente en el
// formulario en lugar de tomarse de una sesion.
const listar = asyncHandler(async (req, res) => {
  const { unidad_id } = req.query;

  const condiciones = ['u.estado = TRUE'];
  const valores = [];
  if (unidad_id) {
    condiciones.push('u.unidad_id = ?');
    valores.push(unidad_id);
  }

  const { rows } = await query(
    `SELECT u.usuario_id, u.nombres, u.apellidos, u.rol, u.cargo,
            u.unidad_id, un.nombre AS unidad_nombre
       FROM usuarios_responsables u
       LEFT JOIN unidades un ON un.unidad_id = u.unidad_id
      WHERE ${condiciones.join(' AND ')}
      ORDER BY u.apellidos, u.nombres`,
    valores
  );

  res.json({ ok: true, usuarios: rows });
});

module.exports = { listar };
