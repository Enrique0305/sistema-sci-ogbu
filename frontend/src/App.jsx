import { useState } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import Login from './components/Login';
import CambiarClave from './components/CambiarClave';
import RegistroAtencion from './components/RegistroAtencion';
import DashboardIndicadores from './components/DashboardIndicadores';
import AdminUsuarios from './components/AdminUsuarios';

function vistaSolicitada() {
  const params = new URLSearchParams(window.location.search);
  return params.get('view');
}

function Aplicacion() {
  const { usuario, cargando, permisos, cerrarSesion } = useAuth();
  const [vistaElegida, setVistaElegida] = useState(vistaSolicitada);
  const [cambiandoClave, setCambiandoClave] = useState(false);

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-sm text-gray-500">
        Cargando...
      </div>
    );
  }

  if (!usuario) return <Login />;

  // Primer acceso o clave restablecida por un administrador.
  if (usuario.debe_cambiar_clave) return <CambiarClave obligatorio />;

  const tabs = [
    permisos.operar && { id: 'registro', label: 'Registro de atencion' },
    { id: 'dashboard', label: 'Dashboard de indicadores' },
    permisos.administrarUsuarios && { id: 'usuarios', label: 'Usuarios' },
  ].filter(Boolean);

  // Si la vista pedida no esta permitida para este rol, se usa la primera.
  const vista = tabs.some((t) => t.id === vistaElegida) ? vistaElegida : tabs[0].id;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-ogbu-600 text-white shadow">
        <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-3 px-4 py-4">
          <div>
            <h1 className="text-lg font-bold">Sistema Digital de Atenciones e Indicadores SCI</h1>
            <p className="text-sm text-white/80">Oficina General de Bienestar Universitario - UNMSM</p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="text-right">
              <p className="font-medium leading-tight">{usuario.nombres} {usuario.apellidos}</p>
              <p className="text-xs text-white/70">
                {usuario.rol_sistema}{usuario.unidad_nombre ? ` · ${usuario.unidad_nombre}` : ''}
              </p>
            </div>
            <button
              onClick={() => setCambiandoClave(true)}
              className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/20"
            >
              Cambiar clave
            </button>
            <button
              onClick={cerrarSesion}
              className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/20"
            >
              Salir
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 px-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setVistaElegida(tab.id)}
              className={`rounded-t-md px-4 py-2 text-sm font-medium transition ${
                vista === tab.id ? 'bg-gray-50 text-ogbu-700' : 'text-white/80 hover:bg-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {vista === 'registro' && <RegistroAtencion />}
        {vista === 'dashboard' && <DashboardIndicadores />}
        {vista === 'usuarios' && <AdminUsuarios />}
      </main>

      {cambiandoClave && <CambiarClave onCerrar={() => setCambiandoClave(false)} />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Aplicacion />
    </AuthProvider>
  );
}
