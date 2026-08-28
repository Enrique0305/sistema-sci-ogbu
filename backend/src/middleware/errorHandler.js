// Middleware centralizado de manejo de errores. Evita filtrar detalles
// internos (stack traces, texto de consultas SQL) al cliente en produccion.
function notFoundHandler(req, res) {
  res.status(404).json({ ok: false, error: 'Recurso no encontrado' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error(err);

  const codigosMysql = {
    ER_DUP_ENTRY: { status: 409, mensaje: 'El registro ya existe (violacion de unicidad).' },
    ER_NO_REFERENCED_ROW: { status: 409, mensaje: 'Referencia invalida a un registro relacionado.' },
    ER_NO_REFERENCED_ROW_2: { status: 409, mensaje: 'Referencia invalida a un registro relacionado.' },
    ER_ROW_IS_REFERENCED: { status: 409, mensaje: 'No se puede eliminar: el registro tiene datos relacionados.' },
    ER_ROW_IS_REFERENCED_2: { status: 409, mensaje: 'No se puede eliminar: el registro tiene datos relacionados.' },
    ER_BAD_NULL_ERROR: { status: 400, mensaje: 'Falta un campo obligatorio.' },
    ER_CHECK_CONSTRAINT_VIOLATED: { status: 400, mensaje: 'Un valor no cumple las restricciones permitidas.' },
  };

  const mapeo = codigosMysql[err.code];
  if (mapeo) {
    return res.status(mapeo.status).json({ ok: false, error: mapeo.mensaje });
  }

  const status = err.status || 500;
  const mensaje = status === 500 ? 'Error interno del servidor' : err.message;
  res.status(status).json({ ok: false, error: mensaje });
}

module.exports = { notFoundHandler, errorHandler };
