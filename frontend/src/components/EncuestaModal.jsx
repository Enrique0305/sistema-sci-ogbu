import { useState } from 'react';
import { responderEncuesta } from '../api/client';

// Modal de encuesta de satisfaccion, disparado automaticamente cuando el
// backend responde trigger_encuesta = true tras registrar una atencion.
export default function EncuestaModal({ atencionId, preguntas, onClose, onCompletada }) {
  const [respuestas, setRespuestas] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const actualizarRespuesta = (preguntaId, valor) => {
    setRespuestas((prev) => ({ ...prev, [preguntaId]: valor }));
  };

  const todasRespondidas = preguntas.every((p) => (respuestas[p.pregunta_id] || '').toString().trim() !== '');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!todasRespondidas) {
      setError('Por favor responde todas las preguntas.');
      return;
    }
    setEnviando(true);
    try {
      const payload = preguntas.map((p) => ({
        pregunta_id: p.pregunta_id,
        atencion_id: atencionId,
        valor_respuesta: respuestas[p.pregunta_id],
      }));
      await responderEncuesta(payload);
      onCompletada();
    } catch (err) {
      setError(err.message || 'No se pudo guardar la encuesta.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900">Encuesta de satisfaccion</h2>
        <p className="mt-1 text-sm text-gray-500">
          Tu opinion ayuda a mejorar el servicio recibido en la OGBU.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-5">
          {preguntas.map((p) => (
            <div key={p.pregunta_id}>
              <label className="block text-sm font-medium text-gray-700">{p.texto_pregunta}</label>
              {p.tipo_respuesta === 'Likert_1_5' ? (
                <div className="mt-2 flex gap-2">
                  {[1, 2, 3, 4, 5].map((valor) => (
                    <button
                      type="button"
                      key={valor}
                      onClick={() => actualizarRespuesta(p.pregunta_id, valor)}
                      className={`h-10 w-10 rounded-full border text-sm font-semibold transition ${
                        Number(respuestas[p.pregunta_id]) === valor
                          ? 'border-ogbu-600 bg-ogbu-600 text-white'
                          : 'border-gray-300 text-gray-600 hover:border-ogbu-600'
                      }`}
                    >
                      {valor}
                    </button>
                  ))}
                </div>
              ) : (
                <textarea
                  className="mt-2 w-full rounded-md border border-gray-300 p-2 text-sm focus:border-ogbu-600 focus:outline-none focus:ring-1 focus:ring-ogbu-600"
                  rows={2}
                  value={respuestas[p.pregunta_id] || ''}
                  onChange={(e) => actualizarRespuesta(p.pregunta_id, e.target.value)}
                />
              )}
            </div>
          ))}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              Omitir
            </button>
            <button
              type="submit"
              disabled={enviando}
              className="rounded-md bg-ogbu-600 px-4 py-2 text-sm font-medium text-white hover:bg-ogbu-700 disabled:opacity-60"
            >
              {enviando ? 'Guardando...' : 'Enviar encuesta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
