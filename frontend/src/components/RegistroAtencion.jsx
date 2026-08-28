import { useEffect, useState } from 'react';
import { buscarEstudiante, crearAtencion, obtenerServicios } from '../api/client';
import EncuestaModal from './EncuestaModal';

// En un sistema con autenticacion, el usuario_responsable_id se tomaria de
// la sesion del operador logueado. Aqui se simula con un selector fijo
// que corresponde a los usuarios de prueba sembrados en la base de datos.
const OPERADORES_DEMO = [
  { id: 1, nombre: 'Maria Quispe Rojas (Trabajador Social)' },
  { id: 2, nombre: 'Jose Torres Vidal (Nutricionista)' },
  { id: 3, nombre: 'Ana Fernandez Diaz (Administrador)' },
];

const ESTADO_INICIAL = {
  codigoEstudiante: '',
  servicioId: '',
  descripcionMotivo: '',
  diagnosticoAccion: '',
  usuarioResponsableId: OPERADORES_DEMO[0].id,
};

export default function RegistroAtencion() {
  const [servicios, setServicios] = useState([]);
  const [form, setForm] = useState(ESTADO_INICIAL);
  const [estudiante, setEstudiante] = useState(null);
  const [buscandoEstudiante, setBuscandoEstudiante] = useState(false);
  const [errorEstudiante, setErrorEstudiante] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [feedback, setFeedback] = useState(null); // { tipo: 'ok' | 'error', mensaje }
  const [encuestaActiva, setEncuestaActiva] = useState(null); // { atencionId, preguntas }

  useEffect(() => {
    obtenerServicios()
      .then((data) => setServicios(data.servicios))
      .catch(() => setServicios([]));
  }, []);

  // Permite enlazar directamente a un caso (ej. ?codigo=20190001&servicio=1)
  // precargando la busqueda del estudiante, util para demos y soporte.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codigo = params.get('codigo');
    const servicio = params.get('servicio');
    if (!codigo) return;

    setForm((f) => ({ ...f, codigoEstudiante: codigo, servicioId: servicio || f.servicioId }));
    setBuscandoEstudiante(true);
    buscarEstudiante(codigo.trim())
      .then((data) => setEstudiante(data.estudiante))
      .catch((err) => setErrorEstudiante(err.message))
      .finally(() => setBuscandoEstudiante(false));
  }, []);

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

    if (!estudiante) {
      setFeedback({ tipo: 'error', mensaje: 'Busca y confirma un estudiante valido antes de guardar.' });
      return;
    }

    setGuardando(true);
    try {
      const resultado = await crearAtencion({
        codigo_estudiante: estudiante.codigo_estudiante,
        servicio_id: Number(form.servicioId),
        descripcion_motivo: form.descripcionMotivo,
        diagnostico_accion: form.diagnosticoAccion,
        usuario_responsable_id: Number(form.usuarioResponsableId),
      });

      setFeedback({ tipo: 'ok', mensaje: `Atencion #${resultado.atencion_id} registrada correctamente.` });
      setForm({ ...ESTADO_INICIAL, usuarioResponsableId: form.usuarioResponsableId });
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

  return (
    <div className="mx-auto max-w-2xl rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900">Registro de atencion</h2>
      <p className="mt-1 text-sm text-gray-500">Formulario agil para el operador de la OGBU.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        {/* Busqueda rapida por codigo de estudiante */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Codigo de estudiante</label>
          <div className="mt-1 flex gap-2">
            <input
              type="text"
              value={form.codigoEstudiante}
              onChange={(e) => setForm((f) => ({ ...f, codigoEstudiante: e.target.value }))}
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

        {/* Servicio */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Servicio</label>
          <select
            value={form.servicioId}
            onChange={(e) => setForm((f) => ({ ...f, servicioId: e.target.value }))}
            required
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-ogbu-600 focus:outline-none focus:ring-1 focus:ring-ogbu-600"
          >
            <option value="">Selecciona un servicio...</option>
            {servicios.map((s) => (
              <option key={s.servicio_id} value={s.servicio_id}>
                {s.nombre_servicio}
              </option>
            ))}
          </select>
        </div>

        {/* Operador responsable (demo) */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Operador responsable</label>
          <select
            value={form.usuarioResponsableId}
            onChange={(e) => setForm((f) => ({ ...f, usuarioResponsableId: e.target.value }))}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-ogbu-600 focus:outline-none focus:ring-1 focus:ring-ogbu-600"
          >
            {OPERADORES_DEMO.map((op) => (
              <option key={op.id} value={op.id}>
                {op.nombre}
              </option>
            ))}
          </select>
        </div>

        {/* Motivo */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Motivo de atencion</label>
          <textarea
            value={form.descripcionMotivo}
            onChange={(e) => setForm((f) => ({ ...f, descripcionMotivo: e.target.value }))}
            required
            rows={3}
            maxLength={2000}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-ogbu-600 focus:outline-none focus:ring-1 focus:ring-ogbu-600"
          />
        </div>

        {/* Diagnostico / accion */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Diagnostico / accion tomada</label>
          <textarea
            value={form.diagnosticoAccion}
            onChange={(e) => setForm((f) => ({ ...f, diagnosticoAccion: e.target.value }))}
            rows={3}
            maxLength={2000}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-ogbu-600 focus:outline-none focus:ring-1 focus:ring-ogbu-600"
          />
        </div>

        {feedback && (
          <div
            className={`rounded-md px-3 py-2 text-sm ${
              feedback.tipo === 'ok' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'
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
