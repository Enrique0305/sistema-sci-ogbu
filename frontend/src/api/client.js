// Cliente HTTP centralizado para consumir la API del backend SCI-OGBU.
// Usar siempre estas funciones (y no fetch directo) para mantener el
// manejo de errores y la URL base consistentes en toda la app.

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

async function manejarRespuesta(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || `Error HTTP ${res.status}`);
    error.detalles = data.detalles;
    error.transicionesValidas = data.transiciones_validas;
    throw error;
  }
  return data;
}

function qs(filtros = {}) {
  return new URLSearchParams(
    Object.fromEntries(Object.entries(filtros).filter(([, v]) => v !== '' && v != null))
  ).toString();
}

// --- Catalogos ---
export async function obtenerServicios(ambito) {
  const res = await fetch(`${BASE_URL}/servicios${ambito ? `?ambito=${ambito}` : ''}`);
  return manejarRespuesta(res);
}

export async function obtenerUnidades(filtros = {}) {
  const res = await fetch(`${BASE_URL}/unidades?${qs(filtros)}`);
  return manejarRespuesta(res);
}

export async function obtenerOperadores(filtros = {}) {
  const res = await fetch(`${BASE_URL}/usuarios?${qs(filtros)}`);
  return manejarRespuesta(res);
}

export async function obtenerCategorias(filtros = {}) {
  const res = await fetch(`${BASE_URL}/categorias?${qs(filtros)}`);
  return manejarRespuesta(res);
}

export async function obtenerAcciones(filtros = {}) {
  const res = await fetch(`${BASE_URL}/acciones?${qs(filtros)}`);
  return manejarRespuesta(res);
}

// --- Estudiantes ---
export async function buscarEstudiante(codigo) {
  const res = await fetch(`${BASE_URL}/estudiantes/${encodeURIComponent(codigo)}`);
  return manejarRespuesta(res);
}

// --- Atenciones ---
export async function crearAtencion(payload) {
  const res = await fetch(`${BASE_URL}/atenciones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return manejarRespuesta(res);
}

export async function listarAtenciones(filtros = {}) {
  const res = await fetch(`${BASE_URL}/atenciones?${qs(filtros)}`);
  return manejarRespuesta(res);
}

export async function obtenerAtencion(id) {
  const res = await fetch(`${BASE_URL}/atenciones/${id}`);
  return manejarRespuesta(res);
}

export async function cambiarEstadoAtencion(id, payload) {
  const res = await fetch(`${BASE_URL}/atenciones/${id}/estado`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return manejarRespuesta(res);
}

// --- Indicadores ---
export async function obtenerDashboard(filtros = {}) {
  const res = await fetch(`${BASE_URL}/indicadores/dashboard?${qs(filtros)}`);
  return manejarRespuesta(res);
}

// --- Encuestas ---
export async function responderEncuesta(respuestas) {
  const res = await fetch(`${BASE_URL}/encuestas/responder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ respuestas }),
  });
  return manejarRespuesta(res);
}
