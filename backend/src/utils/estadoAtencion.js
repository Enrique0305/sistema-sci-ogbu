// Ciclo de vida del estado de una atencion (mesa de ayuda OGBU).
//
//   Registrada  -> En atencion, Derivada, Cerrada
//   En atencion -> Derivada, Resuelta, Registrada
//   Derivada    -> En atencion, Resuelta
//   Resuelta    -> Cerrada, Reabierta
//   Cerrada     -> Reabierta
//   Reabierta   -> En atencion, Resuelta
//
// Las transiciones se validan en el controlador (no en la BD) para poder
// devolver un 409 con un mensaje claro y registrar el cambio en el historial.

const ESTADOS = ['Registrada', 'En atencion', 'Derivada', 'Resuelta', 'Cerrada', 'Reabierta'];

const TRANSICIONES = {
  Registrada: ['En atencion', 'Derivada', 'Cerrada'],
  'En atencion': ['Derivada', 'Resuelta', 'Registrada'],
  Derivada: ['En atencion', 'Resuelta'],
  Resuelta: ['Cerrada', 'Reabierta'],
  Cerrada: ['Reabierta'],
  Reabierta: ['En atencion', 'Resuelta'],
};

// Estados en los que la atencion se considera "abierta" (trabajo pendiente).
const ESTADOS_ABIERTOS = ['Registrada', 'En atencion', 'Derivada', 'Reabierta'];

function transicionValida(actual, siguiente) {
  return Array.isArray(TRANSICIONES[actual]) && TRANSICIONES[actual].includes(siguiente);
}

/**
 * Campos de fecha que se deben fijar/limpiar al entrar a un estado.
 * Devuelve un objeto parcial { fecha_resolucion, fecha_cierre } con valores
 * `NOW` (marcar), `null` (limpiar) o `undefined` (no tocar).
 */
function efectosFecha(estadoNuevo) {
  switch (estadoNuevo) {
    case 'Resuelta':
      return { fecha_resolucion: 'NOW', fecha_cierre: null };
    case 'Cerrada':
      return { fecha_cierre: 'NOW' };
    case 'Reabierta':
      return { fecha_resolucion: null, fecha_cierre: null };
    default:
      return {};
  }
}

module.exports = { ESTADOS, TRANSICIONES, ESTADOS_ABIERTOS, transicionValida, efectosFecha };
