import { useEffect, useMemo, useState } from 'react';
import {
  buscarEstudiante,
  crearAtencion,
  obtenerServicios,
  obtenerUnidades,
  obtenerOperadores,
  obtenerCategorias,
  obtenerAcciones,
} from '../api/client';
import EncuestaModal from './EncuestaModal';

// Mientras no haya autenticacion, la unidad y el operador se eligen en el
// formulario (encadenados: servicio -> unidad -> operador) en lugar de
// tomarse de una sesion.

const PRIORIDADES = ['Baja', 'Media', 'Alta'];

const ESTADO_INICIAL = {
  tipoRegistro: 'estudiante', // 'estudiante' | 'interno'
  codigoEstudiante: '',
  solicitanteDesc: '',
  servicioId: '',
  unidadId: '',
  categoriaId: '',
  usuarioResponsableId: '',
  descripcionMotivo: '',
  accionId: '',
  diagnosticoAccion: '',
  prioridad: 'Media',
};

export default function RegistroAtencion() {
  const [servicios, setServicios] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [operadores, setOperadores] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [acciones, setAcciones] = useState([]);

  const [form, setForm] = useState(ESTADO_INICIAL);
  const [estudiante, setEstudiante] = useState(null);
  const [buscandoEstudiante, setBuscandoEstudiante] = useState(false);
  const [errorEstudiante, setErrorEstudiante] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [feedback, setFeedback] = useState(null); // { tipo, mensaje }
  const [encuestaActiva, setEncuestaActiva] = useState(null);

  const set = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  useEffect(() => {
    obtenerServicios('todos')
      .then((data) => setServicios(data.servicios))
      .catch(() => setServicios([]));
  }, []);

  // Al cambiar el servicio: recargar unidades, categorias y acciones; limpiar
  // las selecciones dependientes.
  useEffect(() => {
    if (!form.servicioId) {
      setUnidades([]);
      setCategorias([]);
      setAcciones([]);
      return;
    }
    const filtro = { servicio_id: form.servicioId };
    obtenerUnidades(filtro).then((d) => setUnidades(d.unidades)).catch(() => setUnidades([]));
    obtenerCategorias(filtro).then((d) => setCategorias(d.categorias)).catch(() => setCategorias([]));
    obtenerAcciones(filtro).then((d) => setAcciones(d.acciones)).catch(() => setAcciones([]));
    setForm((f) => ({ ...f, unidadId: '', usuarioResponsableId: '', categoriaId: '', accionId: '' }));
  }, [form.servicioId]);

  // Al cambiar la unidad: recargar operadores de esa unidad.
  useEffect(() => {
    if (!form.unidadId) {
      setOperadores([]);
      return;
    }
    obtenerOperadores({ unidad_id: form.unidadId })
      .then((d) => setOperadores(d.usuarios))
      .catch(() => setOperadores([]));
    setForm((f) => ({ ...f, usuarioResponsableId: '' }));
  }, [form.unidadId]);

  const serviciosSci = useMemo(() => servicios.filter((s) => s.es_sci), [servicios]);
  const serviciosInternos = useMemo(() => servicios.filter((s) => !s.es_sci), [servicios]);

  const handleBuscarEstudiante = async () => {
    setErrorEstudiante('');
    setEstudiante(null);
    if (!form.codigoEstudiante.trim()) return;
    setBuscandoEstudiante(true);
    try {
      const data = await buscarEstudiante(form.codigoEstudiante.trim());
      setEstudiante(data.estudiante);
    } catch (err) {
      setErrorEstudiante(err.message);
    } finally {
      setBuscandoEstudiante(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback(null);

    if (form.tipoRegistro === 'estudiante' && !estudiante) {
      setFeedback({ tipo: 'error', mensaje: 'Busca y confirma un estudiante valido antes de guardar.' });
      return;
    }
    if (form.tipoRegistro === 'interno' && !form.solicitanteDesc.trim()) {
      setFeedback({ tipo: 'error', mensaje: 'Indica quien solicita el ticket interno.' });
      return;
    }
    if (!form.unidadId) {
      setFeedback({ tipo: 'error', mensaje: 'Selecciona la unidad responsable.' });
      return;
    }

    setGuardando(true);
    try {
      const payload = {
        servicio_id: Number(form.servicioId),
        unidad_id: Number(form.unidadId),
        categoria_id: form.categoriaId ? Number(form.categoriaId) : undefined,
        descripcion_motivo: form.descripcionMotivo,
        accion_id: form.accionId ? Number(form.accionId) : undefined,
        diagnostico_accion: form.diagnosticoAccion || undefined,
        usuario_responsable_id: form.usuarioResponsableId ? Number(form.usuarioResponsableId) : undefined,
        prioridad: form.prioridad,
      };
      if (form.tipoRegistro === 'estudiante') {
        payload.codigo_estudiante = estudiante.codigo_estudiante;
      } else {
        payload.solicitante_desc = form.solicitanteDesc.trim();
      }

      const resultado = await crearAtencion(payload);

      const avisoReincidencia = resultado.reincidencia?.es_reincidente
        ? ` Reincidencia detectada: el estudiante ya tuvo ${resultado.reincidencia.total_previas} atencion(es) de esta categoria.`
        : '';
      setFeedback({
        tipo: resultado.reincidencia?.es_reincidente ? 'aviso' : 'ok',
        mensaje: `Atencion #${resultado.atencion_id} registrada (prioridad ${resultado.prioridad}).${avisoReincidencia}`,
      });

      setForm({ ...ESTADO_INICIAL, tipoRegistro: form.tipoRegistro, prioridad: form.prioridad });
      setEstudiante(null);

      if (resultado.trigger_encuesta) {
        setEncuestaActiva({ atencionId: resultado.atencion_id, preguntas: resultado.preguntas_encuesta });
      }
    } catch (err) {
      setFeedback({ tipo: 'error', mensaje: err.message || 'No se pudo registrar la atencion.' });
    } finally {
      setGuardando(false);
    }
  };

  const inputCls =
    'mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-ogbu-600 focus:outline-none focus:ring-1 focus:ring-ogbu-600';

  return (
    <div className="mx-auto max-w-2xl rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900">Registro de atencion</h2>
      <p className="mt-1 text-sm text-gray-500">Mesa de ayuda de la OGBU: atenciones a estudiantes y tickets internos.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        {/* Tipo de registro */}
        <div className="flex gap-2 rounded-lg bg-gray-100 p-1 text-sm">
          {[
            { id: 'estudiante', label: 'Atencion a estudiante' },
            { id: 'interno', label: 'Ticket interno' },
          ].map((op) => (
            <button
              type="button"
              key={op.id}
              onClick={() => set('tipoRegistro', op.id)}
              className={`flex-1 rounded-md px-3 py-1.5 font-medium transition ${
                form.tipoRegistro === op.id ? 'bg-white text-ogbu-700 shadow-sm' : 'text-gray-500'
              }`}
            >
              {op.label}
            </button>
          ))}
        </div>

        {form.tipoRegistro === 'estudiante' ? (
          <div>
            <label className="block text-sm font-medium text-gray-700">Codigo de estudiante</label>
            <div className="mt-1 flex gap-2">
              <input
                type="text"
                value={form.codigoEstudiante}
                onChange={(e) => set('codigoEstudiante', e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleBuscarEstudiante())}
                placeholder="Ej. 20190001"
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-ogbu-600 focus:outline-none focus:ring-1 focus:ring-ogbu-600"
              />
              <button
                type="button"
                onClick={handleBuscarEstudiante}
                disabled={buscandoEstudiante}
                className="rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-900 disabled:opacity-60"
              >
                {buscandoEstudiante ? 'Buscando...' : 'Buscar'}
              </button>
            </div>
            {errorEstudiante && <p className="mt-1 text-sm text-red-600">{errorEstudiante}</p>}
            {estudiante && (
              <div className="mt-2 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
                {estudiante.nombres} {estudiante.apellidos} &middot; {estudiante.facultad}
              </div>
            )}
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700">Solicitante (unidad / persona)</label>
            <input
              type="text"
              value={form.solicitanteDesc}
              onChange={(e) => set('solicitanteDesc', e.target.value)}
              placeholder="Ej. Comedor de Cangallo"
              maxLength={200}
              className={inputCls}
            />
          </div>
        )}

        {/* Servicio */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Servicio</label>
          <select value={form.servicioId} onChange={(e) => set('servicioId', e.target.value)} required className={inputCls}>
            <option value="">Selecciona un servicio...</option>
            {serviciosSci.length > 0 && (
              <optgroup label="Servicios SCI">
                {serviciosSci.map((s) => (
                  <option key={s.servicio_id} value={s.servicio_id}>{s.nombre_servicio}</option>
                ))}
              </optgroup>
            )}
            {serviciosInternos.length > 0 && (
              <optgroup label="Interno">
                {serviciosInternos.map((s) => (
                  <option key={s.servicio_id} value={s.servicio_id}>{s.nombre_servicio}</option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        {/* Unidad responsable */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Unidad responsable</label>
          <select
            value={form.unidadId}
            onChange={(e) => set('unidadId', e.target.value)}
            required
            disabled={!form.servicioId}
            className={inputCls}
          >
            <option value="">{form.servicioId ? 'Selecciona una unidad...' : 'Elige un servicio primero'}</option>
            {unidades.map((u) => (
              <option key={u.unidad_id} value={u.unidad_id}>{u.nombre}</option>
            ))}
          </select>
        </div>

        {/* Operador responsable */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Operador responsable <span className="font-normal text-gray-400">(opcional)</span>
          </label>
          <select
            value={form.usuarioResponsableId}
            onChange={(e) => set('usuarioResponsableId', e.target.value)}
            disabled={!form.unidadId}
            className={inputCls}
          >
            <option value="">Sin especificar</option>
            {operadores.map((o) => (
              <option key={o.usuario_id} value={o.usuario_id}>
                {o.nombres} {o.apellidos}{o.cargo ? ` - ${o.cargo}` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Categoria y prioridad */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">
              Categoria <span className="font-normal text-gray-400">(opcional)</span>
            </label>
            <select
              value={form.categoriaId}
              onChange={(e) => set('categoriaId', e.target.value)}
              disabled={!form.servicioId}
              className={inputCls}
            >
              <option value="">Sin categorizar</option>
              {categorias.map((c) => (
                <option key={c.categoria_id} value={c.categoria_id}>{c.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Prioridad</label>
            <select value={form.prioridad} onChange={(e) => set('prioridad', e.target.value)} className={inputCls}>
              {PRIORIDADES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Motivo */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Motivo de atencion</label>
          <textarea
            value={form.descripcionMotivo}
            onChange={(e) => set('descripcionMotivo', e.target.value)}
            required
            rows={3}
            maxLength={2000}
            className={inputCls}
          />
        </div>

        {/* Accion tomada */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Accion tomada <span className="font-normal text-gray-400">(opcional)</span>
          </label>
          <select
            value={form.accionId}
            onChange={(e) => set('accionId', e.target.value)}
            disabled={!form.servicioId}
            className={inputCls}
          >
            <option value="">Sin accion tipificada</option>
            {acciones.map((a) => (
              <option key={a.accion_id} value={a.accion_id}>{a.nombre}</option>
            ))}
          </select>
          <textarea
            value={form.diagnosticoAccion}
            onChange={(e) => set('diagnosticoAccion', e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="Detalle de la accion / diagnostico (opcional)"
            className={inputCls}
          />
        </div>

        {feedback && (
          <div
            className={`rounded-md px-3 py-2 text-sm ${
              feedback.tipo === 'ok'
                ? 'bg-green-50 text-green-800'
                : feedback.tipo === 'aviso'
                ? 'bg-amber-50 text-amber-800'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {feedback.mensaje}
          </div>
        )}

        <button
          type="submit"
          disabled={guardando}
          className="w-full rounded-md bg-ogbu-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-ogbu-700 disabled:opacity-60"
        >
          {guardando ? 'Guardando...' : 'Registrar atencion'}
        </button>
      </form>

      {encuestaActiva && (
        <EncuestaModal
          atencionId={encuestaActiva.atencionId}
          preguntas={encuestaActiva.preguntas}
          onClose={() => setEncuestaActiva(null)}
          onCompletada={() => setEncuestaActiva(null)}
        />
      )}
    </div>
  );
}
