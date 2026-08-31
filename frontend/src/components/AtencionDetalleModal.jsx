import { useEffect, useState } from 'react';
import { obtenerAtencion } from '../api/client';

const BADGE = {
  Registrada: 'bg-gray-100 text-gray-700',
  'En atencion': 'bg-amber-100 text-amber-800',
  Derivada: 'bg-blue-100 text-blue-800',
  Resuelta: 'bg-teal-100 text-teal-800',
  Cerrada: 'bg-green-100 text-green-800',
  Reabierta: 'bg-red-100 text-red-800',
};

function fmt(fecha) {
  return fecha ? new Date(fecha).toLocaleString('es-PE') : '-';
}

// Modal de solo lectura: ficha de la atencion + linea de tiempo del historial.
export default function AtencionDetalleModal({ atencionId, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    obtenerAtencion(atencionId)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [atencionId]);

  const a = data?.atencion;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Atencion #{atencionId}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">&times;</button>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        {a && (
          <>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className={`rounded-full px-2 py-0.5 font-medium ${BADGE[a.estado_atencion] || 'bg-gray-100'}`}>
                {a.estado_atencion}
              </span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-700">
                Prioridad {a.prioridad}
              </span>
              {Number(a.es_reincidente) === 1 && (
                <span className="rounded-full bg-red-50 px-2 py-0.5 font-medium text-red-700">Reincidente</span>
              )}
            </div>

            <dl className="mt-4 grid grid-cols-3 gap-x-3 gap-y-2 text-sm">
              <dt className="text-gray-500">Solicitante</dt>
              <dd className="col-span-2 text-gray-900">
                {a.codigo_estudiante
                  ? `${a.estudiante_nombres} ${a.estudiante_apellidos} (${a.codigo_estudiante})`
                  : a.solicitante_desc || 'Ticket interno'}
              </dd>
              <dt className="text-gray-500">Servicio</dt>
              <dd className="col-span-2 text-gray-900">{a.nombre_servicio}</dd>
              <dt className="text-gray-500">Unidad</dt>
              <dd className="col-span-2 text-gray-900">{a.unidad_nombre}</dd>
              {a.unidad_derivada_nombre && (
                <>
                  <dt className="text-gray-500">Derivada a</dt>
                  <dd className="col-span-2 text-gray-900">{a.unidad_derivada_nombre}</dd>
                </>
              )}
              <dt className="text-gray-500">Categoria</dt>
              <dd className="col-span-2 text-gray-900">{a.categoria_nombre || 'Sin categorizar'}</dd>
              <dt className="text-gray-500">Motivo</dt>
              <dd className="col-span-2 whitespace-pre-wrap text-gray-900">{a.descripcion_motivo}</dd>
              {(a.accion_nombre || a.diagnostico_accion) && (
                <>
                  <dt className="text-gray-500">Accion</dt>
                  <dd className="col-span-2 whitespace-pre-wrap text-gray-900">
                    {a.accion_nombre}
                    {a.accion_nombre && a.diagnostico_accion ? ' - ' : ''}
                    {a.diagnostico_accion}
                  </dd>
                </>
              )}
              <dt className="text-gray-500">Registrada</dt>
              <dd className="col-span-2 text-gray-900">{fmt(a.fecha_atencion)}</dd>
              {a.fecha_resolucion && (
                <>
                  <dt className="text-gray-500">Resuelta</dt>
                  <dd className="col-span-2 text-gray-900">{fmt(a.fecha_resolucion)}</dd>
                </>
              )}
              {a.fecha_cierre && (
                <>
                  <dt className="text-gray-500">Cerrada</dt>
                  <dd className="col-span-2 text-gray-900">{fmt(a.fecha_cierre)}</dd>
                </>
              )}
            </dl>

            <h3 className="mt-5 text-sm font-semibold text-gray-900">Historial</h3>
            <ol className="mt-2 space-y-3 border-l-2 border-gray-200 pl-4">
              {data.historial.map((h) => (
                <li key={h.historial_id} className="relative">
                  <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-ogbu-600" />
                  <p className="text-sm text-gray-900">
                    {h.estado_anterior ? `${h.estado_anterior} -> ` : ''}
                    <span className="font-medium">{h.estado_nuevo}</span>
                  </p>
                  <p className="text-xs text-gray-400">
                    {fmt(h.creado_en)}
                    {h.unidad_nombre ? ` - ${h.unidad_nombre}` : ''}
                    {h.responsable_nombres ? ` - ${h.responsable_nombres} ${h.responsable_apellidos}` : ''}
                  </p>
                  {h.comentario && <p className="mt-0.5 text-sm text-gray-600">{h.comentario}</p>}
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </div>
  );
}
