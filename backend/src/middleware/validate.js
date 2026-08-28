const { validationResult } = require('express-validator');

// Ejecuta las validaciones declaradas en la ruta (express-validator) y
// corta la peticion con 400 si alguna falla, antes de llegar al controlador.
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      ok: false,
      error: 'Datos de entrada invalidos',
      detalles: errors.array().map((e) => ({ campo: e.path, mensaje: e.msg })),
    });
  }
  next();
}

module.exports = validate;
