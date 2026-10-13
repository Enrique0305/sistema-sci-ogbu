import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';

export default function Login() {
  const { iniciarSesion, sesionExpirada } = useAuth();
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await iniciarSesion(correo.trim(), clave);
    } catch (err) {
      setError(err.message || 'No se pudo iniciar sesion.');
      setClave('');
    } finally {
      setEnviando(false);
    }
  };

  const inputCls =
    'mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-ogbu-600 focus:outline-none focus:ring-1 focus:ring-ogbu-600';

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-t-xl bg-ogbu-600 px-6 py-5 text-white">
          <h1 className="text-lg font-bold">Sistema Digital de Atenciones e Indicadores SCI</h1>
          <p className="text-sm text-white/80">Oficina General de Bienestar Universitario - UNMSM</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-b-xl border border-t-0 border-gray-200 bg-white p-6 shadow-sm"
        >
          <h2 className="text-base font-semibold text-gray-900">Iniciar sesion</h2>

          {sesionExpirada && !error && (
            <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Tu sesion expiro o fue cerrada. Ingresa nuevamente.
            </div>
          )}

          <div>
            <label htmlFor="correo" className="block text-sm font-medium text-gray-700">
              Correo institucional
            </label>
            <input
              id="correo"
              type="email"
              autoComplete="username"
              autoFocus
              required
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              placeholder="usuario@unmsm.edu.pe"
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="clave" className="block text-sm font-medium text-gray-700">
              Clave
            </label>
            <div className="relative">
              <input
                id="clave"
                type={verClave ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                className={`${inputCls} pr-16`}
              />
              <button
                type="button"
                onClick={() => setVerClave((v) => !v)}
                className="absolute right-2 top-1/2 mt-0.5 -translate-y-1/2 text-xs font-medium text-gray-500 hover:text-gray-700"
              >
                {verClave ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </div>

          {error && (
            <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="w-full rounded-md bg-ogbu-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-ogbu-700 disabled:opacity-60"
          >
            {enviando ? 'Verificando...' : 'Ingresar'}
          </button>

          <p className="text-center text-xs text-gray-400">
            Si olvidaste tu clave, solicita su restablecimiento al administrador del sistema.
          </p>
        </form>
      </div>
    </div>
  );
}
