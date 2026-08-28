import { useState } from 'react';
import RegistroAtencion from './components/RegistroAtencion';
import DashboardIndicadores from './components/DashboardIndicadores';

function vistaInicial() {
  const params = new URLSearchParams(window.location.search);
  return params.get('view') === 'dashboard' ? 'dashboard' : 'registro';
}

export default function App() {
  const [vista, setVista] = useState(vistaInicial);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-ogbu-600 text-white shadow">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <h1 className="text-lg font-bold">Sistema Digital de Atenciones e Indicadores SCI</h1>
          <p className="text-sm text-white/80">Oficina General de Bienestar Universitario - UNMSM</p>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 px-4">
          {[
            { id: 'registro', label: 'Registro de atencion' },
            { id: 'dashboard', label: 'Dashboard de indicadores' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setVista(tab.id)}
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
        {vista === 'registro' ? <RegistroAtencion /> : <DashboardIndicadores />}
      </main>
    </div>
  );
}
