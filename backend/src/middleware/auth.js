// Autenticacion por sesion del lado del servidor.
//
// - Al iniciar sesion se genera un token aleatorio (256 bits) que viaja en una
//   cookie httpOnly + SameSite=Strict. En la BD solo se guarda su hash SHA-256
//   (tabla `sesiones`), de modo que una filtracion de la tabla no permite
//   suplantar sesiones.
// - El rol y el estado del usuario se leen de la BD en cada peticion: un
//   cambio de rol o una desactivacion tienen efecto inmediato.
// - Las expiraciones se calculan siempre en SQL (NOW()) para no mezclar
//   zonas horarias entre Node y MySQL.
const crypto = require('crypto');
const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

const COOKIE_NAME = 'sci_sid';
const SESION_HORAS = Number(process.env.SESSION_HOURS) || 8;

function leerCookie(req, nombre) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const par of header.split(';')) {
    const idx = par.indexOf('=');
    if (idx === -1) continue;
    if (par.slice(0, idx).trim() === nombre) {
      try {
        return decodeURIComponent(par.slice(idx + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function opcionesCookie(req) {
  return {
    httpOnly: true,
    sameSite: 'strict',
    // `secure` solo si la peticion llego por HTTPS (con trust proxy se
    // respeta X-Forwarded-Proto); en HTTP interno de LAN un cookie Secure
    // no seria enviada por el navegador.
    secure: Boolean(req.secure),
    path: '/',
  };
}

async function crearSesion(req, res, usuarioId) {
  const token = crypto.randomBytes(32).toString('hex');
  await query(`DELETE FROM sesiones WHERE expira_en < NOW()`);
  await query(
    `INSERT INTO sesiones (token_hash, usuario_id, expira_en, ip, user_agent)
     VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR), ?, ?)`,
    [
      hashToken(token),
      usuarioId,
      SESION_HORAS,
      (req.ip || '').slice(0, 45),
      (req.headers['user-agent'] || '').slice(0, 255),
    ]
  );
  res.cookie(COOKIE_NAME, token, { ...opcionesCookie(req), maxAge: SESION_HORAS * 3600 * 1000 });
}

async function destruirSesion(req, res) {
  const token = leerCookie(req, COOKIE_NAME);
  if (token) {
    await query(`DELETE FROM sesiones WHERE token_hash = ?`, [hashToken(token)]);
  }
  res.clearCookie(COOKIE_NAME, opcionesCookie(req));
}

async function cargarUsuarioDeSesion(req) {
  const token = leerCookie(req, COOKIE_NAME);
  if (!token) return null;

  const { rows } = await query(
    `SELECT s.sesion_id, u.usuario_id, u.nombres, u.apellidos, u.correo_institucional,
            u.rol_sistema, u.unidad_id, u.cargo, u.estado, u.debe_cambiar_clave
       FROM sesiones s
       JOIN usuarios_responsables u ON u.usuario_id = s.usuario_id
      WHERE s.token_hash = ? AND s.expira_en > NOW()`,
    [hashToken(token)]
  );
  if (rows.length === 0 || !rows[0].estado) return null;
  return rows[0];
}

/**
 * Exige una sesion valida. Mientras el usuario tenga `debe_cambiar_clave`
 * solo puede usar los endpoints que declaren `permitirCambioPendiente`
 * (me, logout, cambiar-clave).
 */
function requireAuth({ permitirCambioPendiente = false } = {}) {
  return asyncHandler(async (req, res, next) => {
    const usuario = await cargarUsuarioDeSesion(req);
    if (!usuario) {
      res.clearCookie(COOKIE_NAME, opcionesCookie(req));
      return res.status(401).json({ ok: false, error: 'Sesion no valida o expirada', codigo: 'NO_AUTENTICADO' });
    }
    if (usuario.debe_cambiar_clave && !permitirCambioPendiente) {
      return res.status(403).json({
        ok: false,
        error: 'Debe cambiar su clave antes de continuar',
        codigo: 'CAMBIO_CLAVE_OBLIGATORIO',
      });
    }
    req.user = usuario;
    next();
  });
}

/** Restringe a uno o mas roles del sistema. Debe ir despues de requireAuth. */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.rol_sistema)) {
      return res.status(403).json({
        ok: false,
        error: 'No tiene permisos para realizar esta accion',
        codigo: 'SIN_PERMISO',
      });
    }
    next();
  };
}

module.exports = {
  COOKIE_NAME,
  SESION_HORAS,
  hashToken,
  leerCookie,
  crearSesion,
  destruirSesion,
  requireAuth,
  requireRole,
};
