// Envuelve controladores async para propagar errores al middleware
// centralizado de manejo de errores sin necesidad de try/catch repetido.
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
