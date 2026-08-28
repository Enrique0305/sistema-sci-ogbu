// Cliente HTTP centralizado para consumir la API del backend SCI-OGBU.
// Usar siempre estas funciones (y no fetch directo) para mantener el
// manejo de errores y la URL base consistentes en toda la app.

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

async function manejarRespuesta(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || `Error HTTP ${res.status}`);
    error.detalles = data.detalles;
    throw error;
  }
  return data;
}

export async function obtenerServicios() {
  const res = await fetch(`${BASE_URL}/servicios`);
  return manejarRespuesta(res);
}

export async function buscarEstudiante(codigo) {
  const res = await fetch(`${BASE_URL}/estudiantes/${encodeURIComponent(codigo)}`);
  return manejarRespuesta(res);
}

export async function crearAtencion(payload) {
  const res = await fetch(`${BASE_URL}/atenciones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return manejarRespuesta(res);
}

export async function listarAtenciones(filtros = {}) {
  const params = new URLSearchParams(
    Object.fromEntries(Object.entries(filtros).filter(([, v]) => v !== '' && v != null))
  );
  const res = await fetch(`${BASE_URL}/atenciones?${params.toString()}`);
  return manejarRespuesta(res);
}

export async function obtenerDashboard(filtros = {}) {
  const params = new URLSearchParams(
    Object.fromEntries(Object.entries(filtros).filter(([, v]) => v !== '' && v != null))
  );
  const res = await fetch(`${BASE_URL}/indicadores/dashboard?${params.toString()}`);
  return manejarRespuesta(res);
}

export async function responderEncuesta(respuestas) {
  const res = await fetch(`${BASE_URL}/encuestas/responder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ respuestas }),
  });
  return manejarRespuesta(res);
}
