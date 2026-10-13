// Cliente HTTP centralizado para consumir la API del backend SCI-OGBU.
// Usar siempre estas funciones (y no fetch directo) para mantener el
// manejo de errores, la sesion y la URL base consistentes en toda la app.
//
// La sesion viaja en una cookie httpOnly (same-origin, via el proxy de nginx);
// el frontend nunca ve ni guarda el token.

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export const EVENTO_SESION_EXPIRADA = 'sci:sesion-expirada';

async function manejarRespuesta(res, { esLogin = false } = {}) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Sesion invalida/expirada en cualquier endpoint protegido: avisar a la
    // app para que vuelva a la pantalla de login (el login mismo responde
    // 401 por credenciales incorrectas, eso NO es una sesion expirada).
    if (res.status === 401 && !esLogin) {
      window.dispatchEvent(new Event(EVENTO_SESION_EXPIRADA));
    }
    const error = new Error(data.error || `Error HTTP ${res.status}`);
    error.status = res.status;
    error.codigo = data.codigo;
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

const JSON_HEADERS = { 'Content-Type': 'application/json' };

// --- Autenticacion ---
export async function iniciarSesion(correo, clave) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ correo, clave }),
  });
  return manejarRespuesta(res, { esLogin: true });
}

export async function cerrarSesion() {
  const res = await fetch(`${BASE_URL}/auth/logout`, { method: 'POST' });
  return manejarRespuesta(res, { esLogin: true });
}

export async function obtenerSesion() {
  const res = await fetch(`${BASE_URL}/auth/me`);
  // Aqui un 401 es lo normal (no hay sesion): no dispara el evento global.
  return manejarRespuesta(res, { esLogin: true });
}

export async function cambiarClave(clave_actual, clave_nueva) {
  const res = await fetch(`${BASE_URL}/auth/cambiar-clave`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ clave_actual, clave_nueva }),
  });
  return manejarRespuesta(res, { esLogin: true });
}

// --- Administracion de usuarios (rol Administrador) ---
export async function listarUsuariosAdmin(filtros = {}) {
  const res = await fetch(`${BASE_URL}/admin/usuarios?${qs(filtros)}`);
  return manejarRespuesta(res);
}

export async function crearUsuarioAdmin(payload) {
  const res = await fetch(`${BASE_URL}/admin/usuarios`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  return manejarRespuesta(res);
}

export async function actualizarUsuarioAdmin(id, payload) {
  const res = await fetch(`${BASE_URL}/admin/usuarios/${id}`, {
    method: 'PATCH',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  return manejarRespuesta(res);
}

export async function resetearClaveUsuario(id) {
  const res = await fetch(`${BASE_URL}/admin/usuarios/${id}/reset-clave`, { method: 'POST' });
  return manejarRespuesta(res);
}

export async function desbloquearUsuario(id) {
  const res = await fetch(`${BASE_URL}/admin/usuarios/${id}/desbloquear`, { method: 'POST' });
  return manejarRespuesta(res);
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
    headers: JSON_HEADERS,
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
    headers: JSON_HEADERS,
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
    headers: JSON_HEADERS,
    body: JSON.stringify({ respuestas }),
  });
  return manejarRespuesta(res);
}
