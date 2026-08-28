import { useEffect, useState } from 'react';
import { listarAtenciones, obtenerDashboard, obtenerServicios } from '../api/client';

function KpiCard({ etiqueta, valor, sufijo }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{etiqueta}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900">
        {valor}
        {sufijo && <span className="ml-1 text-base font-medium text-gray-400">{sufijo}</span>}
      </p>
    </div>
  );
}

const ESTADOS_BADGE = {
  'En Proceso': 'bg-amber-100 text-amber-800',
  Completado: 'bg-green-100 text-green-800',
};

export default function DashboardIndicadores() {
  const [servicios, setServicios] = useState([]);
  const [filtros, setFiltros] = useState({ fecha_inicio: '', fecha_fin: '', servicio_id: '' });
  const [dashboard, setDashboard] = useState(null);
  const [atenciones, setAtenciones] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    obtenerServicios()
      .then((data) => setServicios(data.servicios))
      .catch(() => setServicios([]));
  }, []);

  const cargarDatos = async () => {
    setCargando(true);
    setError('');
    try {
      const [dashboardData, atencionesData] = await Promise.all([
        obtenerDashboard(filtros),
        listarAtenciones({ ...filtros, limite: 20 }),
      ]);
      setDashboard(dashboardData);
      setAtenciones(atencionesData.atenciones);
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los indicadores.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div>
          <label className="block text-xs font-medium text-gray-500">Desde</label>
          <input
            type="date"
            value={filtros.fecha_inicio}
            onChange={(e) => setFiltros((f) => ({ ...f, fecha_inicio: e.target.value }))}
            className="mt-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500">Hasta</label>
          <input
            type="date"
            value={filtros.fecha_fin}
            onChange={(e) => setFiltros((f) => ({ ...f, fecha_fin: e.target.value }))}
            className="mt-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500">Servicio</label>
          <select
            value={filtros.servicio_id}
            onChange={(e) => setFiltros((f) => ({ ...f, servicio_id: e.target.value }))}
            className="mt-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="">Todos</option>
            {servicios.map((s) => (
              <option key={s.servicio_id} value={s.servicio_id}>
                {s.nombre_servicio}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={cargarDatos}
          disabled={cargando}
          className="rounded-md bg-ogbu-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-ogbu-700 disabled:opacity-60"
        >
          {cargando ? 'Cargando...' : 'Aplicar filtros'}
        </button>
      </div>

      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <KpiCard etiqueta="Total de atenciones" valor={dashboard?.kpis.total_atenciones ?? '-'} />
        <KpiCard
          etiqueta="Satisfaccion promedio general"
          valor={dashboard?.kpis.promedio_satisfaccion_general ?? '-'}
          sufijo={dashboard?.kpis.promedio_satisfaccion_general != null ? '/ 5' : ''}
        />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900">
          Cobertura de atenciones por servicio (ICA)
        </h3>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {dashboard?.indicador_cobertura_atenciones.map((s) => (
            <div key={s.servicio_id} className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-500">{s.nombre_servicio}</p>
              <p className="text-xl font-bold text-gray-900">{s.total_atenciones}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900">
          Indice de satisfaccion estudiantil (ISE) por servicio y trimestre
        </h3>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead>
              <tr className="text-left text-xs font-medium uppercase text-gray-500">
                <th className="py-2 pr-4">Servicio</th>
                <th className="py-2 pr-4">Trimestre</th>
                <th className="py-2 pr-4">Promedio (1-5)</th>
                <th className="py-2 pr-4">Respuestas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {dashboard?.indice_satisfaccion_estudiantil.map((row) => (
                <tr key={`${row.servicio_id}-${row.trimestre_id}`}>
                  <td className="py-2 pr-4">{row.nombre_servicio}</td>
                  <td className="py-2 pr-4">
                    {row.anio}-T{row.periodo_trimestre}
                  </td>
                  <td className="py-2 pr-4 font-semibold">{row.promedio_satisfaccion}</td>
                  <td className="py-2 pr-4">{row.total_respuestas}</td>
                </tr>
              ))}
              {dashboard?.indice_satisfaccion_estudiantil.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-gray-400">
                    Sin respuestas de encuesta registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900">Atenciones recientes</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead>
              <tr className="text-left text-xs font-medium uppercase text-gray-500">
                <th className="py-2 pr-4">Fecha</th>
                <th className="py-2 pr-4">Estudiante</th>
                <th className="py-2 pr-4">Servicio</th>
                <th className="py-2 pr-4">Motivo</th>
                <th className="py-2 pr-4">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {atenciones.map((a) => (
                <tr key={a.atencion_id}>
                  <td className="py-2 pr-4 whitespace-nowrap">
                    {new Date(a.fecha_atencion).toLocaleString('es-PE')}
                  </td>
                  <td className="py-2 pr-4">
                    {a.estudiante_nombres} {a.estudiante_apellidos}
                    <span className="ml-1 text-xs text-gray-400">({a.codigo_estudiante})</span>
                  </td>
                  <td className="py-2 pr-4">{a.nombre_servicio}</td>
                  <td className="py-2 pr-4 max-w-xs truncate" title={a.descripcion_motivo}>
                    {a.descripcion_motivo}
                  </td>
                  <td className="py-2 pr-4">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTADOS_BADGE[a.estado_atencion]}`}>
                      {a.estado_atencion}
                    </span>
                  </td>
                </tr>
              ))}
              {atenciones.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-gray-400">
                    No hay atenciones para los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
