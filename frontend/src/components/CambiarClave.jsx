import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';

const MIN_LEN = 10;

function problemaClave(clave) {
  if (clave.length < MIN_LEN) return `Debe tener al menos ${MIN_LEN} caracteres`;
  if (!/[A-Za-z]/.test(clave) || !/[0-9]/.test(clave)) return 'Debe combinar letras y numeros';
  return '';
}

// Formulario de cambio de clave. En modo `obligatorio` (primer acceso o clave
// restablecida por un administrador) ocupa toda la pantalla y no se puede
// cerrar; en modo voluntario se muestra como modal.
export default function CambiarClave({ obligatorio = false, onCerrar }) {
  const { usuario, cambiarClave, cerrarSesion } = useAuth();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [error, setError] = useState('');
  const [listo, setListo] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const problema = problemaClave(nueva);
    if (problema) return setError(problema);
    if (nueva !== confirmacion) return setError('La confirmacion no coincide con la clave nueva');
    if (nueva === actual) return setError('La clave nueva debe ser distinta de la actual');

    setEnviando(true);
    try {
      await cambiarClave(actual, nueva);
      setListo(true);
      if (!obligatorio && onCerrar) setTimeout(onCerrar, 1200);
    } catch (err) {
      setError(err.message || 'No se pudo cambiar la clave.');
    } finally {
      setEnviando(false);
    }
  };

  const inputCls =
    'mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-ogbu-600 focus:outline-none focus:ring-1 focus:ring-ogbu-600';

  const formulario = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          {obligatorio ? 'Debes cambiar tu clave' : 'Cambiar clave'}
        </h2>
        {obligatorio && (
          <p className="mt-1 text-sm text-gray-500">
            Por seguridad, define una clave personal antes de continuar
            {usuario ? ` (${usuario.correo})` : ''}.
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          {obligatorio ? 'Clave temporal' : 'Clave actual'}
        </label>
        <input
          type="password"
          autoComplete="current-password"
          required
          value={actual}
          onChange={(e) => setActual(e.target.value)}
          className={inputCls}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Clave nueva</label>
        <input
          type="password"
          autoComplete="new-password"
          required
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          className={inputCls}
        />
        <p className="mt-1 text-xs text-gray-400">
          Minimo {MIN_LEN} caracteres, combinando letras y numeros.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Confirmar clave nueva</label>
        <input
          type="password"
          autoComplete="new-password"
          required
          value={confirmacion}
          onChange={(e) => setConfirmacion(e.target.value)}
          className={inputCls}
        />
      </div>

      {error && (
        <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      {listo && (
        <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          Clave actualizada correctamente.
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-1">
        {obligatorio ? (
          <button type="button" onClick={cerrarSesion} className="text-sm text-gray-500 hover:text-gray-700">
            Salir
          </button>
        ) : (
          <button type="button" onClick={onCerrar} className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={enviando || listo}
          className="rounded-md bg-ogbu-600 px-4 py-2 text-sm font-semibold text-white hover:bg-ogbu-700 disabled:opacity-60"
        >
          {enviando ? 'Guardando...' : 'Guardar clave'}
        </button>
      </div>
    </form>
  );

  if (obligatorio) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-sm">{formulario}</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">{formulario}</div>
    </div>
  );
}
