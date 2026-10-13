import { useEffect, useState } from 'react';
import {
  listarAtenciones,
  obtenerDashboard,
  obtenerServicios,
  obtenerUnidades,
} from '../api/client';
import CambiarEstadoModal from './CambiarEstadoModal';
import AtencionDetalleModal from './AtencionDetalleModal';
import { useAuth } from '../auth/AuthContext';

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

const ESTADOS = ['Registrada', 'En atencion', 'Derivada', 'Resuelta', 'Cerrada', 'Reabierta'];

const ESTADO_BADGE = {
  Registrada: 'bg-gray-100 text-gray-700',
  'En atencion': 'bg-amber-100 text-amber-800',
  Derivada: 'bg-blue-100 text-blue-800',
  Resuelta: 'bg-teal-100 text-teal-800',
  Cerrada: 'bg-green-100 text-green-800',
  Reabierta: 'bg-red-100 text-red-800',
};

export default function DashboardIndicadores() {
  const { permisos } = useAuth();
  const [servicios, setServicios] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [filtros, setFiltros] = useState({
    fecha_inicio: '',
    fecha_fin: '',
    servicio_id: '',
    unidad_id: '',
    estado_atencion: '',
  });
  const [dashboard, setDashboard] = useState(null);
  const [atenciones, setAtenciones] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [modalEstado, setModalEstado] = useState(null); // atencion_id
  const [modalDetalle, setModalDetalle] = useState(null); // atencion_id

  useEffect(() => {
    obtenerServicios('todos').then((d) => setServicios(d.servicios)).catch(() => setServicios([]));
    obtenerUnidades().then((d) => setUnidades(d.unidades)).catch(() => setUnidades([]));
  }, []);

  const cargarDatos = async () => {
    setCargando(true);
    setError('');
    try {
      const [dashboardData, atencionesData] = await Promise.all([
        obtenerDashboard(filtros),
        listarAtenciones({ ...filtros, limite: 25 }),
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

  const k = dashboard?.kpis || {};
  const selectCls = 'mt-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm';

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div>
          <label className="block text-xs font-medium text-gray-500">Desde</label>
          <input type="date" value={filtros.fecha_inicio}
            onChange={(e) => setFiltros((f) => ({ ...f, fecha_inicio: e.target.value }))} className={selectCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500">Hasta</label>
          <input type="date" value={filtros.fecha_fin}
            onChange={(e) => setFiltros((f) => ({ ...f, fecha_fin: e.target.value }))} className={selectCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500">Servicio</label>
          <select value={filtros.servicio_id}
            onChange={(e) => setFiltros((f) => ({ ...f, servicio_id: e.target.value }))} className={selectCls}>
            <option value="">Todos</option>
            {servicios.map((s) => <option key={s.servicio_id} value={s.servicio_id}>{s.nombre_servicio}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500">Unidad</label>
          <select value={filtros.unidad_id}
            onChange={(e) => setFiltros((f) => ({ ...f, unidad_id: e.target.value }))} className={selectCls}>
            <option value="">Todas</option>
            {unidades.map((u) => <option key={u.unidad_id} value={u.unidad_id}>{u.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500">Estado</label>
          <select value={filtros.estado_atencion}
            onChange={(e) => setFiltros((f) => ({ ...f, estado_atencion: e.target.value }))} className={selectCls}>
            <option value="">Todos</option>
            {ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button onClick={cargarDatos} disabled={cargando}
          className="rounded-md bg-ogbu-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-ogbu-700 disabled:opacity-60">
          {cargando ? 'Cargando...' : 'Aplicar filtros'}
        </button>
      </div>

      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiCard etiqueta="Total de atenciones" valor={k.total_atenciones ?? '-'} />
        <KpiCard etiqueta="Satisfaccion promedio" valor={k.promedio_satisfaccion_general ?? '-'}
          sufijo={k.promedio_satisfaccion_general != null ? '/ 5' : ''} />
        <KpiCard etiqueta="Tiempo prom. resolucion" valor={k.tiempo_promedio_resolucion_horas ?? '-'}
          sufijo={k.tiempo_promedio_resolucion_horas != null ? 'h' : ''} />
        <KpiCard etiqueta="Atenciones abiertas" valor={k.atenciones_abiertas ?? '-'} />
        <KpiCard etiqueta="Tasa de reincidencia" valor={k.tasa_reincidencia ?? '-'}
          sufijo={k.tasa_reincidencia != null ? '%' : ''} />
      </div>

      {/* ICA */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900">Cobertura de atenciones por servicio (ICA)</h3>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {dashboard?.indicador_cobertura_atenciones.map((s) => (
            <div key={s.servicio_id} className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-500">{s.nombre_servicio}</p>
              <p className="text-xl font-bold text-gray-900">{s.total_atenciones}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tiempo de resolucion + distribucion de estados */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900">Tiempo promedio de resolucion por servicio (horas)</h3>
          <table className="mt-3 min-w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              {(dashboard?.tiempo_promedio_resolucion || []).map((r) => (
                <tr key={r.servicio_id}>
                  <td className="py-2 pr-4">{r.nombre_servicio}</td>
                  <td className="py-2 pr-4 font-semibold">{r.horas_promedio} h</td>
                  <td className="py-2 text-gray-400">{r.atenciones_resueltas} atenciones</td>
                </tr>
              ))}
              {(dashboard?.tiempo_promedio_resolucion || []).length === 0 && (
                <tr><td className="py-3 text-gray-400">Sin atenciones cerradas en el rango.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900">Distribucion por estado</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {(dashboard?.distribucion_estados || []).map((d) => (
              <span key={d.estado_atencion}
                className={`rounded-full px-3 py-1 text-xs font-medium ${ESTADO_BADGE[d.estado_atencion] || 'bg-gray-100'}`}>
                {d.estado_atencion}: {d.total}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ISE */}
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
                  <td className="py-2 pr-4">{row.anio}-T{row.periodo_trimestre}</td>
                  <td className="py-2 pr-4 font-semibold">{row.promedio_satisfaccion}</td>
                  <td className="py-2 pr-4">{row.total_respuestas}</td>
                </tr>
              ))}
              {dashboard?.indice_satisfaccion_estudiantil.length === 0 && (
                <tr><td colSpan={4} className="py-4 text-center text-gray-400">Sin respuestas de encuesta registradas.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reincidencia + categorias */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900">Categorias con mas reincidencia</h3>
          <table className="mt-3 min-w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              {(dashboard?.reincidencia?.top_categorias || []).map((c) => (
                <tr key={c.categoria_id}>
                  <td className="py-2 pr-4">{c.categoria_nombre}</td>
                  <td className="py-2 pr-4 text-gray-400">{c.nombre_servicio}</td>
                  <td className="py-2 font-semibold">{c.total_reincidentes}</td>
                </tr>
              ))}
              {(dashboard?.reincidencia?.top_categorias || []).length === 0 && (
                <tr><td className="py-3 text-gray-400">Sin reincidencias en el rango.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900">Atenciones por categoria</h3>
          <table className="mt-3 min-w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              {(dashboard?.atenciones_por_categoria || []).slice(0, 8).map((c) => (
                <tr key={c.categoria_id}>
                  <td className="py-2 pr-4">{c.categoria_nombre}</td>
                  <td className="py-2 pr-4 text-gray-400">{c.nombre_servicio}</td>
                  <td className="py-2 font-semibold">{c.total}</td>
                </tr>
              ))}
              {(dashboard?.atenciones_por_categoria || []).length === 0 && (
                <tr><td className="py-3 text-gray-400">Sin atenciones categorizadas.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Atenciones recientes */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900">Atenciones recientes</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead>
              <tr className="text-left text-xs font-medium uppercase text-gray-500">
                <th className="py-2 pr-4">Fecha</th>
                <th className="py-2 pr-4">Solicitante</th>
                <th className="py-2 pr-4">Servicio / Unidad</th>
                <th className="py-2 pr-4">Categoria</th>
                <th className="py-2 pr-4">Estado</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {atenciones.map((a) => (
                <tr key={a.atencion_id} className="hover:bg-gray-50">
                  <td className="py-2 pr-4 whitespace-nowrap">
                    {new Date(a.fecha_atencion).toLocaleString('es-PE')}
                  </td>
                  <td className="py-2 pr-4">
                    {a.codigo_estudiante ? (
                      <>
                        {a.estudiante_nombres} {a.estudiante_apellidos}
                        <span className="ml-1 text-xs text-gray-400">({a.codigo_estudiante})</span>
                      </>
                    ) : (
                      <span className="text-gray-600">{a.solicitante_desc || 'Ticket interno'}</span>
                    )}
                    {Number(a.es_reincidente) === 1 && (
                      <span className="ml-1 rounded bg-red-50 px-1 text-xs font-medium text-red-700">reinc.</span>
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    {a.nombre_servicio}
                    <span className="block text-xs text-gray-400">{a.unidad_nombre}</span>
                  </td>
                  <td className="py-2 pr-4 max-w-[12rem] truncate" title={a.categoria_nombre || ''}>
                    {a.categoria_nombre || '-'}
                  </td>
                  <td className="py-2 pr-4">
                    {permisos.operar ? (
                      <button
                        onClick={() => setModalEstado(a.atencion_id)}
                        className={`rounded-full px-2 py-0.5 text-xs font-medium hover:ring-2 hover:ring-ogbu-300 ${
                          ESTADO_BADGE[a.estado_atencion] || 'bg-gray-100'
                        }`}
                        title="Cambiar estado"
                      >
                        {a.estado_atencion}
                      </button>
                    ) : (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          ESTADO_BADGE[a.estado_atencion] || 'bg-gray-100'
                        }`}
                      >
                        {a.estado_atencion}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    <button onClick={() => setModalDetalle(a.atencion_id)}
                      className="text-xs font-medium text-ogbu-700 hover:underline">
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
              {atenciones.length === 0 && (
                <tr><td colSpan={6} className="py-4 text-center text-gray-400">No hay atenciones para los filtros seleccionados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalEstado && (
        <CambiarEstadoModal
          atencionId={modalEstado}
          onClose={() => setModalEstado(null)}
          onActualizada={() => { setModalEstado(null); cargarDatos(); }}
        />
      )}
      {modalDetalle && (
        <AtencionDetalleModal atencionId={modalDetalle} onClose={() => setModalDetalle(null)} />
      )}
    </div>
  );
}
