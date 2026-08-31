import { useEffect, useState } from 'react';
import { cambiarEstadoAtencion, obtenerAtencion, obtenerUnidades } from '../api/client';

// Modal para mover una atencion por su ciclo de estados. Los estados
// permitidos los define el backend (estados_siguientes de GET /atenciones/:id).
export default function CambiarEstadoModal({ atencionId, onClose, onActualizada }) {
  const [detalle, setDetalle] = useState(null);
  const [unidades, setUnidades] = useState([]);
  const [estadoNuevo, setEstadoNuevo] = useState('');
  const [comentario, setComentario] = useState('');
  const [unidadDerivadaId, setUnidadDerivadaId] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    obtenerAtencion(atencionId)
      .then((d) => setDetalle(d))
      .catch((err) => setError(err.message));
    obtenerUnidades().then((d) => setUnidades(d.unidades)).catch(() => setUnidades([]));
  }, [atencionId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!estadoNuevo) {
      setError('Selecciona el nuevo estado.');
      return;
    }
    if (estadoNuevo === 'Derivada' && !unidadDerivadaId) {
      setError('Para derivar indica la unidad de destino.');
      return;
    }
    setGuardando(true);
    try {
      await cambiarEstadoAtencion(atencionId, {
        estado_nuevo: estadoNuevo,
        comentario: comentario || undefined,
        unidad_derivada_id: estadoNuevo === 'Derivada' ? Number(unidadDerivadaId) : undefined,
      });
      onActualizada();
    } catch (err) {
      setError(err.message || 'No se pudo cambiar el estado.');
    } finally {
      setGuardando(false);
    }
  };

  const siguientes = detalle?.estados_siguientes || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900">Cambiar estado</h2>
        {detalle && (
          <p className="mt-1 text-sm text-gray-500">
            Atencion #{detalle.atencion.atencion_id} &middot; estado actual:{' '}
            <span className="font-medium text-gray-700">{detalle.atencion.estado_atencion}</span>
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nuevo estado</label>
            <select
              value={estadoNuevo}
              onChange={(e) => setEstadoNuevo(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-ogbu-600 focus:outline-none focus:ring-1 focus:ring-ogbu-600"
            >
              <option value="">Selecciona...</option>
              {siguientes.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {detalle && siguientes.length === 0 && (
              <p className="mt-1 text-xs text-gray-400">No hay transiciones disponibles desde este estado.</p>
            )}
          </div>

          {estadoNuevo === 'Derivada' && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Unidad de destino</label>
              <select
                value={unidadDerivadaId}
                onChange={(e) => setUnidadDerivadaId(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-ogbu-600 focus:outline-none focus:ring-1 focus:ring-ogbu-600"
              >
                <option value="">Selecciona la unidad...</option>
                {unidades.map((u) => (
                  <option key={u.unidad_id} value={u.unidad_id}>{u.nombre}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Comentario <span className="font-normal text-gray-400">(opcional)</span>
            </label>
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              rows={2}
              maxLength={600}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-ogbu-600 focus:outline-none focus:ring-1 focus:ring-ogbu-600"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando || siguientes.length === 0}
              className="rounded-md bg-ogbu-600 px-4 py-2 text-sm font-medium text-white hover:bg-ogbu-700 disabled:opacity-60"
            >
              {guardando ? 'Guardando...' : 'Guardar cambio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
